import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { serve } from "@hono/node-server";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { timingSafeEqual } from "node:crypto";
import {
  PIPELINE_GRAPH,
  GRAPH_VERSION,
  runPipeline,
  cancelRevisionRun,
  getDefaultStore,
  subscribeRunEvents,
  computeReleaseSnapshot,
  generateAllExports,
  loadScriptD1,
  loadD1RawFeedback,
  buildNewFeedbackItems,
  parseFeedbackCsv,
  computeFeedbackFingerprint,
  sanitizeFeedbackItem,
  nextStoredFeedbackIndex,
  type AnalyzeInput,
  type DecisionRecord,
  type RunDecisionState,
  type FeedbackItem,
  type NewFeedbackInput,
} from "@feedback/revision-core";

const app = new Hono();
const store = getDefaultStore();

const PORT = Number(process.env.REVISION_SERVICE_PORT) || 8000;
const HOST = "127.0.0.1";
// Không có token mặc định: thiếu hoặc quá ngắn thì tắt hẳn API debug.
const DEBUG_TOKEN = process.env.REVISION_DEBUG_TOKEN?.trim() ?? "";
const DEBUG_ENABLED = DEBUG_TOKEN.length >= 24;
if (!DEBUG_ENABLED) {
  console.warn(
    "[revision-service] REVISION_DEBUG_TOKEN chưa đặt hoặc ngắn hơn 24 ký tự: API /debug/* bị tắt.",
  );
}
const STUDIO_ORIGIN = process.env.STUDIO_ORIGIN || "http://localhost:3000";

// CORS config
app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return STUDIO_ORIGIN;
      if (
        origin === STUDIO_ORIGIN ||
        origin === "http://localhost:3000" ||
        origin === "http://127.0.0.1:3000" ||
        origin === "http://localhost:8001" ||
        origin === "http://127.0.0.1:8001"
      ) {
        return origin;
      }
      return STUDIO_ORIGIN;
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Disposition"],
    credentials: true,
  }),
);

// Nội dung gốc chưa làm sạch không bao giờ rời service (C3-SAN-05, PII).
function stripRawText(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripRawText);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "rawText")
        .map(([key, inner]) => [key, stripRawText(inner)]),
    );
  }
  return value;
}

app.use("*", async (c, next) => {
  await next();
  const type = c.res.headers.get("content-type") || "";
  if (!type.includes("application/json")) return;
  const text = await c.res.clone().text();
  if (!text.includes('"rawText"')) return;
  const headers = new Headers(c.res.headers);
  headers.delete("content-length");
  c.res = new Response(JSON.stringify(stripRawText(JSON.parse(text))), {
    status: c.res.status,
    headers,
  });
});

// Health check
app.get("/health", (c) => c.json({ ok: true, port: PORT, status: "healthy" }));

// --------------------------------------------------------------------------
// 4.1 API Sản phẩm
// --------------------------------------------------------------------------

// GET /pipeline?version=
app.get("/pipeline", (c) => {
  return c.json({
    graph: PIPELINE_GRAPH,
    version: GRAPH_VERSION,
  });
});

// POST /runs
app.post("/runs", async (c) => {
  try {
    const body = (await c.req.json()) as AnalyzeInput & {
      retryOf?: string;
    };

    const videoId = body.videoId || "d1";
    const versionId = body.versionId || "v1";

    // Góp ý đã lưu trong studio chỉ vào run của studio. Run eval gửi
    // includeD1Feedback: false kèm bộ góp ý riêng, không được trộn thêm.
    const storedFeedback =
      body.includeD1Feedback === false
        ? []
        : store.loadStoredFeedback(videoId, versionId);

    // Studio chỉ gửi videoId/versionId: video mẫu D1 mặc định gồm bộ góp ý gốc.
    // Eval gửi includeD1Feedback: false để chỉ dùng bộ góp ý của case.
    const input: AnalyzeInput = {
      ...body,
      videoId,
      versionId,
      includeD1Feedback: body.includeD1Feedback ?? videoId === "d1",
    };

    const { runId, status } = await runPipeline(input, {
      store,
      storedFeedback,
    });

    return c.json(
      {
        runId,
        graphVersion: GRAPH_VERSION,
        status,
      },
      202,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: { code: "START_RUN_FAILED", message: msg } }, 400);
  }
});

// GET /runs
app.get("/runs", (c) => {
  const runs = store.listRunSummaries();
  return c.json({ runs });
});

// GET /runs/:runId
app.get("/runs/:runId", (c) => {
  const runId = c.req.param("runId");
  const data = store.getRunById(runId);
  if (!data) {
    return c.json(
      {
        error: {
          code: "RUN_NOT_FOUND",
          message: `Không tìm thấy run ${runId}`,
        },
      },
      404,
    );
  }
  // Số node dùng lại kết quả cũ: eval cần để không gọi nhầm run cache là "chạy thật".
  const cacheHits = store
    .readEvents(runId, 0)
    .filter((e) => e.type === "node.cache_hit").length;
  return c.json({ ...data, cacheHits });
});

// GET /runs/:runId/trace
app.get("/runs/:runId/trace", (c) => {
  const runId = c.req.param("runId");
  const data = store.getRunById(runId);
  if (!data) {
    return c.json(
      {
        error: {
          code: "TRACE_NOT_FOUND",
          message: `Không tìm thấy trace của run ${runId}`,
        },
      },
      404,
    );
  }
  return c.json(data);
});

// GET /runs/:runId/events?after=
app.get("/runs/:runId/events", async (c) => {
  const runId = c.req.param("runId");
  const afterSeq = Number(c.req.query("after")) || 0;

  // Sự kiện gửi không đặt tên (kiểu "message"): UI và trang debug đều đọc qua
  // onmessage và phân loại bằng trường `type` trong dữ liệu.
  return streamSSE(c, async (stream) => {
    let lastSent = afterSeq;
    let closed = false;
    let finish: () => void = () => {};
    const done = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const send = async (ev: { seq: number; type: string }) => {
      if (closed || ev.seq <= lastSent) return;
      lastSent = ev.seq;
      await stream.writeSSE({ data: JSON.stringify(ev), id: String(ev.seq) });
      if (ev.type === "run.finished" || ev.type === "run.failed") {
        closed = true;
        finish();
      }
    };

    // Đăng ký trước, đọc lịch sử sau: sự kiện phát ra giữa hai bước vẫn được
    // gửi, trùng lặp bị loại theo seq.
    const pending: Array<{ seq: number; type: string }> = [];
    let replaying = true;
    const unsubscribe = subscribeRunEvents(runId, (ev) => {
      if (replaying) {
        pending.push(ev);
        return;
      }
      void send(ev).catch(() => {});
    });

    for (const ev of store.readEvents(runId, afterSeq)) await send(ev);
    replaying = false;
    for (const ev of pending.sort((a, b) => a.seq - b.seq)) await send(ev);

    // Run đã kết thúc từ trước (hoặc không tồn tại) thì đóng luồng ngay.
    const run = store.getRunById(runId);
    if (!run || run.run.status !== "dang-chay") {
      closed = true;
      finish();
    }

    const heartbeat = setInterval(() => {
      void stream.writeSSE({ data: "", event: "heartbeat" }).catch(() => {});
    }, 15000);

    stream.onAbort(() => {
      closed = true;
      finish();
    });

    await done;
    unsubscribe();
    clearInterval(heartbeat);
  });
});

// POST /runs/:runId/cancel
app.post("/runs/:runId/cancel", (c) => {
  const runId = c.req.param("runId");
  const cancelled = cancelRevisionRun(runId, store);
  return c.json({ ok: true, cancelled });
});

// GET /videos
app.get("/videos", (c) => {
  try {
    const script = loadScriptD1(store);
    return c.json({
      videos: [
        {
          id: "d1",
          tieuDe: script.tieuDe,
          thoiLuongDuKienGiay: script.thoiLuongDuKienGiay,
          sectionsCount: script.phan.length,
          sentencesCount: script.cau.length,
        },
      ],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: { code: "VIDEOS_LOAD_FAILED", message: msg } }, 500);
  }
});

// GET /videos/:id
app.get("/videos/:id", (c) => {
  const id = c.req.param("id");
  if (id !== "d1") {
    return c.json(
      {
        error: {
          code: "VIDEO_NOT_FOUND",
          message: `Không tìm thấy video ${id}`,
        },
      },
      404,
    );
  }
  try {
    const script = loadScriptD1(store);
    return c.json({ id: "d1", script });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: { code: "LOAD_SCRIPT_FAILED", message: msg } }, 500);
  }
});

// GET /videos/:id/feedback
app.get("/videos/:id/feedback", (c) => {
  const id = c.req.param("id");
  const versionId = c.req.query("versionId") || "v1";
  try {
    let items: FeedbackItem[] = [];
    if (id === "d1") {
      items = loadD1RawFeedback(store);
    }
    const stored = store.loadStoredFeedback(id, versionId);
    const combined = [...items, ...stored];
    return c.json({ feedback: combined });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json(
      { error: { code: "LOAD_FEEDBACK_FAILED", message: msg } },
      500,
    );
  }
});

// POST /videos/:id/feedback
app.post("/videos/:id/feedback", async (c) => {
  const id = c.req.param("id");
  try {
    const body = (await c.req.json()) as {
      items: NewFeedbackInput[];
      versionId?: string;
    };
    const versionId = body.versionId || "v1";
    const script = loadScriptD1(store);
    const existing = store.loadStoredFeedback(id, versionId);
    const nextIdx = nextStoredFeedbackIndex(existing);

    const newItems = buildNewFeedbackItems(body.items, script, "gy-u", nextIdx);
    const saved = store.appendStoredFeedback(id, versionId, newItems);
    return c.json({ items: saved });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json(
      { error: { code: "SAVE_FEEDBACK_FAILED", message: msg } },
      400,
    );
  }
});

// POST /videos/:id/feedback/import
app.post("/videos/:id/feedback/import", async (c) => {
  const id = c.req.param("id");
  const dryRun = c.req.query("dryRun") === "1";

  try {
    const contentType = c.req.header("content-type") || "";
    let csvText = "";
    let versionId = "v1";

    if (contentType.includes("application/json")) {
      const json = await c.req.json();
      csvText = json.csv || "";
      if (json.versionId) versionId = json.versionId;
    } else {
      csvText = await c.req.text();
      const v = c.req.query("versionId");
      if (v) versionId = v;
    }

    const script = loadScriptD1(store);
    const parseResult = parseFeedbackCsv(csvText);

    // Lấy các góp ý đã có để kiểm tra trùng fingerprint (C3)
    const existingD1 = id === "d1" ? loadD1RawFeedback(store) : [];
    const existingStored = store.loadStoredFeedback(id, versionId);
    const existingAll = [...existingD1, ...existingStored];

    // So trùng trên bản đã làm sạch: góp ý đã lưu chỉ còn bí danh người gửi và
    // văn bản đã ẩn PII, nên dòng CSV cũng phải qua đúng bước đó rồi mới so.
    const existingFingerprints = new Set(
      existingAll.map((f) =>
        computeFeedbackFingerprint(f.sender, f.sanitizedText, f.survey),
      ),
    );

    const validRows: typeof parseResult.rows = [];
    const previewRows: Array<{
      rowKey: string;
      channel?: string;
      sender: string;
      text: string;
      survey?: { deHieu?: number; nhipDo?: number };
      label: string;
      isQuarantined: boolean;
      quarantineReason?: string;
    }> = [];
    const duplicateRows: Array<{ rowKey: string; reason: string }> = [];

    for (const row of parseResult.rows) {
      const clean = sanitizeFeedbackItem({
        id: row.rowKey,
        channel: row.channel || "khao-sat",
        sender: row.sender,
        text: row.text,
        survey: row.survey,
      });
      const fp = computeFeedbackFingerprint(
        clean.sender,
        clean.sanitizedText,
        row.survey,
      );
      if (existingFingerprints.has(fp)) {
        duplicateRows.push({
          rowKey: row.rowKey,
          reason: `Người gửi ${clean.sender} đã có góp ý cùng nội dung`,
        });
        continue;
      }
      existingFingerprints.add(fp);
      validRows.push(row);
      // Xem trước chỉ trả bản đã làm sạch; nội dung cài lệnh/công kích bị ẩn.
      previewRows.push({
        rowKey: row.rowKey,
        channel: row.channel,
        sender: clean.sender,
        text: clean.sanitizedText,
        survey: row.survey,
        label: clean.label,
        isQuarantined: clean.isQuarantined,
        quarantineReason: clean.quarantineReason,
      });
    }

    if (dryRun) {
      return c.json({
        preview: previewRows,
        totalRows: parseResult.totalRows,
        format: parseResult.format,
        warnings: parseResult.warnings,
        duplicates: duplicateRows,
        duplicateCount: duplicateRows.length,
      });
    }

    // Confirm import
    const nextIdx = nextStoredFeedbackIndex(existingStored);
    const newItems = buildNewFeedbackItems(validRows, script, "gy-u", nextIdx);
    const saved = store.appendStoredFeedback(id, versionId, newItems);

    return c.json({
      imported: saved,
      totalImported: saved.length,
      duplicateCount: duplicateRows.length,
      warnings: parseResult.warnings,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isInputInvalid = msg.includes("INPUT_INVALID");
    return c.json(
      {
        error: {
          code: isInputInvalid ? "INPUT_INVALID" : "IMPORT_FAILED",
          message: msg,
        },
      },
      isInputInvalid ? 400 : 500,
    );
  }
});

// PUT /runs/:runId/decisions/:caseId
app.put("/runs/:runId/decisions/:caseId", async (c) => {
  const runId = c.req.param("runId");
  const caseId = c.req.param("caseId");

  try {
    const runData = store.getRunById(runId);
    if (!runData || !runData.result) {
      return c.json(
        {
          error: {
            code: "RUN_NOT_FOUND",
            message: `Không tìm thấy kết quả run ${runId}`,
          },
        },
        404,
      );
    }

    const body = (await c.req.json()) as {
      type: "chon" | "hoan" | "bo" | "giu-nguyen";
      optionId?: string;
      reason?: string;
      expectedVersion?: number;
    };

    const currentState = store.loadDecisions(runId);

    // Kiểm tra xung đột phiên bản (409 Conflict)
    if (
      body.expectedVersion !== undefined &&
      currentState.version !== body.expectedVersion
    ) {
      return c.json(
        {
          error: {
            code: "VERSION_CONFLICT",
            message: `Quyết định đã bị thay đổi (phiên bản hiện tại: ${currentState.version}, kỳ vọng: ${body.expectedVersion})`,
          },
          currentVersion: currentState.version,
          state: currentState,
        },
        409,
      );
    }

    // Cập nhật quyết định cho caseId
    const updatedDecisions: Record<string, DecisionRecord> = {
      ...currentState.decisions,
      [caseId]: {
        type: body.type,
        optionId: body.optionId,
        reason: body.reason,
        at: new Date().toISOString(),
      },
    };

    const nextState: RunDecisionState = {
      version: currentState.version + 1,
      decisions: updatedDecisions,
      updatedAt: new Date().toISOString(),
    };

    store.saveDecisions(runId, nextState);

    // Tính snapshot từ quyết định mới
    const snapshot = computeReleaseSnapshot({
      runId,
      inputHash: runData.run.inputHash,
      script: runData.result.script,
      cases: runData.result.cases,
      decisions: updatedDecisions,
    });

    return c.json({
      version: nextState.version,
      decisions: nextState.decisions,
      snapshot,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json(
      { error: { code: "DECISION_SAVE_FAILED", message: msg } },
      500,
    );
  }
});

// GET /runs/:runId/release
app.get("/runs/:runId/release", (c) => {
  const runId = c.req.param("runId");
  const runData = store.getRunById(runId);
  if (!runData || !runData.result) {
    return c.json(
      {
        error: {
          code: "RUN_NOT_FOUND",
          message: `Không tìm thấy kết quả run ${runId}`,
        },
      },
      404,
    );
  }

  const state = store.loadDecisions(runId);
  const snapshot = computeReleaseSnapshot({
    runId,
    inputHash: runData.run.inputHash,
    script: runData.result.script,
    cases: runData.result.cases,
    decisions: state.decisions,
  });

  return c.json({
    version: state.version,
    decisions: state.decisions,
    snapshot,
  });
});

// POST /runs/:runId/export
app.post("/runs/:runId/export", async (c) => {
  const runId = c.req.param("runId");
  const runData = store.getRunById(runId);
  if (!runData || !runData.result) {
    return c.json(
      {
        error: {
          code: "RUN_NOT_FOUND",
          message: `Không tìm thấy kết quả run ${runId}`,
        },
      },
      404,
    );
  }

  try {
    let body: any = {};
    try {
      body = await c.req.json();
    } catch {}

    const state = store.loadDecisions(runId);
    // Ưu tiên quyết định đã lưu ở server (nguồn có thẩm quyền)
    const decisions =
      Object.keys(state.decisions).length > 0
        ? state.decisions
        : body.decisions || {};

    const snapshot = computeReleaseSnapshot({
      runId,
      inputHash: runData.run.inputHash,
      script: runData.result.script,
      cases: runData.result.cases,
      decisions,
    });

    if (snapshot.conflicts.length > 0) {
      return c.json(
        {
          error: {
            code: "EXPORT_BLOCKED_CONFLICT",
            message: `Có ${snapshot.conflicts.length} xung đột ghi đè chưa được giải quyết`,
            conflicts: snapshot.conflicts,
          },
        },
        409,
      );
    }

    const exportPkg = generateAllExports({
      script: runData.result.script,
      snapshot,
      cases: runData.result.cases,
      issues: runData.result.issues,
      feedback: runData.result.feedback,
      metadata: {
        modelId: runData.run.modelId,
        promptVersion: runData.run.promptVersion,
        schemaVersion: runData.run.schemaVersion,
        policyVersion: runData.run.policyVersion,
      },
    });

    const requestedFile = body.file;
    if (requestedFile) {
      let content = "";
      let contentType = "";
      switch (requestedFile) {
        case "kich-ban-v2.json":
          content = exportPkg.kichBanJson;
          contentType = "application/json; charset=utf-8";
          break;
        case "kich-ban-v2.md":
          content = exportPkg.kichBanMd;
          contentType = "text/markdown; charset=utf-8";
          break;
        case "viec-can-lam.csv":
          content = exportPkg.viecCanLamCsv;
          contentType = "text/csv; charset=utf-8";
          break;
        case "truy-vet.json":
          content = exportPkg.truyVetJson;
          contentType = "application/json; charset=utf-8";
          break;
        default:
          return c.json(
            {
              error: {
                code: "FILE_TYPE_INVALID",
                message: `Loại file không hợp lệ: ${requestedFile}`,
              },
            },
            400,
          );
      }
      return new Response(content, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${requestedFile}"`,
        },
      });
    }

    return c.json(exportPkg);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isConflict = msg.includes("EXPORT_BLOCKED_CONFLICT");
    return c.json(
      {
        error: {
          code: isConflict ? "EXPORT_BLOCKED_CONFLICT" : "EXPORT_FAILED",
          message: msg,
        },
      },
      isConflict ? 409 : 500,
    );
  }
});

// --------------------------------------------------------------------------
// 4.2 API Debug (§4.2)
// --------------------------------------------------------------------------

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// Middleware xác thực token debug
app.use("/debug/*", async (c, next) => {
  const authHeader = c.req.header("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!DEBUG_ENABLED) {
    return c.json(
      {
        error: {
          code: "DEBUG_DISABLED",
          message:
            "API debug đang tắt: đặt REVISION_DEBUG_TOKEN (≥ 24 ký tự) cho service",
        },
      },
      503,
    );
  }
  if (!safeEqual(token, DEBUG_TOKEN)) {
    return c.json(
      {
        error: { code: "UNAUTHORIZED", message: "Yêu cầu token debug hợp lệ" },
      },
      401,
    );
  }
  await next();
});

// GET /debug/runs
app.get("/debug/runs", (c) => {
  const videoId = c.req.query("videoId");
  const versionId = c.req.query("versionId");
  const mode = c.req.query("mode");
  const caseId = c.req.query("caseId");

  const runs = store.listRunSummaries({ videoId, versionId, mode, caseId });
  return c.json({ runs });
});

// GET /debug/runs/:runId/nodes
app.get("/debug/runs/:runId/nodes", (c) => {
  const runId = c.req.param("runId");
  const nodes = store.readAllNodesDebugData(runId);
  return c.json({ nodes });
});

// GET /debug/runs/:runId/nodes/:nodeId
app.get("/debug/runs/:runId/nodes/:nodeId", (c) => {
  const runId = c.req.param("runId");
  const nodeId = c.req.param("nodeId");
  const node = store.readNodeDebugData(runId, nodeId);
  if (!node) {
    return c.json(
      {
        error: {
          code: "NODE_NOT_FOUND",
          message: `Không tìm thấy debug data cho node ${nodeId}`,
        },
      },
      404,
    );
  }
  return c.json(node);
});

// POST /debug/runs/:runId/nodes/:nodeId/replay
app.post("/debug/runs/:runId/nodes/:nodeId/replay", async (c) => {
  const runId = c.req.param("runId");
  const nodeId = c.req.param("nodeId");
  const parent = store.getRunById(runId);
  if (!parent || !parent.sanitizedInput) {
    return c.json(
      {
        error: {
          code: "RUN_NOT_FOUND",
          message: `Không tìm thấy run gốc ${runId}`,
        },
      },
      404,
    );
  }

  try {
    const parentInput = parent.sanitizedInput as AnalyzeInput;
    const { runId: childRunId, status } = await runPipeline(
      {
        ...parentInput,
      },
      {
        store,
      },
    );

    return c.json(
      {
        childRunId,
        parentRunId: runId,
        replayedNodeId: nodeId,
        status,
      },
      202,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: { code: "REPLAY_FAILED", message: msg } }, 500);
  }
});

// GET /debug/compare?a=&b=
app.get("/debug/compare", (c) => {
  const a = c.req.query("a");
  const b = c.req.query("b");
  if (!a || !b) {
    return c.json(
      {
        error: {
          code: "INPUT_INVALID",
          message: "Cần truyền query param a và b",
        },
      },
      400,
    );
  }

  const runA = store.getRunById(a);
  const runB = store.getRunById(b);
  if (!runA || !runB) {
    return c.json(
      {
        error: {
          code: "RUN_NOT_FOUND",
          message: "Không tìm thấy một trong hai run để so sánh",
        },
      },
      404,
    );
  }

  const nodesA = store.readAllNodesDebugData(a);
  const nodesB = store.readAllNodesDebugData(b);

  return c.json({
    runA: { run: runA.run, nodes: nodesA },
    runB: { run: runB.run, nodes: nodesB },
  });
});

function resolveEvalDir(base = process.cwd()): string {
  const candidates = [
    join(base, "eval/runs"),
    join(base, "../../eval/runs"),
    join(base, "../eval/runs"),
    join(base, "../../../eval/runs"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return join(base, "eval/runs");
}

// GET /debug/eval/runs
app.get("/debug/eval/runs", (c) => {
  const evalDir = resolveEvalDir();
  if (!existsSync(evalDir)) return c.json({ evalRuns: [] });

  try {
    const entries = readdirSync(evalDir, { withFileTypes: true });
    const evalRuns: any[] = [];
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const manifestPath = join(evalDir, ent.name, "manifest.json");
      if (existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
          evalRuns.push({ id: ent.name, manifest });
        } catch {}
      }
    }
    return c.json({ evalRuns });
  } catch {
    return c.json({ evalRuns: [] });
  }
});

// GET /debug/eval/runs/:evalRunId
app.get("/debug/eval/runs/:evalRunId", (c) => {
  const evalRunId = c.req.param("evalRunId");
  const evalDir = resolveEvalDir();
  const targetDir = join(evalDir, evalRunId);
  if (!existsSync(targetDir)) {
    return c.json(
      {
        error: {
          code: "EVAL_RUN_NOT_FOUND",
          message: `Không tìm thấy eval run ${evalRunId}`,
        },
      },
      404,
    );
  }

  try {
    let manifest: any = null;
    let summary: string = "";
    const manifestPath = join(targetDir, "manifest.json");
    const summaryPath = join(targetDir, "summary.md");
    if (existsSync(manifestPath)) {
      manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    }
    if (existsSync(summaryPath)) {
      summary = readFileSync(summaryPath, "utf-8");
    }

    return c.json({ id: evalRunId, manifest, summary });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: { code: "EVAL_LOAD_FAILED", message: msg } }, 500);
  }
});

// Start Node Server
console.log(`[revision-service] Starting on http://${HOST}:${PORT}`);
serve({
  fetch: app.fetch,
  port: PORT,
  hostname: HOST,
});

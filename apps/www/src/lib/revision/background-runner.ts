import {
  resolveRevisionModelId,
  runRevisionAgent,
  type MockModelCaller,
  type RevisionAgentConfig,
} from "@feedback/ai/agents/revision";
import type {
  AnalyzeInput,
  FeedbackItem,
  RevisionRunResult,
  RunMetadata,
  ValidationChecks,
} from "./types";
import { prepareAnalyzeInput } from "./load";
import { validateRevisionOutput } from "./validate";
import { buildDecisionCases } from "./cases";
import { generateRunId, getRunById, getRunsDir, saveRunTrace } from "./trace";
import { appendRunEvent, saveNodeDebugData } from "./events";
import { readNodeCache, writeNodeCache } from "./node-cache";
import {
  REVISION_HIEU_SYSTEM_PROMPT,
  REVISION_PHUONG_AN_SYSTEM_PROMPT,
  RevisionHieuOutput,
  RevisionPhuongAnOutput,
  HIEU_PROMPT_VERSION,
  PHUONG_AN_PROMPT_VERSION,
  runRevisionStep,
  getPromptHashP1,
  type AgentIssueNoOptions,
} from "@feedback/ai/agents/revision";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { redactForPersist } from "./sanitize";

interface ActiveRun {
  runId: string;
  abortController: AbortController;
  startedAt: number;
  videoId: string;
  versionId: string;
}

const activeRuns = new Map<string, ActiveRun>();

export function isRunActive(runId: string): boolean {
  return activeRuns.has(runId);
}

export function cancelRevisionRun(runId: string): boolean {
  const active = activeRuns.get(runId);
  if (!active) {
    // Nếu run trong file đang ở trạng thái dang-chay
    const current = getRunById(runId);
    if (current?.run.status === "dang-chay") {
      updateRunStatus(runId, "loi", {
        code: "RUN_CANCELLED",
        message: "Đợt phân tích đã bị hủy",
      });
      appendRunEvent(runId, {
        type: "run.failed",
        errorCode: "RUN_CANCELLED",
        message: "Đợt phân tích đã bị hủy",
      });
      return true;
    }
    return false;
  }

  active.abortController.abort();
  activeRuns.delete(runId);

  appendRunEvent(runId, {
    type: "node.finished",
    nodeId: "MODEL_PHAN_TICH",
    status: "loi",
    ms: Date.now() - active.startedAt,
    summary: "Đã dừng lời gọi model do người dùng hủy",
    errorCode: "RUN_CANCELLED",
  });

  appendRunEvent(runId, {
    type: "run.failed",
    errorCode: "RUN_CANCELLED",
    message: "Người dùng đã hủy đợt phân tích",
  });

  updateRunStatus(runId, "loi", {
    code: "RUN_CANCELLED",
    message: "Người dùng đã hủy đợt phân tích",
  });

  return true;
}

function updateRunStatus(
  runId: string,
  status: "dang-chay" | "xong" | "loi",
  error?: { code: string; message: string },
) {
  const runsDir = getRunsDir();
  const runJsonPath = join(runsDir, runId, "run.json");
  const current = getRunById(runId);
  if (current?.run) {
    const updated: RunMetadata = {
      ...current.run,
      status,
      error: error || current.run.error,
    };
    writeFileSync(
      runJsonPath,
      JSON.stringify(redactForPersist(updated), null, 2),
      "utf-8",
    );
  }
}

/**
 * Mỗi vấn đề một lời gọi lập phương án. Gom nhiều vấn đề vào chung một lời gọi
 * làm model chỉ trả phương án cho một phần (đo được: 6 vấn đề gửi chung, chỉ 1
 * vấn đề có phương án), nên tách riêng để không bỏ sót.
 */
function groupIssuesForOptions(
  issues: AgentIssueNoOptions[],
): Array<{ key: string; issues: AgentIssueNoOptions[] }> {
  return issues.map((iss) => {
    const ns = iss.location.sentenceNs;
    const key =
      iss.location.status === "da-dinh-vi" && ns.length > 0
        ? `${Math.min(...ns)}-${Math.max(...ns)}`
        : iss.key;
    return { key, issues: [iss] };
  });
}

export async function startBackgroundRevision(
  input: AnalyzeInput,
  config?: RevisionAgentConfig,
  callModel?: MockModelCaller,
  storedFeedback: FeedbackItem[] = [],
): Promise<{ runId: string; status: "dang-chay" }> {
  const runId = generateRunId();
  const startTime = Date.now();
  const abortController = new AbortController();

  const videoId = input.videoId ?? (input.scriptId === "d1" ? "d1" : "d1");
  const versionId = input.versionId ?? "v1";
  const runScope = {
    videoId,
    versionId,
    mode: (callModel ? "gia-lap" : "that") as "that" | "gia-lap",
  };

  const modelId = resolveRevisionModelId(config?.modelId);
  const graphVersion = "cp3-nodes@1";

  // Khởi tạo metadata ban đầu
  const initialMetadata: RunMetadata = {
    runId,
    status: "dang-chay",
    createdAt: new Date().toISOString(),
    inputHash: "",
    modelId,
    promptVersion: "revision-cp3@1",
    promptHash: "",
    schemaVersion: "hackathon-revision-agent/1",
    policyVersion: "cp3@1",
    graphVersion,
    attempts: [],
    totalFeedback: 0,
    newFeedbackCount: input.newFeedback ? input.newFeedback.length : 0,
    independentSenders: 0,
    caseCount: 0,
    durationMs: 0,
    caseId: input.caseId,
    ...runScope,
  };

  // Lưu vết ban đầu
  saveRunTrace({
    runId,
    metadata: initialMetadata,
    sanitizedInput: {
      videoId: runScope.videoId,
      versionId: runScope.versionId,
      includeD1Feedback: input.includeD1Feedback,
      newFeedback: input.newFeedback,
    },
    attempts: [],
  });

  // Đăng ký tiến trình chạy nền
  activeRuns.set(runId, {
    runId,
    abortController,
    startedAt: startTime,
    videoId,
    versionId,
  });

  // Ghi sự kiện bắt đầu đợt (AP-02)
  appendRunEvent(runId, {
    type: "run.started",
    runId,
    videoId,
    versionId,
    graphVersion,
  });

  // Chạy nền bất đồng bộ (không await ở đây để trả HTTP 202 ngay trong <1s)
  (async () => {
    try {
      // -------------------------------------------------------------
      // N1: Bắt đầu đợt
      // -------------------------------------------------------------
      appendRunEvent(runId, {
        type: "node.started",
        nodeId: "N1_BAT_DAU",
        nodeType: "N1_BAT_DAU",
        attempt: 1,
      });

      saveNodeDebugData(runId, {
        nodeId: "N1_BAT_DAU",
        nodeType: "N1_BAT_DAU",
        status: "xong",
        ms: 10,
        attempts: 1,
        input: { videoId, versionId },
        output: { valid: true },
      });

      appendRunEvent(runId, {
        type: "node.finished",
        nodeId: "N1_BAT_DAU",
        status: "xong",
        ms: 10,
        summary: "Đã xác thực video và phiên bản",
      });

      if (abortController.signal.aborted) return;

      // -------------------------------------------------------------
      // N2: Nạp ngữ cảnh
      // -------------------------------------------------------------
      const tN2 = Date.now();
      appendRunEvent(runId, {
        type: "node.started",
        nodeId: "N2_NAP_NGU_CANH",
        nodeType: "N2_NAP_NGU_CANH",
        attempt: 1,
      });

      const { script, allFeedback, feedbackForModel, inputHash } =
        prepareAnalyzeInput(input, undefined, storedFeedback);

      const msN2 = Date.now() - tN2;
      saveNodeDebugData(runId, {
        nodeId: "N2_NAP_NGU_CANH",
        nodeType: "N2_NAP_NGU_CANH",
        status: "xong",
        ms: msN2,
        attempts: 1,
        input: { videoId, versionId },
        output: {
          sentenceCount: script.cau.length,
          feedbackCount: allFeedback.length,
          inputHash,
        },
      });

      appendRunEvent(runId, {
        type: "node.finished",
        nodeId: "N2_NAP_NGU_CANH",
        status: "xong",
        ms: msN2,
        summary: `${script.cau.length} câu · ${allFeedback.length} góp ý`,
      });

      if (abortController.signal.aborted) return;

      // -------------------------------------------------------------
      // N3: Làm sạch & chặn (Luật tất định)
      // -------------------------------------------------------------
      const tN3 = Date.now();
      appendRunEvent(runId, {
        type: "node.started",
        nodeId: "N3_LAM_SACH_CHAN",
        nodeType: "N3_LAM_SACH_CHAN",
        attempt: 1,
      });

      const quarantined = allFeedback.filter((f) => f.isQuarantined);
      const scoreOnly = allFeedback.filter(
        (f) => !f.isQuarantined && f.label !== "gop-y",
      );
      const msN3 = Date.now() - tN3;

      saveNodeDebugData(runId, {
        nodeId: "N3_LAM_SACH_CHAN",
        nodeType: "N3_LAM_SACH_CHAN",
        status: "xong",
        ms: msN3,
        attempts: 1,
        input: { totalFeedback: allFeedback.length },
        output: {
          sentToModel: feedbackForModel.length,
          quarantined: quarantined.length,
          scoreOnly: scoreOnly.length,
        },
      });

      appendRunEvent(runId, {
        type: "node.finished",
        nodeId: "N3_LAM_SACH_CHAN",
        status: "xong",
        ms: msN3,
        summary: `${feedbackForModel.length} gửi model · ${quarantined.length} bị loại · ${scoreOnly.length} chỉ chấm điểm`,
      });

      if (abortController.signal.aborted) return;

      // C3-AG-10: Nếu không còn góp ý nào gửi model
      if (feedbackForModel.length === 0) {
        const checks: ValidationChecks = {
          schemaOk: true,
          feedbackCoverageOk: true,
          evidenceOk: true,
          locationsOk: true,
          patchesOk: true,
        };

        const emptyResult: RevisionRunResult = {
          runId,
          inputHash,
          script,
          feedback: allFeedback,
          issues: [],
          cases: [],
          validation: { findings: [], checks },
          unassignedFeedback: allFeedback.filter(
            (f) => !f.isQuarantined && f.label !== "gop-y",
          ),
          quarantinedFeedback: quarantined,
        };

        const finishMeta: RunMetadata = {
          ...initialMetadata,
          status: "xong",
          inputHash,
          checks,
          totalFeedback: allFeedback.length,
          independentSenders: new Set(allFeedback.map((f) => f.sender)).size,
          caseCount: 0,
          durationMs: Date.now() - startTime,
        };

        saveRunTrace({
          runId,
          metadata: finishMeta,
          sanitizedInput: { videoId, versionId, inputHash },
          attempts: [],
          result: emptyResult,
        });

        activeRuns.delete(runId);
        appendRunEvent(runId, {
          type: "run.finished",
          status: "xong",
          ms: Date.now() - startTime,
          totalTokens: 0,
        });
        return;
      }

      // -------------------------------------------------------------
      // P1 — N4+N6: Hiểu góp ý (phân loại + gom vấn đề). Không viết lời sửa,
      // nên prompt ngắn và trả sớm để UI hiện danh sách vùng trước.
      // -------------------------------------------------------------
      const tHieu = Date.now();
      appendRunEvent(runId, {
        type: "node.started",
        nodeId: "N4_PHAN_LOAI",
        nodeType: "N4_PHAN_LOAI",
        attempt: 1,
      });

      const agentScript = script.cau.map((c) => ({
        n: c.n,
        phan: c.phan,
        ...(c.loi ? { loi: c.loi } : {}),
        ...(c.dungGiay ? { dungGiay: `khoảng lặng ${c.dungGiay} giây` } : {}),
        ...(c.chuTrenManHinh ? { chuTrenManHinh: c.chuTrenManHinh } : {}),
        ...(c.yDoHinh ? { yDoHinh: c.yDoHinh } : {}),
      }));

      const agentFeedback = feedbackForModel.map((f) => ({
        id: f.id,
        channel: f.channel,
        sender: f.sender,
        text: f.sanitizedText,
        ...(f.survey ? { survey: f.survey } : {}),
        ...(f.location
          ? {
              viTriNguoiGuiChon: [
                f.location.sentenceN != null
                  ? `câu ${f.location.sentenceN}`
                  : "",
                f.location.timeSeconds != null
                  ? `mốc ${Math.floor(f.location.timeSeconds / 60)}:${String(
                      Math.floor(f.location.timeSeconds % 60),
                    ).padStart(2, "0")}`
                  : "",
              ]
                .filter(Boolean)
                .join(", "),
            }
          : {}),
      }));

      // P3: đầu vào y hệt lần trước thì dùng lại, không gọi model.
      const hieuCacheKey = {
        nodeType: "N4_PHAN_LOAI",
        promptHash: getPromptHashP1(REVISION_HIEU_SYSTEM_PROMPT),
        schemaVersion: "hackathon-revision-agent/1",
        input: { script: agentScript, feedback: agentFeedback },
      };
      const hieuCached = readNodeCache<RevisionHieuOutput>(hieuCacheKey);

      const hieuHeartbeat = setInterval(() => {
        appendRunEvent(runId, {
          type: "node.progress",
          nodeId: "N4_PHAN_LOAI",
          done: Math.round((Date.now() - tHieu) / 1000),
          total: 0,
          label: "Model đang phân loại góp ý",
        });
      }, 5000);

      let hieuRes: Awaited<
        ReturnType<typeof runRevisionStep<typeof RevisionHieuOutput>>
      >;
      try {
        hieuRes = hieuCached
          ? {
              ok: true,
              output: hieuCached.output,
              attempts: [],
              durationMs: 0,
              promptHash: hieuCacheKey.promptHash,
              modelId,
              totalTokens: 0,
            }
          : await runRevisionStep({
              systemPrompt: REVISION_HIEU_SYSTEM_PROMPT,
              userPayload: { script: agentScript, feedback: agentFeedback },
              schema: RevisionHieuOutput,
              config,
              stepLabel: "hiểu góp ý",
            });
      } finally {
        clearInterval(hieuHeartbeat);
      }

      if (hieuRes.ok && hieuRes.output && !hieuCached) {
        writeNodeCache(hieuCacheKey, hieuRes.output, runId);
      }

      const msHieu = Date.now() - tHieu;

      if (!hieuRes.ok || !hieuRes.output) {
        saveNodeDebugData(runId, {
          nodeId: "N4_PHAN_LOAI",
          nodeType: "N4_PHAN_LOAI",
          status: "loi",
          ms: msHieu,
          attempts: hieuRes.attempts.length,
          promptVersion: HIEU_PROMPT_VERSION,
          promptHash: hieuRes.promptHash,
          input: { feedbackCount: agentFeedback.length },
          error: hieuRes.error?.message,
        });
        appendRunEvent(runId, {
          type: "node.finished",
          nodeId: "N4_PHAN_LOAI",
          status: "loi",
          ms: msHieu,
          summary: `Lỗi gọi model: ${hieuRes.error?.message}`,
          errorCode: hieuRes.error?.code,
        });
        appendRunEvent(runId, {
          type: "run.failed",
          errorCode: hieuRes.error?.code || "MODEL_CALL_FAILED",
          message: hieuRes.error?.message || "Lỗi khi gọi model",
        });
        updateRunStatus(runId, "loi", hieuRes.error);
        activeRuns.delete(runId);
        return;
      }

      const hieuOutput = hieuRes.output;
      let totalModelTokens = hieuRes.totalTokens;

      saveNodeDebugData(runId, {
        nodeId: "N4_PHAN_LOAI",
        nodeType: "N4_PHAN_LOAI",
        status: "xong",
        ms: msHieu,
        attempts: hieuRes.attempts.length,
        promptVersion: HIEU_PROMPT_VERSION,
        promptHash: hieuRes.promptHash,
        tokens: {
          input: hieuRes.attempts.at(-1)?.inputTokens ?? 0,
          output: hieuRes.attempts.at(-1)?.outputTokens ?? 0,
        },
        // Lưu đủ input để màn Debug chạy lại đúng node này (plan §6).
        input: { script: agentScript, feedback: agentFeedback },
        output: hieuOutput,
      });

      appendRunEvent(runId, {
        type: "node.finished",
        nodeId: "N4_PHAN_LOAI",
        status: "xong",
        ms: msHieu,
        summary: `${hieuOutput.feedback.length} góp ý đã phân loại · ${hieuOutput.issues.length} vấn đề${
          hieuCached ? " (dùng lại kết quả đã lưu)" : ""
        }`,
      });

      appendRunEvent(runId, {
        type: "partial",
        kind: "feedback.labeled",
        payload: hieuOutput.feedback,
      });

      if (abortController.signal.aborted) return;

      // -------------------------------------------------------------
      // P1 — N8: Lập phương án theo từng vùng. Mỗi vùng một lời gọi riêng,
      // ngữ cảnh chỉ gồm câu của vùng ±2, nên lỗi một vùng không hỏng cả run.
      // -------------------------------------------------------------
      const nhomTheoVung = groupIssuesForOptions(hieuOutput.issues);
      const optionsByIssueKey = new Map<string, unknown[]>();

      // Chạy song song tối đa 3 để không bị giới hạn tốc độ gọi API (P2).
      const SONG_SONG = 3;
      let nextIndex = 0;
      const chayMotVung = async (idx: number) => {
        const nhom = nhomTheoVung[idx];
        if (abortController.signal.aborted) return;

        const nodeId = `N8_LAP_PHUONG_AN_${idx + 1}`;
        const tOpt = Date.now();
        appendRunEvent(runId, {
          type: "node.started",
          nodeId,
          nodeType: "N8_LAP_PHUONG_AN",
          iterationKey: nhom.key,
          attempt: 1,
        });

        const sentenceNs = new Set<number>();
        for (const iss of nhom.issues) {
          for (const n of iss.location.sentenceNs) {
            for (let k = n - 2; k <= n + 2; k++) sentenceNs.add(k);
          }
        }
        const sentences = agentScript.filter((c) => sentenceNs.has(c.n));

        const optHeartbeat = setInterval(() => {
          appendRunEvent(runId, {
            type: "node.progress",
            nodeId,
            done: Math.round((Date.now() - tOpt) / 1000),
            total: 0,
            label: `Model đang lập phương án (${idx + 1}/${nhomTheoVung.length})`,
          });
        }, 5000);

        // Chỉ lấy phần quyết định nội dung phương án. Bỏ "key" và các nhãn do
        // model tự đặt vì chúng đổi mỗi lần chạy, làm cache không bao giờ trúng.
        const optCacheKey = {
          nodeType: "N8_LAP_PHUONG_AN",
          promptHash: getPromptHashP1(REVISION_PHUONG_AN_SYSTEM_PROMPT),
          schemaVersion: "hackathon-revision-agent/1",
          input: {
            sentences,
            issues: nhom.issues.map((i) => ({
              category: i.category,
              feedbackIds: [...i.feedbackIds].sort(),
              sentenceNs: [...i.location.sentenceNs].sort((a, b) => a - b),
              locationStatus: i.location.status,
            })),
          },
        };
        const optCached = readNodeCache<RevisionPhuongAnOutput>(optCacheKey);

        let optRes: Awaited<
          ReturnType<typeof runRevisionStep<typeof RevisionPhuongAnOutput>>
        >;
        try {
          optRes = optCached
            ? {
                ok: true,
                output: optCached.output,
                attempts: [],
                durationMs: 0,
                promptHash: optCacheKey.promptHash,
                modelId,
                totalTokens: 0,
              }
            : await runRevisionStep({
                systemPrompt: REVISION_PHUONG_AN_SYSTEM_PROMPT,
                userPayload: { sentences, issues: nhom.issues },
                schema: RevisionPhuongAnOutput,
                config,
                stepLabel: `lập phương án vùng ${nhom.key}`,
              });
        } finally {
          clearInterval(optHeartbeat);
        }

        if (optRes.ok && optRes.output && !optCached) {
          writeNodeCache(optCacheKey, optRes.output, runId);
        }

        const msOpt = Date.now() - tOpt;
        totalModelTokens += optRes.totalTokens;

        if (optRes.ok && optRes.output) {
          // Không tin "issueKey" trong output: khi dùng lại cache, key của lần
          // chạy cũ không khớp key model vừa đặt, ghép theo nó sẽ trượt hết.
          // Mỗi lời gọi chỉ xử lý đúng một vấn đề nên gán thẳng theo vấn đề đó.
          const items = optRes.output.issueOptions;
          if (nhom.issues.length === 1 && items.length > 0) {
            optionsByIssueKey.set(nhom.issues[0].key, items[0].options);
          } else {
            for (const item of items) {
              const matched =
                nhom.issues.find((i) => i.key === item.issueKey) ??
                nhom.issues[items.indexOf(item)];
              if (matched) optionsByIssueKey.set(matched.key, item.options);
            }
          }
        }

        saveNodeDebugData(runId, {
          nodeId,
          nodeType: "N8_LAP_PHUONG_AN",
          status: optRes.ok ? "xong" : "loi",
          ms: msOpt,
          attempts: optRes.attempts.length,
          promptVersion: PHUONG_AN_PROMPT_VERSION,
          promptHash: optRes.promptHash,
          tokens: {
            input: optRes.attempts.at(-1)?.inputTokens ?? 0,
            output: optRes.attempts.at(-1)?.outputTokens ?? 0,
          },
          // Lưu đủ input để màn Debug chạy lại đúng node này (plan §6).
          input: { sentences, issues: nhom.issues },
          output: optRes.output,
          error: optRes.error?.message,
        });

        appendRunEvent(runId, {
          type: "node.finished",
          nodeId,
          status: optRes.ok ? "xong" : "loi",
          ms: msOpt,
          // Vùng lỗi chỉ mất phương án của vùng đó; các vùng khác vẫn dùng được.
          summary: optRes.ok
            ? `Vùng ${nhom.key}: ${optRes.output?.issueOptions.length ?? 0} vấn đề có phương án${
                optCached ? " (dùng lại kết quả đã lưu)" : ""
              }`
            : `Vùng ${nhom.key}: không lập được phương án (${optRes.error?.code})`,
          errorCode: optRes.error?.code,
        });

        appendRunEvent(runId, {
          type: "partial",
          kind: "options.ready",
          payload: { key: nhom.key, ok: optRes.ok },
        });
      };

      const workers = Array.from(
        { length: Math.min(SONG_SONG, nhomTheoVung.length) },
        async () => {
          while (nextIndex < nhomTheoVung.length) {
            const idx = nextIndex++;
            await chayMotVung(idx);
          }
        },
      );
      await Promise.all(workers);

      // Ghép lại thành đúng hình dạng output cũ để tái dùng validator và engine.
      const agentResult = {
        ok: true as const,
        output: {
          feedback: hieuOutput.feedback,
          issues: hieuOutput.issues.map((iss) => ({
            ...iss,
            options: (optionsByIssueKey.get(iss.key) ?? []) as never,
          })),
        },
        metadata: {
          modelId: hieuRes.modelId,
          promptVersion: HIEU_PROMPT_VERSION,
          promptHash: hieuRes.promptHash,
          schemaVersion: "hackathon-revision-agent/1",
          policyVersion: "cp3@1",
          attempts: hieuRes.attempts,
          totalTokens: totalModelTokens,
          durationMs: Date.now() - tHieu,
        },
      };

      if (abortController.signal.aborted) return;

      // -------------------------------------------------------------
      // V & N7: Kiểm tra & Lập hồ sơ vùng sửa (Code Validator)
      // -------------------------------------------------------------
      const tVal = Date.now();
      appendRunEvent(runId, {
        type: "node.started",
        nodeId: "V_KIEM_TRA_VA_GOM_VUNG",
        nodeType: "N7_CHIA_VUNG",
        attempt: 1,
      });

      const validationRes = validateRevisionOutput({
        agentOutput: agentResult.output,
        script,
        allFeedback,
      });

      const cases = buildDecisionCases(validationRes.issues, script);
      const msVal = Date.now() - tVal;

      // Phát sự kiện cases.ready để giao diện hiện danh sách vùng sớm (P0b/P1)
      appendRunEvent(runId, {
        type: "partial",
        kind: "cases.ready",
        payload: cases,
      });

      saveNodeDebugData(runId, {
        nodeId: "V_KIEM_TRA_VA_GOM_VUNG",
        nodeType: "N7_CHIA_VUNG",
        status: "xong",
        ms: msVal,
        attempts: 1,
        input: { issuesCount: validationRes.issues.length },
        output: { casesCount: cases.length, findings: validationRes.findings },
      });

      appendRunEvent(runId, {
        type: "node.finished",
        nodeId: "V_KIEM_TRA_VA_GOM_VUNG",
        status: "xong",
        ms: msVal,
        summary: `Đã chia ${cases.length} vùng sửa · kiểm tra code đạt`,
      });

      // -------------------------------------------------------------
      // N11: Tổng kết & Ghi kết quả
      // -------------------------------------------------------------
      const issueFeedbackIdSet = new Set<string>();
      for (const iss of validationRes.issues) {
        for (const fid of iss.feedbackIds) {
          issueFeedbackIdSet.add(fid);
        }
      }

      const result: RevisionRunResult = {
        runId,
        inputHash,
        script,
        feedback: validationRes.feedback,
        issues: validationRes.issues,
        cases,
        validation: {
          findings: validationRes.findings,
          checks: validationRes.checks,
        },
        unassignedFeedback: validationRes.feedback.filter(
          (f) => !f.isQuarantined && !issueFeedbackIdSet.has(f.id),
        ),
        quarantinedFeedback: validationRes.feedback.filter(
          (f) => f.isQuarantined,
        ),
      };

      const finalDuration = Date.now() - startTime;
      const finalMetadata: RunMetadata = {
        runId,
        status: "xong",
        createdAt: initialMetadata.createdAt,
        inputHash,
        modelId: agentResult.metadata.modelId,
        promptVersion: agentResult.metadata.promptVersion,
        promptHash: agentResult.metadata.promptHash,
        schemaVersion: agentResult.metadata.schemaVersion,
        policyVersion: agentResult.metadata.policyVersion,
        graphVersion,
        attempts: agentResult.metadata.attempts,
        checks: validationRes.checks,
        totalFeedback: allFeedback.length,
        newFeedbackCount: input.newFeedback ? input.newFeedback.length : 0,
        independentSenders: new Set(allFeedback.map((f) => f.sender)).size,
        caseCount: cases.length,
        durationMs: finalDuration,
        caseId: input.caseId,
        ...runScope,
      };

      saveRunTrace({
        runId,
        metadata: finalMetadata,
        sanitizedInput: {
          videoId: runScope.videoId,
          versionId: runScope.versionId,
          includeD1Feedback: input.includeD1Feedback,
          newFeedback: input.newFeedback,
          inputHash,
        },
        attempts: agentResult.metadata.attempts,
        result,
      });

      activeRuns.delete(runId);

      const totalTokens = agentResult.metadata.attempts.reduce(
        (sum, a) => sum + (a.totalTokens || 0),
        0,
      );

      appendRunEvent(runId, {
        type: "run.finished",
        status: "xong",
        ms: finalDuration,
        totalTokens,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      activeRuns.delete(runId);

      appendRunEvent(runId, {
        type: "run.failed",
        errorCode: "INTERNAL_ERROR",
        message: msg,
      });

      updateRunStatus(runId, "loi", { code: "INTERNAL_ERROR", message: msg });
    }
  })();

  return { runId, status: "dang-chay" };
}

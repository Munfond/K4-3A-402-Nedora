import {
  resolveRevisionModelId,
  type MockModelCaller,
  type RevisionAgentConfig,
  REVISION_HIEU_SYSTEM_PROMPT,
  REVISION_PHUONG_AN_SYSTEM_PROMPT,
  RevisionHieuOutput,
  RevisionPhuongAnOutput,
  HIEU_PROMPT_VERSION,
  PHUONG_AN_PROMPT_VERSION,
  runRevisionStep,
  getPromptHashP1,
} from "@feedback/ai/agents/revision";
import type {
  AnalyzeInput,
  FeedbackItem,
  RevisionRunResult,
  RunMetadata,
  ValidationChecks,
  RevisionOption,
} from "../types";
import { prepareAnalyzeInput } from "../load";
import {
  validateRevisionOutput,
  validateHieuOutput,
  validateCaseOptions,
} from "../validate";
import { lapHoSoVung } from "../cases";
import { generateRunId } from "../trace";
import { appendRunEvent, saveNodeDebugData } from "../events";
import { readNodeCache, writeNodeCache } from "../node-cache";
import { GRAPH_VERSION } from "./graph";
import type { RevisionStore } from "../store";
import { getDefaultStore } from "../store";

export interface PipelineDeps {
  store?: RevisionStore;
  config?: RevisionAgentConfig;
  callModel?: MockModelCaller;
  storedFeedback?: FeedbackItem[];
  packDir?: string;
}

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

function updateRunStatus(
  runId: string,
  status: "dang-chay" | "xong" | "loi",
  error?: { code: string; message: string },
  store: RevisionStore = getDefaultStore(),
) {
  const current = store.getRunById(runId);
  if (current?.run) {
    const updated: RunMetadata = {
      ...current.run,
      status,
      error: error || current.run.error,
    };
    store.saveRunTrace({
      runId,
      metadata: updated,
      sanitizedInput: current.sanitizedInput,
      attempts: current.attempts || [],
      result: current.result,
    });
  }
}

export function cancelRevisionRun(
  runId: string,
  store: RevisionStore = getDefaultStore(),
): boolean {
  const active = activeRuns.get(runId);
  if (!active) {
    const current = store.getRunById(runId);
    if (current?.run.status === "dang-chay") {
      updateRunStatus(
        runId,
        "loi",
        {
          code: "RUN_CANCELLED",
          message: "Đợt phân tích đã bị hủy",
        },
        store,
      );
      appendRunEvent(
        runId,
        {
          type: "run.failed",
          errorCode: "RUN_CANCELLED",
          message: "Đợt phân tích đã bị hủy",
        },
        undefined,
        store,
      );
      return true;
    }
    return false;
  }

  active.abortController.abort();
  activeRuns.delete(runId);

  appendRunEvent(
    runId,
    {
      type: "node.finished",
      nodeId: "lap-phuong-an",
      status: "loi",
      ms: Date.now() - active.startedAt,
      summary: "Đã dừng đợt phân tích do người dùng hủy",
      errorCode: "RUN_CANCELLED",
    },
    undefined,
    store,
  );

  appendRunEvent(
    runId,
    {
      type: "run.failed",
      errorCode: "RUN_CANCELLED",
      message: "Người dùng đã hủy đợt phân tích",
    },
    undefined,
    store,
  );

  updateRunStatus(
    runId,
    "loi",
    {
      code: "RUN_CANCELLED",
      message: "Người dùng đã hủy đợt phân tích",
    },
    store,
  );

  return true;
}

function normalizeDeps(
  depsOrConfig?: PipelineDeps | RevisionAgentConfig,
  callModel?: MockModelCaller,
  storedFeedback: FeedbackItem[] = [],
): PipelineDeps {
  if (!depsOrConfig) {
    return { callModel, storedFeedback };
  }
  if (
    "store" in depsOrConfig ||
    "packDir" in depsOrConfig ||
    "config" in depsOrConfig ||
    ("callModel" in depsOrConfig &&
      typeof (depsOrConfig as any).callModel === "function") ||
    ("storedFeedback" in depsOrConfig &&
      Array.isArray((depsOrConfig as any).storedFeedback))
  ) {
    return depsOrConfig as PipelineDeps;
  }
  return {
    config: depsOrConfig as RevisionAgentConfig,
    callModel,
    storedFeedback,
  };
}

export async function runPipeline(
  input: AnalyzeInput,
  depsOrConfig?: PipelineDeps | RevisionAgentConfig,
  callModelParam?: MockModelCaller,
  storedFeedbackParam: FeedbackItem[] = [],
): Promise<{ runId: string; status: "dang-chay" }> {
  const deps = normalizeDeps(depsOrConfig, callModelParam, storedFeedbackParam);
  const store = deps.store || getDefaultStore();
  const config = deps.config;
  const callModel = deps.callModel;
  const storedFeedback = deps.storedFeedback || [];
  const packTarget = deps.packDir || store;

  const runId = generateRunId();
  const startTime = Date.now();
  const abortController = new AbortController();

  const videoId = input.videoId ?? (input.scriptId === "d1" ? "d1" : "d1");
  const versionId = input.versionId ?? "v1";

  const isMockMode = Boolean(
    callModel ||
      (typeof process !== "undefined" &&
        process.env?.REVISION_MODEL_MODE === "mock"),
  );
  const runScope = {
    videoId,
    versionId,
    mode: (isMockMode ? "gia-lap" : "that") as "that" | "gia-lap",
  };

  const modelId = resolveRevisionModelId(config?.modelId);
  const graphVersion = GRAPH_VERSION;

  const initialMetadata: RunMetadata = {
    runId,
    status: "dang-chay",
    createdAt: new Date().toISOString(),
    inputHash: "",
    modelId,
    promptVersion: HIEU_PROMPT_VERSION,
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
    useCache: input.useCache !== false,
    ...runScope,
  };

  store.saveRunTrace({
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

  activeRuns.set(runId, {
    runId,
    abortController,
    startedAt: startTime,
    videoId,
    versionId,
  });

  appendRunEvent(
    runId,
    {
      type: "run.started",
      runId,
      videoId,
      versionId,
      graphVersion,
    },
    undefined,
    store,
  );

  (async () => {
    try {
      // -------------------------------------------------------------
      // Bước 1: nhan-dau-vao (Code)
      // -------------------------------------------------------------
      const tN1 = Date.now();
      appendRunEvent(
        runId,
        {
          type: "node.started",
          nodeId: "nhan-dau-vao",
          nodeType: "nhan-dau-vao",
          attempt: 1,
        },
        undefined,
        store,
      );

      const { script, allFeedback, feedbackForModel, inputHash } =
        prepareAnalyzeInput(input, packTarget, storedFeedback);
      // Không có góp ý nào thì run phải lỗi rõ, không được "xong" với kết quả rỗng.
      if (allFeedback.length === 0) {
        throw new Error(
          "NO_FEEDBACK: Không có góp ý nào để phân tích cho video/phiên bản này",
        );
      }

      const msN1 = Date.now() - tN1;
      saveNodeDebugData(
        runId,
        {
          nodeId: "nhan-dau-vao",
          nodeType: "nhan-dau-vao",
          status: "xong",
          ms: msN1,
          attempts: 1,
          input: { videoId, versionId },
          output: {
            sentenceCount: script.cau.length,
            feedbackCount: allFeedback.length,
            inputHash,
          },
        },
        store,
      );

      appendRunEvent(
        runId,
        {
          type: "node.finished",
          nodeId: "nhan-dau-vao",
          status: "xong",
          ms: msN1,
          summary: `${script.cau.length} câu · ${allFeedback.length} góp ý đã nạp`,
        },
        undefined,
        store,
      );

      if (abortController.signal.aborted) return;

      // -------------------------------------------------------------
      // Bước 2: lam-sach (Code)
      // -------------------------------------------------------------
      const tN2 = Date.now();
      appendRunEvent(
        runId,
        {
          type: "node.started",
          nodeId: "lam-sach",
          nodeType: "lam-sach",
          attempt: 1,
        },
        undefined,
        store,
      );

      const quarantined = allFeedback.filter((f) => f.isQuarantined);
      const scoreOnly = allFeedback.filter(
        (f) => !f.isQuarantined && f.label !== "gop-y",
      );
      const msN2 = Date.now() - tN2;

      saveNodeDebugData(
        runId,
        {
          nodeId: "lam-sach",
          nodeType: "lam-sach",
          status: "xong",
          ms: msN2,
          attempts: 1,
          input: { totalFeedback: allFeedback.length },
          output: {
            sentToModel: feedbackForModel.length,
            quarantined: quarantined.length,
            scoreOnly: scoreOnly.length,
          },
        },
        store,
      );

      appendRunEvent(
        runId,
        {
          type: "node.finished",
          nodeId: "lam-sach",
          status: "xong",
          ms: msN2,
          summary: `${feedbackForModel.length} gửi AI · ${quarantined.length} bị loại · ${scoreOnly.length} chỉ chấm điểm`,
        },
        undefined,
        store,
      );

      if (abortController.signal.aborted) return;

      // Nếu không có góp ý nào cần gửi AI
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

        store.saveRunTrace({
          runId,
          metadata: finishMeta,
          sanitizedInput: { videoId, versionId, inputHash },
          attempts: [],
          result: emptyResult,
        });

        activeRuns.delete(runId);
        appendRunEvent(
          runId,
          {
            type: "run.finished",
            status: "xong",
            ms: Date.now() - startTime,
            totalTokens: 0,
          },
          undefined,
          store,
        );
        return;
      }

      // -------------------------------------------------------------
      // Bước 3: hieu-gop-y (AI)
      // -------------------------------------------------------------
      const tHieu = Date.now();
      appendRunEvent(
        runId,
        {
          type: "node.started",
          nodeId: "hieu-gop-y",
          nodeType: "hieu-gop-y",
          attempt: 1,
        },
        undefined,
        store,
      );

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

      const hieuCacheKey = {
        nodeType: "hieu-gop-y",
        promptHash: getPromptHashP1(REVISION_HIEU_SYSTEM_PROMPT),
        schemaVersion: "hackathon-revision-agent/1",
        input: { script: agentScript, feedback: agentFeedback },
      };
      const hieuCached =
        input.useCache === false
          ? null
          : readNodeCache<RevisionHieuOutput>(hieuCacheKey, store);

      if (hieuCached) {
        appendRunEvent(
          runId,
          {
            type: "node.cache_hit",
            nodeId: "hieu-gop-y",
            sourceRunId: hieuCached.sourceRunId,
          },
          undefined,
          store,
        );
      }

      const hieuHeartbeat = setInterval(() => {
        appendRunEvent(
          runId,
          {
            type: "node.progress",
            nodeId: "hieu-gop-y",
            done: Math.round((Date.now() - tHieu) / 1000),
            total: 0,
            label: "Model đang phân loại góp ý",
          },
          undefined,
          store,
        );
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
              callModel,
            });
      } finally {
        clearInterval(hieuHeartbeat);
      }

      if (hieuRes.ok && hieuRes.output && !hieuCached) {
        writeNodeCache(hieuCacheKey, hieuRes.output, runId, store);
      }

      const msHieu = Date.now() - tHieu;

      if (!hieuRes.ok || !hieuRes.output) {
        saveNodeDebugData(
          runId,
          {
            nodeId: "hieu-gop-y",
            nodeType: "hieu-gop-y",
            status: "loi",
            ms: msHieu,
            attempts: hieuRes.attempts.length,
            promptVersion: HIEU_PROMPT_VERSION,
            promptHash: hieuRes.promptHash,
            input: { feedbackCount: agentFeedback.length },
            error: hieuRes.error?.message,
          },
          store,
        );
        appendRunEvent(
          runId,
          {
            type: "node.finished",
            nodeId: "hieu-gop-y",
            status: "loi",
            ms: msHieu,
            summary: `Lỗi gọi model: ${hieuRes.error?.message}`,
            errorCode: hieuRes.error?.code,
          },
          undefined,
          store,
        );
        appendRunEvent(
          runId,
          {
            type: "run.failed",
            errorCode: hieuRes.error?.code || "MODEL_CALL_FAILED",
            message: hieuRes.error?.message || "Lỗi khi gọi model",
          },
          undefined,
          store,
        );
        updateRunStatus(runId, "loi", hieuRes.error, store);
        activeRuns.delete(runId);
        return;
      }

      const hieuOutput = hieuRes.output;
      let totalModelTokens = hieuRes.totalTokens;

      saveNodeDebugData(
        runId,
        {
          nodeId: "hieu-gop-y",
          nodeType: "hieu-gop-y",
          status: "xong",
          ms: msHieu,
          attempts: hieuRes.attempts.length,
          promptVersion: HIEU_PROMPT_VERSION,
          promptHash: hieuRes.promptHash,
          tokens: {
            input: hieuRes.attempts.at(-1)?.inputTokens ?? 0,
            output: hieuRes.attempts.at(-1)?.outputTokens ?? 0,
          },
          input: { script: agentScript, feedback: agentFeedback },
          output: hieuOutput,
        },
        store,
      );

      appendRunEvent(
        runId,
        {
          type: "node.finished",
          nodeId: "hieu-gop-y",
          status: "xong",
          ms: msHieu,
          summary: `${hieuOutput.feedback.length} góp ý đã phân loại · ${hieuOutput.issues.length} vấn đề${
            hieuCached ? " (dùng lại kết quả trước)" : ""
          }`,
        },
        undefined,
        store,
      );

      appendRunEvent(
        runId,
        {
          type: "partial",
          kind: "feedback.labeled",
          payload: hieuOutput.feedback,
        },
        undefined,
        store,
      );

      if (abortController.signal.aborted) return;

      // -------------------------------------------------------------
      // Bước 4: kiem-tra-hieu (Code)
      // -------------------------------------------------------------
      const tCheck = Date.now();
      appendRunEvent(
        runId,
        {
          type: "node.started",
          nodeId: "kiem-tra-hieu",
          nodeType: "kiem-tra-hieu",
          attempt: 1,
        },
        undefined,
        store,
      );

      const hieuValidation = validateHieuOutput({
        hieuOutput,
        script,
        allFeedback,
      });

      const msCheck = Date.now() - tCheck;
      saveNodeDebugData(
        runId,
        {
          nodeId: "kiem-tra-hieu",
          nodeType: "kiem-tra-hieu",
          status: "xong",
          ms: msCheck,
          attempts: 1,
          input: { rawIssuesCount: hieuOutput.issues.length },
          output: { validIssuesCount: hieuValidation.issues.length },
        },
        store,
      );

      appendRunEvent(
        runId,
        {
          type: "node.finished",
          nodeId: "kiem-tra-hieu",
          status: "xong",
          ms: msCheck,
          summary: `${hieuValidation.issues.length} vấn đề hợp lệ sau kiểm tra`,
        },
        undefined,
        store,
      );

      if (abortController.signal.aborted) return;

      // -------------------------------------------------------------
      // Bước 5: lap-ho-so (Code) -> PHÁT cases.ready SỚM TẠI ĐÂY (R0.3, AR-03)
      // -------------------------------------------------------------
      const tHoSo = Date.now();
      appendRunEvent(
        runId,
        {
          type: "node.started",
          nodeId: "lap-ho-so",
          nodeType: "lap-ho-so",
          attempt: 1,
        },
        undefined,
        store,
      );

      const cases = lapHoSoVung(hieuValidation.issues, script);
      const msHoSo = Date.now() - tHoSo;

      saveNodeDebugData(
        runId,
        {
          nodeId: "lap-ho-so",
          nodeType: "lap-ho-so",
          status: "xong",
          ms: msHoSo,
          attempts: 1,
          input: { issuesCount: hieuValidation.issues.length },
          output: { casesCount: cases.length },
        },
        store,
      );

      appendRunEvent(
        runId,
        {
          type: "node.finished",
          nodeId: "lap-ho-so",
          status: "xong",
          ms: msHoSo,
          summary: `Đã chia ${cases.length} vùng sửa`,
        },
        undefined,
        store,
      );

      appendRunEvent(
        runId,
        {
          type: "partial",
          kind: "cases.ready",
          payload: cases,
        },
        undefined,
        store,
      );

      if (abortController.signal.aborted) return;

      // -------------------------------------------------------------
      // Bước 6: lap-phuong-an (Iteration)
      // -------------------------------------------------------------
      const tPhuongAn = Date.now();
      appendRunEvent(
        runId,
        {
          type: "node.started",
          nodeId: "lap-phuong-an",
          nodeType: "lap-phuong-an",
          attempt: 1,
        },
        undefined,
        store,
      );

      const SONG_SONG = 3;
      let nextCaseIndex = 0;

      const chayMotVung = async (caseIdx: number) => {
        const caseItem = cases[caseIdx];
        if (abortController.signal.aborted) return;

        const iterationKey = caseItem.id;
        const sentenceNs = new Set<number>();
        for (const iss of caseItem.issues) {
          for (const n of iss.location.sentenceNs) {
            for (let k = n - 2; k <= n + 2; k++) sentenceNs.add(k);
          }
        }
        if (sentenceNs.size === 0) {
          for (const n of caseItem.sentenceNs) {
            for (let k = n - 2; k <= n + 2; k++) sentenceNs.add(k);
          }
        }
        const sentences = agentScript.filter((c) => sentenceNs.has(c.n));

        let attempt = 1;
        const MAX_ATTEMPTS = 3;
        let lastErrors: string[] = [];
        let validatedOptionsForCase: RevisionOption[] = [];

        while (attempt <= MAX_ATTEMPTS) {
          if (abortController.signal.aborted) return;

          const tDeXuat = Date.now();
          appendRunEvent(
            runId,
            {
              type: "node.started",
              nodeId: "de-xuat",
              nodeType: "de-xuat",
              parentId: "lap-phuong-an",
              iterationKey,
              attempt,
            },
            undefined,
            store,
          );

          const optCacheKey = {
            nodeType: "de-xuat",
            promptHash: getPromptHashP1(REVISION_PHUONG_AN_SYSTEM_PROMPT),
            schemaVersion: "hackathon-revision-agent/1",
            input: {
              iterationKey,
              sentences,
              issues: caseItem.issues.map((i) => ({
                category: i.category,
                feedbackIds: [...i.feedbackIds].sort(),
                sentenceNs: [...i.location.sentenceNs].sort((a, b) => a - b),
                locationStatus: i.location.status,
              })),
              attemptErrors: lastErrors,
            },
          };
          const optCached =
            input.useCache === false
              ? null
              : readNodeCache<RevisionPhuongAnOutput>(optCacheKey, store);

          if (optCached) {
            appendRunEvent(
              runId,
              {
                type: "node.cache_hit",
                nodeId: "de-xuat",
                iterationKey,
                sourceRunId: optCached.sourceRunId,
              },
              undefined,
              store,
            );
          }

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
                  userPayload: {
                    sentences,
                    issues: caseItem.issues,
                    ...(lastErrors.length > 0
                      ? { _loiKiemTraLanTruoc: lastErrors }
                      : {}),
                  },
                  schema: RevisionPhuongAnOutput,
                  config,
                  stepLabel: `lập phương án vùng ${iterationKey} (lần ${attempt})`,
                  callModel,
                });
          } catch (e: any) {
            optRes = {
              ok: false,
              attempts: [],
              durationMs: Date.now() - tDeXuat,
              promptHash: optCacheKey.promptHash,
              modelId,
              totalTokens: 0,
              error: {
                code: "MODEL_CALL_FAILED",
                message: e?.message || "Lỗi gọi model",
              },
            };
          }

          if (optRes.ok && optRes.output && !optCached) {
            writeNodeCache(optCacheKey, optRes.output, runId, store);
          }

          const msDeXuat = Date.now() - tDeXuat;
          totalModelTokens += optRes.totalTokens;

          saveNodeDebugData(
            runId,
            {
              nodeId: `de-xuat:${iterationKey}:att${attempt}`,
              nodeType: "de-xuat",
              status: optRes.ok ? "xong" : "loi",
              ms: msDeXuat,
              attempts: attempt,
              promptVersion: PHUONG_AN_PROMPT_VERSION,
              promptHash: optRes.promptHash,
              tokens: {
                input: optRes.attempts.at(-1)?.inputTokens ?? 0,
                output: optRes.attempts.at(-1)?.outputTokens ?? 0,
              },
              input: { sentences, issues: caseItem.issues, lastErrors },
              output: optRes.output,
              error: optRes.error?.message,
            },
            store,
          );

          appendRunEvent(
            runId,
            {
              type: "node.finished",
              nodeId: "de-xuat",
              iterationKey,
              status: optRes.ok ? "xong" : "loi",
              ms: msDeXuat,
              summary: optRes.ok
                ? `Vùng ${iterationKey}: sinh xong phương án`
                : `Vùng ${iterationKey}: lỗi sinh phương án (${optRes.error?.code})`,
              errorCode: optRes.error?.code,
            },
            undefined,
            store,
          );

          // -------------------------------------------------------------
          // 6.b: kiem-tra-de-xuat (Code)
          // -------------------------------------------------------------
          const tKiemTra = Date.now();
          appendRunEvent(
            runId,
            {
              type: "node.started",
              nodeId: "kiem-tra-de-xuat",
              nodeType: "kiem-tra-de-xuat",
              parentId: "lap-phuong-an",
              iterationKey,
              attempt,
            },
            undefined,
            store,
          );

          const rawOptions =
            optRes.ok && optRes.output
              ? optRes.output.issueOptions.flatMap((io) => io.options)
              : [];

          const valResult = validateCaseOptions({
            caseDraft: caseItem,
            rawOptions,
            script,
          });

          const msKiemTra = Date.now() - tKiemTra;

          if (!valResult.valid && attempt < MAX_ATTEMPTS) {
            lastErrors = valResult.errors;
            appendRunEvent(
              runId,
              {
                type: "node.retry",
                nodeId: "de-xuat",
                iterationKey,
                attempt: attempt + 1,
                reason: lastErrors.join("; "),
              },
              undefined,
              store,
            );
            attempt++;
            continue;
          }

          validatedOptionsForCase = valResult.options;

          appendRunEvent(
            runId,
            {
              type: "node.finished",
              nodeId: "kiem-tra-de-xuat",
              iterationKey,
              status: valResult.valid ? "xong" : "loi",
              ms: msKiemTra,
              summary: valResult.valid
                ? `Vùng ${iterationKey}: kiểm tra đạt (${valResult.options.length} phương án)`
                : `Vùng ${iterationKey}: lỗi patch không khắc phục được (${valResult.errors.join(", ")})`,
            },
            undefined,
            store,
          );

          break;
        }

        // -------------------------------------------------------------
        // 6.c: tinh-pham-vi (Code)
        // -------------------------------------------------------------
        const tPhamVi = Date.now();
        appendRunEvent(
          runId,
          {
            type: "node.started",
            nodeId: "tinh-pham-vi",
            nodeType: "tinh-pham-vi",
            parentId: "lap-phuong-an",
            iterationKey,
            attempt: 1,
          },
          undefined,
          store,
        );

        const msPhamVi = Date.now() - tPhamVi;
        appendRunEvent(
          runId,
          {
            type: "node.finished",
            nodeId: "tinh-pham-vi",
            iterationKey,
            status: "xong",
            ms: msPhamVi,
            summary: `Đã tính phạm vi tác động vùng ${iterationKey}`,
          },
          undefined,
          store,
        );

        caseItem.options = validatedOptionsForCase;
        caseItem.status = "xong";

        for (const iss of caseItem.issues) {
          iss.options = validatedOptionsForCase;
        }

        appendRunEvent(
          runId,
          {
            type: "partial",
            kind: "case.options.ready",
            payload: { caseId: caseItem.id, options: validatedOptionsForCase },
          },
          undefined,
          store,
        );

        appendRunEvent(
          runId,
          {
            type: "partial",
            kind: "options.ready",
            payload: { key: caseItem.id, ok: true },
          },
          undefined,
          store,
        );
      };

      const workers = Array.from(
        { length: Math.min(SONG_SONG, cases.length) },
        async () => {
          while (nextCaseIndex < cases.length) {
            const idx = nextCaseIndex++;
            await chayMotVung(idx);
          }
        },
      );
      await Promise.all(workers);

      const msPhuongAn = Date.now() - tPhuongAn;
      appendRunEvent(
        runId,
        {
          type: "node.finished",
          nodeId: "lap-phuong-an",
          status: "xong",
          ms: msPhuongAn,
          summary: `${cases.length} vùng đã xong phương án`,
        },
        undefined,
        store,
      );

      if (abortController.signal.aborted) return;

      // -------------------------------------------------------------
      // Lưới an toàn: Validator tổng ở cuối
      // -------------------------------------------------------------
      const allIssues = cases.flatMap((c) => c.issues);
      const validationRes = validateRevisionOutput({
        agentOutput: {
          feedback: hieuOutput.feedback,
          issues: allIssues.map((iss) => ({
            key: iss.key,
            summary: iss.summary,
            category: iss.category,
            feedbackIds: iss.feedbackIds,
            location: iss.location,
            stances: iss.stances,
            uncertainties: iss.uncertainties,
            causeHypothesis: iss.causeHypothesis,
            impact: iss.impact,
            options: iss.options.map((opt) => ({
              label: opt.label,
              title: opt.title,
              rationale: opt.rationale,
              patches: opt.patches,
              expectedEffect: opt.expectedEffect,
              remaining: opt.remaining,
              needsHumanCheck: opt.needsHumanCheck,
              unsupportedOperation: opt.unsupportedOperation as any,
            })),
          })),
        },
        script,
        allFeedback,
      });

      // -------------------------------------------------------------
      // Bước 7: cho-duyet (Human)
      // -------------------------------------------------------------
      appendRunEvent(
        runId,
        {
          type: "node.started",
          nodeId: "cho-duyet",
          nodeType: "cho-duyet",
          attempt: 1,
        },
        undefined,
        store,
      );

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
        modelId,
        promptVersion: HIEU_PROMPT_VERSION,
        promptHash: hieuRes.promptHash,
        schemaVersion: "hackathon-revision-agent/1",
        policyVersion: "cp3@1",
        graphVersion,
        attempts: hieuRes.attempts,
        checks: validationRes.checks,
        totalFeedback: allFeedback.length,
        newFeedbackCount: input.newFeedback ? input.newFeedback.length : 0,
        independentSenders: new Set(allFeedback.map((f) => f.sender)).size,
        caseCount: cases.length,
        durationMs: finalDuration,
        caseId: input.caseId,
        ...runScope,
      };

      store.saveRunTrace({
        runId,
        metadata: finalMetadata,
        sanitizedInput: {
          videoId: runScope.videoId,
          versionId: runScope.versionId,
          includeD1Feedback: input.includeD1Feedback,
          newFeedback: input.newFeedback,
          inputHash,
        },
        attempts: hieuRes.attempts,
        result,
      });

      activeRuns.delete(runId);

      appendRunEvent(
        runId,
        {
          type: "run.finished",
          status: "xong",
          ms: finalDuration,
          totalTokens: totalModelTokens,
        },
        undefined,
        store,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      activeRuns.delete(runId);
      const errorCode =
        /^([A-Z][A-Z0-9_]{2,}):/.exec(msg)?.[1] ?? "INTERNAL_ERROR";

      appendRunEvent(
        runId,
        {
          type: "run.failed",
          errorCode,
          message: msg,
        },
        undefined,
        store,
      );

      updateRunStatus(runId, "loi", { code: errorCode, message: msg }, store);
    }
  })();

  return { runId, status: "dang-chay" };
}

export const startBackgroundRevision = runPipeline;

export async function runPipelineToCompletion(
  input: AnalyzeInput,
  depsOrConfig?: PipelineDeps | RevisionAgentConfig,
  callModelParam?: MockModelCaller,
  storedFeedbackParam: FeedbackItem[] = [],
): Promise<RevisionRunResult> {
  const deps = normalizeDeps(depsOrConfig, callModelParam, storedFeedbackParam);
  const store = deps.store || getDefaultStore();
  const { runId } = await runPipeline(input, deps);

  return new Promise<RevisionRunResult>((resolve, reject) => {
    const timer = setInterval(() => {
      const current = store.getRunById(runId);
      if (!current) return;
      if (current.run.status === "xong") {
        clearInterval(timer);
        if (current.result) {
          resolve(current.result);
        } else {
          reject(new Error("Run xong nhưng không tìm thấy kết quả"));
        }
      } else if (current.run.status === "loi") {
        clearInterval(timer);
        const err = new Error(current.run.error?.message || "Lỗi pipeline");
        (err as any).code = current.run.error?.code;
        (err as any).runId = runId;
        reject(err);
      }
    }, 100);
  });
}

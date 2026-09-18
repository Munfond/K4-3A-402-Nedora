import { createOpenAI } from "@ai-sdk/openai";
import { Output, generateText, gateway, type LanguageModel } from "ai";
import {
  PROMPT_VERSION,
  REVISION_SYSTEM_PROMPT,
  getPromptHash,
} from "./prompt";
import {
  RevisionAgentOutput,
  type AgentFeedbackItem,
  type AgentIssue,
} from "./schema";

export * from "./schema";
export * from "./prompt";
export * from "./prompt-p1";
export * from "./schema-p1";
export * from "./run-step";
export * from "./v3/schema-v3";
export * from "./v3/prompt-sua-loi";
export * from "./v3/prompt-an-toan";
export * from "./v3/prompt-tach-y";
export * from "./v3/schema-claims";

export interface RevisionAgentScriptSentence {
  n: number;
  phan: number;
  loi?: string;
  dungGiay?: number;
  chuTrenManHinh?: string;
  yDoHinh?: string;
  kieu?: string;
}

export interface RevisionAgentFeedbackInput {
  id: string;
  channel: string;
  sender: string;
  text: string;
  survey?: {
    deHieu?: number;
    nhipDo?: number;
    diemSo?: number;
  };
  /** Vị trí do chính người gửi chọn, không phải AI suy ra. */
  location?: { sentenceN?: number; timeSeconds?: number };
}

export interface RevisionAgentInput {
  script: RevisionAgentScriptSentence[];
  feedback: RevisionAgentFeedbackInput[];
  caseId?: string;
}

export interface RevisionAgentConfig {
  modelId?: string;
  timeoutMs?: number;
  maxOutputTokens?: number;
  temperature?: number;
}

export interface RevisionAttemptRecord {
  attemptNumber: number;
  status: "xong" | "loi";
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  errorCode?: string;
  errorMessage?: string;
  rawOutput?: unknown;
}

export interface RevisionAgentMetadata {
  modelId: string;
  promptVersion: string;
  promptHash: string;
  schemaVersion: string;
  policyVersion: string;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
  attempts: RevisionAttemptRecord[];
  totalTokens: number;
  durationMs: number;
  caseId?: string;
}

export type RevisionErrorCode =
  | "MODEL_NOT_CONFIGURED"
  | "MODEL_AUTH_FAILED"
  | "MODEL_TIMEOUT"
  | "MODEL_CALL_FAILED"
  | "OUTPUT_SCHEMA_INVALID";

export interface RevisionAgentError {
  code: RevisionErrorCode;
  message: string;
}

export type RevisionAgentResult =
  | {
      ok: true;
      output: RevisionAgentOutput;
      metadata: RevisionAgentMetadata;
    }
  | {
      ok: false;
      error: RevisionAgentError;
      metadata: RevisionAgentMetadata;
    };

export type MockModelCaller = (params: {
  system: string;
  prompt: string;
  attempt: number;
  previousError?: string;
  timeoutMs: number;
}) => Promise<unknown>;

function formatLocation(location: {
  sentenceN?: number;
  timeSeconds?: number;
}): string {
  const parts: string[] = [];
  if (location.sentenceN != null) parts.push(`câu ${location.sentenceN}`);
  if (location.timeSeconds != null) {
    const s = Math.floor(location.timeSeconds);
    parts.push(
      `mốc ${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`,
    );
  }
  return `người gửi chọn ${parts.join(", ")}`;
}

function serializePromptInput(
  input: RevisionAgentInput,
  previousError?: string,
): string {
  const payload: Record<string, unknown> = {
    script: input.script.map((s) => ({
      n: s.n,
      phan: s.phan,
      ...(s.loi ? { loi: s.loi } : {}),
      ...(s.dungGiay ? { dungGiay: `khoảng lặng ${s.dungGiay} giây` } : {}),
      ...(s.chuTrenManHinh ? { chuTrenManHinh: s.chuTrenManHinh } : {}),
      ...(s.yDoHinh ? { yDoHinh: s.yDoHinh } : {}),
    })),
    feedback: input.feedback.map((f) => ({
      id: f.id,
      channel: f.channel,
      sender: f.sender,
      text: f.text,
      ...(f.survey ? { survey: f.survey } : {}),
      ...(f.location ? { viTriNguoiGuiChon: formatLocation(f.location) } : {}),
    })),
  };

  if (previousError) {
    payload._suaLoiLanTruoc = {
      thongBao:
        "Lần gọi trước gặp lỗi sau đây. Hãy sửa định dạng và khắc phục chính xác các lỗi này để khớp schema.",
      chiTietLoi: previousError,
    };
  }

  return JSON.stringify(payload, null, 2);
}

export function classifyRevisionError(err: unknown): {
  code: RevisionErrorCode;
  message: string;
  isRetryable: boolean;
} {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  const statusCode =
    err && typeof err === "object" && "statusCode" in err
      ? Number((err as { statusCode?: unknown }).statusCode)
      : undefined;

  // Provider từ chối request (ví dụ schema không hợp lệ với json_schema chặt):
  // gửi lại y hệt cũng lỗi, nên không retry và không gọi là lỗi output.
  if (statusCode === 400 || statusCode === 404 || statusCode === 422) {
    return {
      code: "MODEL_CALL_FAILED",
      message: `Provider từ chối request (HTTP ${statusCode}): ${msg}`,
      isRetryable: false,
    };
  }

  if (
    lower.includes("timeout") ||
    lower.includes("aborted") ||
    lower.includes("deadline exceeded")
  ) {
    return {
      code: "MODEL_TIMEOUT",
      message: `Quá thời gian chờ gọi model (${msg})`,
      isRetryable: true,
    };
  }

  if (
    statusCode === 401 ||
    statusCode === 403 ||
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden") ||
    lower.includes("api key")
  ) {
    return {
      code: "MODEL_AUTH_FAILED",
      message: "Xác thực với dịch vụ AI Gateway/Model thất bại (401/403)",
      isRetryable: false,
    };
  }

  if (
    lower.includes("schema") ||
    lower.includes("json") ||
    lower.includes("validation") ||
    lower.includes("parse") ||
    lower.includes("noobjectgeneratederror") ||
    lower.includes("nooutputgeneratederror")
  ) {
    return {
      code: "OUTPUT_SCHEMA_INVALID",
      message: `Dữ liệu đầu ra của model không khớp schema quy định: ${msg}`,
      isRetryable: true,
    };
  }

  return {
    code: "MODEL_CALL_FAILED",
    message: `Gọi model thất bại: ${msg}`,
    isRetryable: true,
  };
}

export function isReasoningModelId(modelId: string): boolean {
  const name = modelId.split("/").pop() ?? "";
  return /^(gpt-5|o\d)/i.test(name);
}

/** REVISION_MODEL; nếu trống thì lấy model đầu tiên trong OPENAI_MODELS (danh sách cách nhau bởi dấu phẩy). */
export function resolveRevisionModelId(explicit?: string): string {
  if (explicit) return explicit;
  if (process.env.REVISION_MODEL) return process.env.REVISION_MODEL;
  const firstOpenAiModel = process.env.OPENAI_MODELS?.split(",")[0]?.trim();
  return firstOpenAiModel ? `openai/${firstOpenAiModel}` : "";
}

/**
 * Có khóa AI Gateway thì đi qua gateway như các agent khác trong repo;
 * không có thì gọi thẳng OpenAI bằng OPENAI_API_KEY (chỉ cho model "openai/…").
 */
export function resolveLanguageModelForRevision(
  modelId: string,
): LanguageModel | null {
  if (process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN) {
    return gateway(modelId) as LanguageModel;
  }
  if (process.env.OPENAI_API_KEY) {
    const [provider, ...rest] = modelId.split("/");
    const name = rest.length > 0 ? rest.join("/") : provider;
    if (rest.length > 0 && provider !== "openai") return null;
    return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(name);
  }
  return null;
}

export async function runRevisionAgent(params: {
  input: RevisionAgentInput;
  config?: RevisionAgentConfig;
  callModel?: MockModelCaller;
}): Promise<RevisionAgentResult> {
  const { input, config = {}, callModel } = params;

  const modelId = resolveRevisionModelId(config.modelId);
  const timeoutMs =
    config.timeoutMs ??
    // Run D1 thật mất 70–80 s; 90 s cũ quá sát.
    (Number(process.env.REVISION_MODEL_TIMEOUT_MS) || 150000);
  const maxOutputTokens =
    config.maxOutputTokens ??
    (Number(process.env.REVISION_MAX_OUTPUT_TOKENS) || 16000);
  const temperature = config.temperature ?? 0;
  const promptHash = getPromptHash(REVISION_SYSTEM_PROMPT);

  const attempts: RevisionAttemptRecord[] = [];
  const startAll = Date.now();

  const metadata: RevisionAgentMetadata = {
    modelId,
    promptVersion: PROMPT_VERSION,
    promptHash,
    schemaVersion: "hackathon-revision-agent/1",
    policyVersion: "cp3@1",
    temperature,
    maxOutputTokens,
    timeoutMs,
    attempts,
    totalTokens: 0,
    durationMs: 0,
    caseId: input.caseId,
  };

  // C3-AG-10: Nếu không có góp ý nào để gửi -> không gọi model, xong với modelCalls: 0
  if (input.feedback.length === 0) {
    metadata.durationMs = Date.now() - startAll;
    return {
      ok: true,
      output: { feedback: [], issues: [] },
      metadata,
    };
  }

  // Kiểm tra cấu hình môi trường nếu không có mock
  let languageModel: LanguageModel | null = null;
  if (!callModel) {
    if (!modelId) {
      metadata.durationMs = Date.now() - startAll;
      return {
        ok: false,
        error: {
          code: "MODEL_NOT_CONFIGURED",
          message:
            "Chưa chọn model: đặt REVISION_MODEL (hoặc OPENAI_MODELS) trên server",
        },
        metadata,
      };
    }
    languageModel = resolveLanguageModelForRevision(modelId);
    if (!languageModel) {
      metadata.durationMs = Date.now() - startAll;
      return {
        ok: false,
        error: {
          code: "MODEL_NOT_CONFIGURED",
          message: `Không có khóa dùng được cho model ${modelId}: cần AI_GATEWAY_API_KEY, hoặc OPENAI_API_KEY với model openai/…`,
        },
        metadata,
      };
    }
  }

  let lastError: { code: RevisionErrorCode; message: string } | null = null;
  const maxAttempts = 2; // Tối đa 2 lần gọi (1 lần thử + 1 lần retry)

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const startAttempt = Date.now();
    const promptText = serializePromptInput(input, lastError?.message);

    try {
      let parsedOutput: RevisionAgentOutput;
      let inputTokens = 0;
      let outputTokens = 0;
      let rawResult: unknown = null;

      if (callModel) {
        // Tiêm mock model caller trong kiểm thử tự động
        rawResult = await callModel({
          system: REVISION_SYSTEM_PROMPT,
          prompt: promptText,
          attempt,
          previousError: lastError?.message,
          timeoutMs,
        });

        const parseRes = RevisionAgentOutput.safeParse(rawResult);
        if (!parseRes.success) {
          throw new Error(
            parseRes.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; "),
          );
        }
        parsedOutput = parseRes.data;
      } else if (languageModel) {
        const result = await generateText({
          model: languageModel,
          system: REVISION_SYSTEM_PROMPT,
          prompt: promptText,
          output: Output.object({ schema: RevisionAgentOutput }),
          abortSignal: AbortSignal.timeout(timeoutMs),
          maxOutputTokens,
          // Model suy luận (gpt-5*, o*) không nhận temperature; gửi vào chỉ sinh cảnh báo.
          ...(isReasoningModelId(modelId) ? {} : { temperature }),
        });

        parsedOutput = result.output;
        rawResult = result.output;
        inputTokens = result.usage?.inputTokens ?? 0;
        outputTokens = result.usage?.outputTokens ?? 0;
      } else {
        throw new Error("Chưa có model để gọi");
      }

      const dur = Date.now() - startAttempt;
      attempts.push({
        attemptNumber: attempt,
        status: "xong",
        durationMs: dur,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        rawOutput: rawResult,
      });

      metadata.totalTokens += inputTokens + outputTokens;
      metadata.durationMs = Date.now() - startAll;

      return {
        ok: true,
        output: parsedOutput,
        metadata,
      };
    } catch (err: unknown) {
      const dur = Date.now() - startAttempt;
      const classified = classifyRevisionError(err);
      lastError = classified;

      attempts.push({
        attemptNumber: attempt,
        status: "loi",
        durationMs: dur,
        errorCode: classified.code,
        errorMessage: classified.message,
      });

      // Nếu không cho phép retry (ví dụ lỗi xác thực 401/403) thì dừng ngay
      if (!classified.isRetryable || attempt >= maxAttempts) {
        break;
      }
    }
  }

  metadata.durationMs = Date.now() - startAll;
  return {
    ok: false,
    error: lastError ?? {
      code: "MODEL_CALL_FAILED",
      message: "Không thể nhận kết quả từ model sau 2 lần gọi",
    },
    metadata,
  };
}

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

function classifyError(err: unknown): {
  code: RevisionErrorCode;
  message: string;
  isRetryable: boolean;
} {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

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

export async function runRevisionAgent(params: {
  input: RevisionAgentInput;
  config?: RevisionAgentConfig;
  callModel?: MockModelCaller;
}): Promise<RevisionAgentResult> {
  const { input, config = {}, callModel } = params;

  const modelId = config.modelId || process.env.REVISION_MODEL || "";
  const timeoutMs = config.timeoutMs ?? 90000;
  const maxOutputTokens = config.maxOutputTokens ?? 8000;
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
  if (!callModel) {
    if (!modelId) {
      metadata.durationMs = Date.now() - startAll;
      return {
        ok: false,
        error: {
          code: "MODEL_NOT_CONFIGURED",
          message:
            "Biến môi trường REVISION_MODEL chưa được thiết lập trên server",
        },
        metadata,
      };
    }
    const hasApiKey = Boolean(
      process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY,
    );
    if (!hasApiKey) {
      metadata.durationMs = Date.now() - startAll;
      return {
        ok: false,
        error: {
          code: "MODEL_NOT_CONFIGURED",
          message:
            "Biến môi trường AI_GATEWAY_API_KEY hoặc OPENAI_API_KEY chưa được thiết lập trên server",
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
      } else {
        const model = gateway(modelId) as LanguageModel;
        const result = await generateText({
          model,
          system: REVISION_SYSTEM_PROMPT,
          prompt: promptText,
          output: Output.object({ schema: RevisionAgentOutput }),
          abortSignal: AbortSignal.timeout(timeoutMs),
          temperature,
        });

        parsedOutput = result.output;
        rawResult = result.output;
        inputTokens = result.usage?.inputTokens ?? 0;
        outputTokens = result.usage?.outputTokens ?? 0;
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
      const classified = classifyError(err);
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

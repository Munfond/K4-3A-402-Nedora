import type { z } from "zod";
import {
  classifyRevisionError,
  isReasoningModelId,
  resolveLanguageModelForRevision,
  resolveRevisionModelId,
  type RevisionAgentConfig,
  type RevisionAgentError,
  type RevisionAttemptRecord,
} from "./index";
import { Output, generateText } from "ai";
import { getPromptHashP1 } from "./prompt-p1";

export interface RevisionStepResult<T> {
  ok: boolean;
  output?: T;
  error?: RevisionAgentError;
  attempts: RevisionAttemptRecord[];
  durationMs: number;
  promptHash: string;
  modelId: string;
  totalTokens: number;
}

/**
 * Một bước gọi model có schema riêng (P1). Giữ nguyên luật của C3-AG:
 * tối đa 2 lần gọi, lần retry gửi kèm lỗi schema, không retry lỗi 4xx.
 */
export async function runRevisionStep<T extends z.ZodTypeAny>(params: {
  systemPrompt: string;
  userPayload: unknown;
  schema: T;
  config?: RevisionAgentConfig;
  stepLabel: string;
}): Promise<RevisionStepResult<z.infer<T>>> {
  const { systemPrompt, userPayload, schema, config = {}, stepLabel } = params;

  const modelId = resolveRevisionModelId(config.modelId);
  const timeoutMs =
    config.timeoutMs ??
    (Number(process.env.REVISION_MODEL_TIMEOUT_MS) || 150000);
  const maxOutputTokens =
    config.maxOutputTokens ??
    (Number(process.env.REVISION_MAX_OUTPUT_TOKENS) || 16000);
  const temperature = config.temperature ?? 0;
  const promptHash = getPromptHashP1(systemPrompt);
  const attempts: RevisionAttemptRecord[] = [];
  const startAll = Date.now();

  if (!modelId) {
    return {
      ok: false,
      error: {
        code: "MODEL_NOT_CONFIGURED",
        message:
          "Chưa chọn model: đặt REVISION_MODEL (hoặc OPENAI_MODELS) trên server",
      },
      attempts,
      durationMs: 0,
      promptHash,
      modelId,
      totalTokens: 0,
    };
  }

  const languageModel = resolveLanguageModelForRevision(modelId);
  if (!languageModel) {
    return {
      ok: false,
      error: {
        code: "MODEL_NOT_CONFIGURED",
        message: `Không có khóa dùng được cho model ${modelId}: cần AI_GATEWAY_API_KEY, hoặc OPENAI_API_KEY với model openai/…`,
      },
      attempts,
      durationMs: 0,
      promptHash,
      modelId,
      totalTokens: 0,
    };
  }

  let lastError: RevisionAgentError | null = null;
  let totalTokens = 0;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const startAttempt = Date.now();
    const prompt = JSON.stringify(
      lastError
        ? {
            ...(userPayload as Record<string, unknown>),
            _suaLoiLanTruoc: {
              thongBao: `Lần gọi trước (${stepLabel}) gặp lỗi sau. Hãy sửa đúng định dạng.`,
              chiTietLoi: lastError.message,
            },
          }
        : userPayload,
      null,
      2,
    );

    try {
      const result = await generateText({
        model: languageModel,
        system: systemPrompt,
        prompt,
        output: Output.object({ schema }),
        abortSignal: AbortSignal.timeout(timeoutMs),
        maxOutputTokens,
        ...(isReasoningModelId(modelId) ? {} : { temperature }),
      });

      const inputTokens = result.usage?.inputTokens ?? 0;
      const outputTokens = result.usage?.outputTokens ?? 0;
      totalTokens += inputTokens + outputTokens;

      attempts.push({
        attemptNumber: attempt,
        status: "xong",
        durationMs: Date.now() - startAttempt,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      });

      return {
        ok: true,
        output: result.output as z.infer<T>,
        attempts,
        durationMs: Date.now() - startAll,
        promptHash,
        modelId,
        totalTokens,
      };
    } catch (err: unknown) {
      const classified = classifyRevisionError(err);
      lastError = { code: classified.code, message: classified.message };

      attempts.push({
        attemptNumber: attempt,
        status: "loi",
        durationMs: Date.now() - startAttempt,
        errorCode: classified.code,
        errorMessage: classified.message,
      });

      if (!classified.isRetryable || attempt >= 2) break;
    }
  }

  return {
    ok: false,
    error: lastError ?? {
      code: "MODEL_CALL_FAILED",
      message: `Không nhận được kết quả ${stepLabel} sau 2 lần gọi`,
    },
    attempts,
    durationMs: Date.now() - startAll,
    promptHash,
    modelId,
    totalTokens,
  };
}

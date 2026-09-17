import type { AnalyzeInput, NewFeedbackInput } from "../src/lib/revision/types";

export interface EvalCriterion {
  type: string;
  [key: string]: any;
}

export interface EvalCase {
  caseId: string;
  tier: "thuong" | "kho" | "hiem";
  kind: "pipeline" | "validator" | "engine";
  hardness: string[];
  provenance: unknown;
  taxonomyClass: string | null;
  input?: Record<string, unknown>;
  fixture?: string;
  expected: unknown;
  passCriteria: EvalCriterion[];
}

export interface EvalContract {
  metadata: Record<string, unknown>;
  cases: EvalCase[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseEvalContract(raw: string): EvalContract {
  const document: unknown = JSON.parse(raw);
  const metadata = Array.isArray(document)
    ? {}
    : isRecord(document)
      ? document
      : null;
  const cases = Array.isArray(document)
    ? document
    : metadata && Array.isArray(metadata.cases)
      ? metadata.cases
      : null;

  if (!cases) {
    throw new Error(
      "Golden set không hợp lệ: cần root array hoặc object có trường cases",
    );
  }

  const normalizedCases = cases.map((candidate, index): EvalCase => {
    if (!isRecord(candidate)) {
      throw new Error(`Golden case #${index + 1} không phải object`);
    }

    const caseId = candidate.caseId;
    const tier = candidate.tier;
    const kind = candidate.kind;
    if (
      typeof caseId !== "string" ||
      !["thuong", "kho", "hiem"].includes(String(tier)) ||
      !["pipeline", "validator", "engine"].includes(String(kind))
    ) {
      throw new Error(
        `Golden case #${index + 1} thiếu caseId/tier/kind hợp lệ`,
      );
    }

    if (!Array.isArray(candidate.passCriteria)) {
      throw new Error(`Golden case ${caseId} thiếu passCriteria[]`);
    }

    return {
      caseId,
      tier: tier as EvalCase["tier"],
      kind: kind as EvalCase["kind"],
      hardness: Array.isArray(candidate.hardness)
        ? candidate.hardness.filter(
            (item): item is string => typeof item === "string",
          )
        : [],
      provenance: candidate.provenance,
      taxonomyClass:
        typeof candidate.taxonomyClass === "string"
          ? candidate.taxonomyClass
          : null,
      input: isRecord(candidate.input) ? candidate.input : undefined,
      fixture:
        typeof candidate.fixture === "string" ? candidate.fixture : undefined,
      expected: candidate.expected,
      passCriteria: candidate.passCriteria.filter(isRecord) as EvalCriterion[],
    };
  });

  if (normalizedCases.length === 0) {
    throw new Error("Golden set không được rỗng");
  }

  return {
    metadata: metadata || {},
    cases: normalizedCases,
  };
}

export function toAnalyzeInput(goldenCase: EvalCase): AnalyzeInput {
  const input = goldenCase.input || {};
  const feedbacks = Array.isArray(input.feedbacks)
    ? input.feedbacks.filter(isRecord).map(
        (feedback, index): NewFeedbackInput => ({
          id:
            typeof feedback.id === "string"
              ? feedback.id
              : `${goldenCase.caseId}-feedback-${index + 1}`,
          text: typeof feedback.text === "string" ? feedback.text : "",
          channel:
            feedback.channel === "tin-nhan" || feedback.channel === "khao-sat"
              ? feedback.channel
              : "binh-luan",
          sender:
            typeof feedback.sender === "string" ? feedback.sender : undefined,
        }),
      )
    : undefined;

  if (feedbacks) {
    return {
      scriptId: "d1",
      includeD1Feedback: false,
      newFeedback: feedbacks,
      caseId: goldenCase.caseId,
    };
  }

  return {
    ...(input as Partial<AnalyzeInput>),
    caseId: goldenCase.caseId,
    includeD1Feedback: input.includeD1Feedback === true,
  };
}

export function statusMatches(expected: unknown, actual: string): boolean {
  if (typeof expected !== "string") return false;
  const aliases: Record<string, string[]> = {
    done: ["done", "xong"],
    xong: ["xong", "done"],
    error: ["error", "loi"],
    loi: ["loi", "error"],
  };
  return (aliases[expected] || [expected]).includes(actual);
}

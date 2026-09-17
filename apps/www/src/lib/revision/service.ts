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
import { generateRunId, saveRunTrace } from "./trace";

export interface AnalyzeServiceResponse {
  runId: string;
  status: "xong" | "loi";
  result?: RevisionRunResult;
  metadata: RunMetadata;
  error?: {
    code: string;
    message: string;
  };
}

export async function analyzeRevision(
  input: AnalyzeInput,
  config?: RevisionAgentConfig,
  callModel?: MockModelCaller,
): Promise<AnalyzeServiceResponse> {
  const runId = generateRunId();
  const startTime = Date.now();

  // 1. Nạp và chuẩn bị dữ liệu
  const { script, allFeedback, feedbackForModel, inputHash } =
    prepareAnalyzeInput(input);

  // Dùng cùng cách chọn model với agent, để run.json không ghi một model không được gọi.
  const modelId = resolveRevisionModelId(config?.modelId);

  // C3-AG-10: Nếu không còn góp ý nào để gửi model (tất cả bị cách ly hoặc chỉ chấm điểm)
  if (feedbackForModel.length === 0) {
    const checks: ValidationChecks = {
      schemaOk: true,
      feedbackCoverageOk: true,
      evidenceOk: true,
      locationsOk: true,
      patchesOk: true,
    };

    const quarantinedFeedback = allFeedback.filter((f) => f.isQuarantined);
    const unassignedFeedback = allFeedback.filter(
      (f) => !f.isQuarantined && f.label !== "gop-y",
    );

    const result: RevisionRunResult = {
      runId,
      inputHash,
      script,
      feedback: allFeedback,
      issues: [],
      cases: [],
      validation: {
        findings: [],
        checks,
      },
      unassignedFeedback,
      quarantinedFeedback,
    };

    const metadata: RunMetadata = {
      runId,
      status: "xong",
      createdAt: new Date().toISOString(),
      inputHash,
      modelId,
      promptVersion: "revision-cp3@1",
      promptHash: "",
      schemaVersion: "hackathon-revision-agent/1",
      policyVersion: "cp3@1",
      attempts: [],
      checks,
      totalFeedback: allFeedback.length,
      newFeedbackCount: input.newFeedback ? input.newFeedback.length : 0,
      independentSenders: new Set(allFeedback.map((f) => f.sender)).size,
      caseCount: 0,
      durationMs: Date.now() - startTime,
      caseId: input.caseId,
    };

    saveRunTrace({
      runId,
      metadata,
      sanitizedInput: {
        includeD1Feedback: input.includeD1Feedback,
        newFeedback: input.newFeedback,
        inputHash,
      },
      attempts: [],
      result,
    });

    return {
      runId,
      status: "xong",
      result,
      metadata,
    };
  }

  // 2. Chuyển đổi dữ liệu sang định dạng của Agent
  const agentScript = script.cau.map((c) => ({
    n: c.n,
    phan: c.phan,
    loi: c.loi,
    dungGiay: c.dungGiay,
    chuTrenManHinh: c.chuTrenManHinh,
    yDoHinh: c.yDoHinh,
    kieu: c.kieu,
  }));

  const agentFeedback = feedbackForModel.map((f) => ({
    id: f.id,
    channel: f.channel,
    sender: f.sender,
    text: f.sanitizedText,
    survey: f.survey,
  }));

  // 3. Gọi Revision Agent
  const agentResult = await runRevisionAgent({
    input: {
      script: agentScript,
      feedback: agentFeedback,
      caseId: input.caseId,
    },
    config,
    callModel,
  });

  const defaultChecks: ValidationChecks = {
    schemaOk: agentResult.ok,
    feedbackCoverageOk: false,
    evidenceOk: false,
    locationsOk: false,
    patchesOk: false,
  };

  if (!agentResult.ok) {
    const metadata: RunMetadata = {
      runId,
      status: "loi",
      createdAt: new Date().toISOString(),
      inputHash,
      modelId: agentResult.metadata.modelId,
      promptVersion: agentResult.metadata.promptVersion,
      promptHash: agentResult.metadata.promptHash,
      schemaVersion: agentResult.metadata.schemaVersion,
      policyVersion: agentResult.metadata.policyVersion,
      attempts: agentResult.metadata.attempts,
      checks: defaultChecks,
      totalFeedback: allFeedback.length,
      newFeedbackCount: input.newFeedback ? input.newFeedback.length : 0,
      independentSenders: new Set(allFeedback.map((f) => f.sender)).size,
      caseCount: 0,
      durationMs: Date.now() - startTime,
      caseId: input.caseId,
      error: agentResult.error,
    };

    saveRunTrace({
      runId,
      metadata,
      sanitizedInput: {
        includeD1Feedback: input.includeD1Feedback,
        newFeedback: input.newFeedback,
        inputHash,
      },
      attempts: agentResult.metadata.attempts,
    });

    return {
      runId,
      status: "loi",
      metadata,
      error: agentResult.error,
    };
  }

  // 4. Kiểm tra đầu ra của model bằng code (C3-VAL)
  const validationRes = validateRevisionOutput({
    agentOutput: agentResult.output,
    script,
    allFeedback,
  });

  // 5. Gom vấn đề thành các hồ sơ quyết định (C3-CASE)
  const cases = buildDecisionCases(validationRes.issues, script);

  // 6. Phân loại feedback
  const issueFeedbackIdSet = new Set<string>();
  for (const iss of validationRes.issues) {
    for (const fid of iss.feedbackIds) {
      issueFeedbackIdSet.add(fid);
    }
  }

  const quarantinedFeedback = validationRes.feedback.filter(
    (f) => f.isQuarantined,
  );
  const unassignedFeedback = validationRes.feedback.filter(
    (f) => !f.isQuarantined && !issueFeedbackIdSet.has(f.id),
  );

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
    unassignedFeedback,
    quarantinedFeedback,
  };

  const metadata: RunMetadata = {
    runId,
    status: "xong",
    createdAt: new Date().toISOString(),
    inputHash,
    modelId: agentResult.metadata.modelId,
    promptVersion: agentResult.metadata.promptVersion,
    promptHash: agentResult.metadata.promptHash,
    schemaVersion: agentResult.metadata.schemaVersion,
    policyVersion: agentResult.metadata.policyVersion,
    attempts: agentResult.metadata.attempts,
    checks: validationRes.checks,
    totalFeedback: allFeedback.length,
    newFeedbackCount: input.newFeedback ? input.newFeedback.length : 0,
    independentSenders: new Set(allFeedback.map((f) => f.sender)).size,
    caseCount: cases.length,
    durationMs: Date.now() - startTime,
    caseId: input.caseId,
  };

  saveRunTrace({
    runId,
    metadata,
    sanitizedInput: {
      includeD1Feedback: input.includeD1Feedback,
      newFeedback: input.newFeedback,
      inputHash,
    },
    attempts: agentResult.metadata.attempts,
    result,
  });

  return {
    runId,
    status: "xong",
    result,
    metadata,
  };
}

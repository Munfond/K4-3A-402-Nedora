import type {
  RevisionAgentOutput,
  AgentFeedbackItem,
  AgentIssue,
  AgentOption,
} from "@feedback/ai/agents/revision";
import type {
  Category,
  FeedbackItem,
  IssueItem,
  Label,
  OptionStatus,
  PatchItem,
  RevisionOption,
  ScriptData,
  ValidationChecks,
  ValidationFinding,
  DecisionCase,
} from "./types";
import { normalizeUnicodeNfc } from "./sanitize";
import { computeOptionStandaloneWork } from "./engine";

export interface ValidateOutputResult {
  issues: IssueItem[];
  feedback: FeedbackItem[];
  findings: ValidationFinding[];
  checks: ValidationChecks;
}

const VALID_LABELS = new Set<string>([
  "gop-y",
  "khen",
  "chi-cham-diem",
  "nhieu",
  "cong-kich",
  "cai-lenh",
]);

const VALID_CATEGORIES = new Set<string>([
  "noi-dung-sai",
  "kho-hieu",
  "nhip-nhanh-cham",
  "giong-doc",
  "hinh-anh",
  "loi-ky-thuat",
]);

/**
 * R0.3: Kiểm tra đầu ra bước Hiểu góp ý (hieu-gop-y) và chuẩn hóa danh sách vấn đề sơ bộ (chưa có options).
 */
export function validateHieuOutput(params: {
  hieuOutput: {
    feedback?: AgentFeedbackItem[];
    issues?: Array<{
      key: string;
      summary: string;
      category: string;
      feedbackIds: string[];
      location?: {
        status?: string;
        sentenceNs?: number[];
        basis?: string;
      };
      stances?: Array<{ direction: string; feedbackIds: string[] }>;
      uncertainties?: string[];
      causeHypothesis?: {
        text: string;
        source: "nguoi-gop-y" | "ai-doi-chieu";
      } | null;
      impact?: { level: "cao" | "vua" | "thap"; reason: string };
    }>;
  };
  script: ScriptData;
  allFeedback: FeedbackItem[];
}): {
  issues: IssueItem[];
  feedback: FeedbackItem[];
  findings: ValidationFinding[];
} {
  const { hieuOutput, script, allFeedback } = params;
  const findings: ValidationFinding[] = [];

  const sentenceByN = new Map<number, (typeof script.cau)[0]>();
  for (const c of script.cau) {
    sentenceByN.set(c.n, c);
  }

  const feedbackById = new Map<string, FeedbackItem>();
  for (const f of allFeedback) {
    feedbackById.set(f.id, f);
  }

  // 1. Kiểm tra và cập nhật nhãn feedback (C3-VAL-02, C3-VAL-03)
  const modelFeedbackMap = new Map<string, AgentFeedbackItem>();
  for (const fb of hieuOutput.feedback || []) {
    if (!feedbackById.has(fb.id)) {
      findings.push({
        code: "UNKNOWN_FEEDBACK_ID",
        level: "loi",
        message: `Model trả về ID góp ý lạ không tồn tại: ${fb.id}`,
        target: fb.id,
      });
      continue;
    }
    if (modelFeedbackMap.has(fb.id)) {
      findings.push({
        code: "FEEDBACK_LABEL_DUPLICATE",
        level: "loi",
        message: `Góp ý ${fb.id} bị gán nhãn nhiều lần, giữ nhãn đầu tiên`,
        target: fb.id,
      });
      continue;
    }
    modelFeedbackMap.set(fb.id, fb as AgentFeedbackItem);
  }

  // Cập nhật lại nhãn cho allFeedback
  for (const item of allFeedback) {
    if (item.isQuarantined || item.label === "chi-cham-diem") {
      continue;
    }

    const modelFb = modelFeedbackMap.get(item.id);
    if (!modelFb) {
      findings.push({
        code: "FEEDBACK_LABEL_MISSING",
        level: "loi",
        message: `Góp ý ${item.id} không có nhãn từ model, gán mặc định 'chua-phan-loai'`,
        target: item.id,
      });
      continue;
    }

    let rawLabel = (modelFb.label || "").trim().toLowerCase();
    if (!VALID_LABELS.has(rawLabel)) {
      findings.push({
        code: "NORMALIZED_VALUE",
        level: "ghi-nhan",
        message: `Chuẩn hóa nhãn feedback ${item.id} từ '${modelFb.label}' về 'nhieu'`,
        target: item.id,
      });
      rawLabel = "nhieu";
    }

    item.label = rawLabel as Label;
    item.moderationBy = "model";

    if (item.label === "cai-lenh" || item.label === "cong-kich") {
      item.isQuarantined = true;
      item.quarantineReason =
        item.label === "cai-lenh"
          ? "Nội dung có dấu hiệu ra lệnh cho hệ thống"
          : "Nội dung công kích cá nhân";
      item.sanitizedText = "";
      item.rawText = undefined;
    }
  }

  // 2. Kiểm tra vấn đề (Issues)
  const validatedIssues: IssueItem[] = [];
  let issueCounter = 1;

  for (const rawIssue of hieuOutput.issues || []) {
    const validFeedbackIds: string[] = [];
    for (const fid of rawIssue.feedbackIds || []) {
      const fb = feedbackById.get(fid);
      if (!fb) {
        findings.push({
          code: "UNKNOWN_FEEDBACK_ID",
          level: "loi",
          message: `Vấn đề trích ID góp ý không tồn tại: ${fid}`,
          target: fid,
        });
        continue;
      }
      if (
        fb.isQuarantined ||
        fb.label === "khen" ||
        fb.label === "chi-cham-diem" ||
        fb.label === "nhieu"
      ) {
        findings.push({
          code: "EVIDENCE_NOT_ALLOWED",
          level: "loi",
          message: `Vấn đề trích góp ý ${fid} mang nhãn ${fb.label} (bị cách ly hoặc không tạo vấn đề)`,
          target: fid,
        });
        continue;
      }
      validFeedbackIds.push(fid);
    }

    if (validFeedbackIds.length === 0) {
      findings.push({
        code: "ISSUE_NO_EVIDENCE",
        level: "loi",
        message: `Vấn đề '${rawIssue.summary}' không còn bằng chứng hợp lệ nào, bỏ qua vấn đề này`,
        target: rawIssue.key,
      });
      continue;
    }

    let cat = (rawIssue.category || "").trim().toLowerCase();
    if (!VALID_CATEGORIES.has(cat)) {
      findings.push({
        code: "NORMALIZED_VALUE",
        level: "ghi-nhan",
        message: `Chuẩn hóa category '${rawIssue.category}' về 'kho-hieu'`,
        target: rawIssue.key,
      });
      cat = "kho-hieu";
    }

    const validSentenceNs: number[] = [];
    for (const n of rawIssue.location?.sentenceNs || []) {
      if (sentenceByN.has(n)) {
        validSentenceNs.push(n);
      } else {
        findings.push({
          code: "SENTENCE_NOT_FOUND",
          level: "loi",
          message: `Câu ${n} không tồn tại trong kịch bản`,
          target: String(n),
        });
      }
    }

    let locationStatus = (rawIssue.location?.status ||
      "can-xac-nhan") as IssueItem["location"]["status"];
    if (locationStatus === "da-dinh-vi") {
      if (validSentenceNs.length === 0) {
        locationStatus = "can-xac-nhan";
        findings.push({
          code: "LOCATION_DOWNGRADED",
          level: "ghi-nhan",
          message: `Vị trí hạ về 'can-xac-nhan' do danh sách câu hợp lệ rỗng`,
          target: rawIssue.key,
        });
      } else {
        const minN = Math.min(...validSentenceNs);
        const maxN = Math.max(...validSentenceNs);
        if (maxN - minN + 1 > 5) {
          locationStatus = "can-xac-nhan";
          findings.push({
            code: "LOCATION_DOWNGRADED",
            level: "ghi-nhan",
            message: `Vị trí trải dài ${maxN - minN + 1} câu (> 5 câu), hạ về 'can-xac-nhan'`,
            target: rawIssue.key,
          });
        }
      }
    }

    const validStances: Array<{ direction: string; feedbackIds: string[] }> =
      [];
    for (const st of rawIssue.stances || []) {
      const filteredFids = (st.feedbackIds || []).filter((id) =>
        validFeedbackIds.includes(id),
      );
      if (filteredFids.length !== (st.feedbackIds || []).length) {
        findings.push({
          code: "STANCE_ID_OUTSIDE_ISSUE",
          level: "loi",
          message: `Nhóm ý kiến chứa ID ngoài danh sách bằng chứng của vấn đề`,
          target: rawIssue.key,
        });
      }
      if (filteredFids.length > 0) {
        validStances.push({
          direction: st.direction || "khác",
          feedbackIds: filteredFids,
        });
      }
    }

    const hasDisagreement =
      validStances.length >= 2 &&
      new Set(validStances.map((s) => s.direction)).size >= 2;

    const senderSet = new Set<string>();
    let hasUnverifiedSender = false;
    for (const fid of validFeedbackIds) {
      const fb = feedbackById.get(fid);
      if (fb) {
        senderSet.add(fb.sender);
        if (fb.sender.startsWith("ng-khong-ro-")) {
          hasUnverifiedSender = true;
        }
      }
    }
    const independentSenders = senderSet.size;
    const mentions = validFeedbackIds.length;
    const issueId = `is-${issueCounter++}`;

    validatedIssues.push({
      id: issueId,
      key: rawIssue.key,
      summary: rawIssue.summary,
      category: cat as Category,
      feedbackIds: validFeedbackIds,
      location: {
        status: locationStatus,
        sentenceNs: validSentenceNs,
        basis: rawIssue.location?.basis || "",
      },
      stances: validStances,
      uncertainties: rawIssue.uncertainties || [],
      causeHypothesis: rawIssue.causeHypothesis || null,
      impact: rawIssue.impact || { level: "vua", reason: "Mặc định" },
      options: [],
      independentSenders,
      mentions,
      sendersVerified: !hasUnverifiedSender,
      hasDisagreement,
    });
  }

  return {
    issues: validatedIssues,
    feedback: allFeedback,
    findings,
  };
}

export interface ValidateCaseOptionsResult {
  valid: boolean;
  options: RevisionOption[];
  errors: string[];
  findings: ValidationFinding[];
}

/**
 * R0.4: Kiểm tra phương án của một vùng cụ thể. Nếu có lỗi, trả về danh sách lỗi chặn để runner thử lại.
 */
export function validateCaseOptions(params: {
  caseDraft: DecisionCase;
  rawOptions: AgentOption[];
  script: ScriptData;
}): ValidateCaseOptionsResult {
  const { caseDraft, rawOptions, script } = params;
  const findings: ValidationFinding[] = [];
  const errors: string[] = [];

  const sentenceByN = new Map<number, (typeof script.cau)[0]>();
  for (const c of script.cau) {
    sentenceByN.set(c.n, c);
  }

  const validatedOptions: RevisionOption[] = [];
  const seenOptionLabels = new Set<string>();

  for (const opt of rawOptions || []) {
    if (seenOptionLabels.has(opt.label)) {
      findings.push({
        code: "OPTION_LABEL_DUPLICATE",
        level: "loi",
        message: `Trùng nhãn phương án ${opt.label} trong vùng ${caseDraft.id}`,
        target: caseDraft.id,
      });
      errors.push(
        `Trùng nhãn phương án ${opt.label} trong vùng ${caseDraft.id}`,
      );
      continue;
    }
    seenOptionLabels.add(opt.label);

    const optionId = `${caseDraft.id}-${opt.label}`;
    const optionStatusReasons: string[] = [];
    let isOptionInvalid = false;

    const validatedPatches: PatchItem[] = [];
    const patchKeySet = new Set<string>();

    for (const p of opt.patches || []) {
      const sentence = sentenceByN.get(p.n);
      if (!sentence) {
        findings.push({
          code: "PATCH_SENTENCE_NOT_FOUND",
          level: "loi",
          message: `Patch trỏ câu ${p.n} không tồn tại`,
          target: optionId,
        });
        const msg = `PATCH_SENTENCE_NOT_FOUND câu ${p.n}: Câu không tồn tại trong kịch bản`;
        optionStatusReasons.push(msg);
        errors.push(msg);
        isOptionInvalid = true;
        continue;
      }

      const patchKey = `${p.n}:${p.field}`;
      if (patchKeySet.has(patchKey)) {
        findings.push({
          code: "INTRA_OPTION_CONFLICT",
          level: "loi",
          message: `Phương án chứa hai patch cùng tác động lên câu ${p.n}, trường ${p.field}`,
          target: optionId,
        });
        const msg = `INTRA_OPTION_CONFLICT câu ${p.n}: Trùng patch trên câu ${p.n}, trường ${p.field}`;
        optionStatusReasons.push(msg);
        errors.push(msg);
        isOptionInvalid = true;
        continue;
      }
      patchKeySet.add(patchKey);

      if (p.field === "loi") {
        if (sentence.dungGiay && !sentence.loi) {
          findings.push({
            code: "PATCH_FIELD_NOT_ALLOWED",
            level: "loi",
            message: `Câu ${p.n} là câu khoảng lặng dừng giây, không được sửa 'loi'`,
            target: optionId,
          });
          const msg = `PATCH_FIELD_NOT_ALLOWED câu ${p.n}: Câu dừng giây không được sửa lời`;
          optionStatusReasons.push(msg);
          errors.push(msg);
          isOptionInvalid = true;
          continue;
        }

        const currentVal = sentence.loi || "";
        if (p.before.trim() !== currentVal.trim()) {
          findings.push({
            code: "PATCH_STALE",
            level: "loi",
            message: `Giá trị 'before' của câu ${p.n} không khớp nội dung kịch bản gốc`,
            target: optionId,
          });
          const msg = `PATCH_STALE câu ${p.n}: Giá trị 'before' không khớp kịch bản (kỳ vọng: "${currentVal}", nhận: "${p.before}")`;
          optionStatusReasons.push(msg);
          errors.push(msg);
          isOptionInvalid = true;
        }

        const afterNfc = normalizeUnicodeNfc(p.after || "");
        if (afterNfc.trim() === "" || /\d/.test(afterNfc)) {
          findings.push({
            code: "LOI_INVALID",
            level: "loi",
            message: `Lời đọc mới câu ${p.n} không hợp lệ (rỗng hoặc chứa chữ số)`,
            target: optionId,
          });
          const msg = `LOI_INVALID câu ${p.n}: Lời đọc mới rỗng hoặc chứa chữ số (phải viết chữ toàn bộ, không dùng số)`;
          optionStatusReasons.push(msg);
          errors.push(msg);
          isOptionInvalid = true;
        }

        if (p.after.trim() === p.before.trim()) {
          findings.push({
            code: "PATCH_NO_CHANGE",
            level: "ghi-nhan",
            message: `Patch câu ${p.n} có after giống hệt before, bỏ patch`,
            target: optionId,
          });
          continue;
        }
      } else if (p.field === "chuTrenManHinh") {
        const afterLen = Array.from(normalizeUnicodeNfc(p.after || "")).length;
        if (afterLen > 40) {
          findings.push({
            code: "SCREEN_TEXT_TOO_LONG",
            level: "loi",
            message: `Chữ trên màn hình câu ${p.n} dài ${afterLen} ký tự (vượt mức 40 ký tự)`,
            target: optionId,
          });
          const msg = `SCREEN_TEXT_TOO_LONG câu ${p.n}: Chữ trên màn hình dài ${afterLen} ký tự (tối đa 40)`;
          optionStatusReasons.push(msg);
          errors.push(msg);
          isOptionInvalid = true;
        }
      }

      validatedPatches.push({
        n: p.n,
        field: p.field,
        before: p.before,
        after: p.after,
      });
    }

    let status: OptionStatus;
    if (opt.unsupportedOperation) {
      status = "ngoai-pham-vi";
      optionStatusReasons.push(
        `Cần thao tác ${opt.unsupportedOperation.kind}: ${opt.unsupportedOperation.description}`,
      );
    } else if (isOptionInvalid) {
      status = "khong-hop-le";
    } else if (validatedPatches.length === 0) {
      findings.push({
        code: "OPTION_EMPTY",
        level: "loi",
        message: `Phương án ${optionId} không có patch và không có unsupportedOperation`,
        target: optionId,
      });
      status = "khong-hop-le";
      optionStatusReasons.push("Phương án rỗng, không có thay đổi nào");
      errors.push(`Phương án ${opt.label} rỗng, không có thay đổi nào`);
    } else {
      status = "hop-le";
    }

    const builtOption: RevisionOption = {
      id: optionId,
      label: opt.label,
      title: opt.title,
      rationale: opt.rationale,
      patches: validatedPatches,
      expectedEffect: opt.expectedEffect,
      remaining: opt.remaining,
      needsHumanCheck: opt.needsHumanCheck,
      unsupportedOperation: opt.unsupportedOperation,
      status,
      statusReasons: optionStatusReasons,
    };

    if (status === "hop-le" || status === "ngoai-pham-vi") {
      try {
        builtOption.standaloneWork = computeOptionStandaloneWork(
          builtOption,
          caseDraft.id,
          script,
        );
      } catch {
        // bỏ qua nếu không tính được standalone work
      }
    }

    validatedOptions.push(builtOption);
  }

  return {
    valid: errors.length === 0,
    options: validatedOptions,
    errors,
    findings,
  };
}

/**
 * Validator tổng duyệt toàn bộ kết quả. Làm lưới an toàn cuối cùng.
 */
export function validateRevisionOutput(params: {
  agentOutput: RevisionAgentOutput;
  script: ScriptData;
  allFeedback: FeedbackItem[];
}): ValidateOutputResult {
  const { agentOutput, script, allFeedback } = params;

  // 1. Phân tích feedback & issues qua validateHieuOutput
  const hieuRes = validateHieuOutput({
    hieuOutput: agentOutput,
    script,
    allFeedback,
  });

  const findings = [...hieuRes.findings];
  const issues = hieuRes.issues;

  // 2. Validate options cho từng issue nếu có
  const rawIssueMap = new Map<string, AgentIssue>();
  for (const rawIss of agentOutput.issues || []) {
    rawIssueMap.set(rawIss.key, rawIss as AgentIssue);
  }

  for (const iss of issues) {
    const rawIss = rawIssueMap.get(iss.key);
    if (!rawIss || !rawIss.options || rawIss.options.length === 0) continue;

    const dummyCase: DecisionCase = {
      id: iss.id,
      type: "vung",
      title: iss.summary,
      issueIds: [iss.id],
      sentenceNs: iss.location.sentenceNs,
      tuGiay: 0,
      denGiay: 0,
      issues: [iss],
      options: [],
      hasDisagreement: iss.hasDisagreement,
      independentSenders: iss.independentSenders,
      mentions: iss.mentions,
      flags: [],
    };

    const optRes = validateCaseOptions({
      caseDraft: dummyCase,
      rawOptions: rawIss.options,
      script,
    });

    iss.options = optRes.options;
    findings.push(...optRes.findings);
  }

  // 3. Tính toán checks flags C3-VAL-10
  const hasSchemaErr = findings.some((f) => f.code === "OUTPUT_SCHEMA_INVALID");
  const hasFeedbackCoverageErr = findings.some((f) =>
    ["FEEDBACK_LABEL_MISSING", "UNKNOWN_FEEDBACK_ID"].includes(f.code),
  );
  const hasEvidenceErr = findings.some(
    (f) => f.code === "EVIDENCE_NOT_ALLOWED" || f.code === "ISSUE_NO_EVIDENCE",
  );
  const hasLocationsErr = findings.some((f) => f.code === "SENTENCE_NOT_FOUND");
  const hasPatchesErr = findings.some((f) =>
    [
      "PATCH_SENTENCE_NOT_FOUND",
      "PATCH_FIELD_NOT_ALLOWED",
      "PATCH_STALE",
      "LOI_INVALID",
      "SCREEN_TEXT_TOO_LONG",
      "INTRA_OPTION_CONFLICT",
    ].includes(f.code),
  );

  const checks: ValidationChecks = {
    schemaOk: !hasSchemaErr,
    feedbackCoverageOk: !hasFeedbackCoverageErr,
    evidenceOk: !hasEvidenceErr,
    locationsOk: !hasLocationsErr,
    patchesOk: !hasPatchesErr,
  };

  return {
    issues,
    feedback: allFeedback,
    findings,
    checks,
  };
}

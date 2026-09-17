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
} from "./types";
import { normalizeUnicodeNfc } from "./sanitize";

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

export function validateRevisionOutput(params: {
  agentOutput: RevisionAgentOutput;
  script: ScriptData;
  allFeedback: FeedbackItem[];
}): ValidateOutputResult {
  const { agentOutput, script, allFeedback } = params;
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
  for (const fb of agentOutput.feedback || []) {
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
    modelFeedbackMap.set(fb.id, fb);
  }

  // Cập nhật lại nhãn cho allFeedback
  for (const item of allFeedback) {
    // Nếu đã bị luật cách ly hoặc chỉ chấm điểm thì code đã gán nhãn
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
      // Giữ nguyên nhãn ban đầu hoặc gán nhieu
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

    // Nếu model gán nhãn cách ly (cai-lenh hoặc cong-kich)
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

  for (const rawIssue of agentOutput.issues || []) {
    // C3-VAL-04: Lọc feedbackIds hợp lệ
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

    // C3-VAL-05: Nếu không còn ID nào hợp lệ -> Bỏ vấn đề
    if (validFeedbackIds.length === 0) {
      findings.push({
        code: "ISSUE_NO_EVIDENCE",
        level: "loi",
        message: `Vấn đề '${rawIssue.summary}' không còn bằng chứng hợp lệ nào, bỏ qua vấn đề này`,
        target: rawIssue.key,
      });
      continue;
    }

    // C3-VAL-02: Chuẩn hóa category
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

    // C3-VAL-06: Kiểm tra số câu n
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

    let locationStatus = rawIssue.location?.status || "can-xac-nhan";
    // Hạ trạng thái nếu trải rộng > 5 câu hoặc rỗng
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

    // C3-VAL-07: Stances và disagreement
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

    // C3-VAL-11: Đếm người độc lập
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

    // C3-VAL-12: Gán issueId chuẩn "is-<k>"
    const issueId = `is-${issueCounter++}`;

    // C3-VAL-08, 09: Kiểm tra phương án Options
    const validatedOptions: RevisionOption[] = [];
    const seenOptionLabels = new Set<string>();

    for (const opt of rawIssue.options || []) {
      if (seenOptionLabels.has(opt.label)) {
        findings.push({
          code: "OPTION_LABEL_DUPLICATE",
          level: "loi",
          message: `Trùng nhãn phương án ${opt.label} trong cùng vấn đề, bỏ qua phương án sau`,
          target: issueId,
        });
        continue;
      }
      seenOptionLabels.add(opt.label);

      const optionId = `${issueId}-${opt.label}`;
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
          optionStatusReasons.push(`Câu ${p.n} không tồn tại`);
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
          optionStatusReasons.push(
            `Trùng patch trên câu ${p.n}, trường ${p.field}`,
          );
          isOptionInvalid = true;
          continue;
        }
        patchKeySet.add(patchKey);

        // Kiểm tra trường sửa hợp lệ
        if (p.field === "loi") {
          if (sentence.dungGiay && !sentence.loi) {
            findings.push({
              code: "PATCH_FIELD_NOT_ALLOWED",
              level: "loi",
              message: `Câu ${p.n} là câu khoảng lặng dừng giây, không được sửa 'loi'`,
              target: optionId,
            });
            optionStatusReasons.push(`Câu ${p.n} là khoảng lặng dừng giây`);
            isOptionInvalid = true;
            continue;
          }

          // Kiểm tra expectedBefore
          const currentVal = sentence.loi || "";
          if (p.before.trim() !== currentVal.trim()) {
            findings.push({
              code: "PATCH_STALE",
              level: "loi",
              message: `Giá trị 'before' của câu ${p.n} không khớp nội dung kịch bản gốc`,
              target: optionId,
            });
            optionStatusReasons.push(
              `Giá trị 'before' câu ${p.n} không khớp kịch bản`,
            );
            isOptionInvalid = true;
          }

          // Kiểm tra loi mới (không rỗng, không chứa chữ số)
          const afterNfc = normalizeUnicodeNfc(p.after || "");
          if (afterNfc.trim() === "" || /\d/.test(afterNfc)) {
            findings.push({
              code: "LOI_INVALID",
              level: "loi",
              message: `Lời đọc mới câu ${p.n} không hợp lệ (rỗng hoặc chứa chữ số)`,
              target: optionId,
            });
            optionStatusReasons.push(`Lời câu ${p.n} rỗng hoặc chứa chữ số`);
            isOptionInvalid = true;
          }

          // C3-VAL-08b: Patch no change
          if (p.after.trim() === p.before.trim()) {
            findings.push({
              code: "PATCH_NO_CHANGE",
              level: "ghi-nhan",
              message: `Patch câu ${p.n} có after giống hệt before, bỏ patch`,
              target: optionId,
            });
            continue;
          }

          // Cảnh báo ngoài phạm vi lân cận
          if (validSentenceNs.length > 0) {
            const minN = Math.min(...validSentenceNs);
            const maxN = Math.max(...validSentenceNs);
            if (p.n < minN - 1 || p.n > maxN + 1) {
              findings.push({
                code: "PATCH_OUTSIDE_ISSUE",
                level: "canh-bao",
                message: `Patch câu ${p.n} nằm ngoài phạm vi vấn đề [${minN - 1}, ${maxN + 1}]`,
                target: optionId,
              });
            }
          }

          // Cảnh báo vấn đề kỹ thuật có patch lời
          if (cat === "loi-ky-thuat") {
            findings.push({
              code: "TECH_ISSUE_LOI_PATCH",
              level: "canh-bao",
              message: `Vấn đề kỹ thuật nhưng lại đề xuất sửa lời đọc câu ${p.n}`,
              target: optionId,
            });
          }
        } else if (p.field === "chuTrenManHinh") {
          const afterLen = Array.from(
            normalizeUnicodeNfc(p.after || ""),
          ).length;
          if (afterLen > 40) {
            findings.push({
              code: "SCREEN_TEXT_TOO_LONG",
              level: "loi",
              message: `Chữ trên màn hình câu ${p.n} dài ${afterLen} ký tự (vượt mức 40 ký tự)`,
              target: optionId,
            });
            optionStatusReasons.push(
              `Chữ trên màn hình vượt quá 40 ký tự (${afterLen})`,
            );
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

      // Xác định trạng thái option
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
          message: `Phương án ${optionId} không có patch và không có unsupportedOperation, bỏ qua`,
          target: optionId,
        });
        continue;
      } else {
        status = "hop-le";
      }

      validatedOptions.push({
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
      });
    }

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
      causeHypothesis: rawIssue.causeHypothesis,
      impact: rawIssue.impact || { level: "vua", reason: "Mặc định" },
      options: validatedOptions,
      independentSenders,
      mentions,
      sendersVerified: !hasUnverifiedSender,
      hasDisagreement,
    });
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
    issues: validatedIssues,
    feedback: allFeedback,
    findings,
    checks,
  };
}

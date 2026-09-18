import {
  PROMPT_AN_TOAN_SYSTEM,
  SafetyClassificationOutput,
} from "@feedback/ai";
import { generateText, Output, type LanguageModel } from "ai";
import { toDetection, toDisplay } from "./normalize";
import { detectAndRedactPii } from "./pii";
import {
  checkModerationLexiconRules,
  type ModerationLabel,
  type ModerationRuleResult,
} from "./rules";

export interface ModerationGateItem {
  id: string;
  sender: string;
  rawText: string;
}

export interface ModerationGateResult {
  id: string;
  sender: string;
  displayContent: string; // Bản hiển thị sạch PII
  detectionContent: string; // Bản phục vụ phát hiện luật
  label: ModerationLabel;
  isQuarantined: boolean;
  quarantineReason?: string;
  yDungDuoc?: string; // Ý sạch đã diễn đạt lại trung tính
  piiRedactions: Array<{ type: string; count: number }>;
  hasVideoPrivacyRisk: boolean;
}

export interface ModerateFeedbackBatchOptions {
  model?: LanguageModel | null;
  onWarning?: (warning: string) => void;
  llmClassifier?: (text: string) => Promise<SafetyClassificationOutput>;
}

function compute3Grams(text: string): Set<string> {
  const set = new Set<string>();
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length < 3) {
    set.add(clean);
    return set;
  }
  for (let i = 0; i <= clean.length - 3; i++) {
    set.add(clean.slice(i, i + 3));
  }
  return set;
}

function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1.0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export async function moderateFeedbackBatch(
  items: ModerationGateItem[],
  optionsOrClassifier?:
    | ModerateFeedbackBatchOptions
    | ((
        text: string,
      ) => Promise<SafetyClassificationOutput | ModerationRuleResult>),
): Promise<ModerationGateResult[]> {
  const options: ModerateFeedbackBatchOptions =
    typeof optionsOrClassifier === "function"
      ? { llmClassifier: optionsOrClassifier as any }
      : optionsOrClassifier || {};

  // 1. Tiền xử lý: Chuẩn hóa và lọc PII
  const preprocessed = items.map((item) => {
    const displayNorm = toDisplay(item.rawText);
    const piiRes = detectAndRedactPii(displayNorm);
    const detectNorm = toDetection(piiRes.text);
    return {
      id: item.id,
      sender: item.sender,
      rawText: item.rawText,
      displayContent: piiRes.text,
      detectionContent: detectNorm,
      piiRedactions: piiRes.redactions,
      hasPii: piiRes.hasPii,
      hasVideoPrivacyRisk: piiRes.hasVideoPrivacyRisk,
      grams: compute3Grams(detectNorm),
    };
  });

  // 2. Phát hiện Spam đồng loạt (Jaccard 3-gram ≥ 0.8 giữa ≥ 3 người gửi khác nhau)
  const spamIds = new Set<string>();
  for (let i = 0; i < preprocessed.length; i++) {
    const senders = new Set<string>([preprocessed[i].sender]);
    const matchedGroup = [preprocessed[i].id];

    for (let j = i + 1; j < preprocessed.length; j++) {
      if (preprocessed[i].detectionContent.length < 5) continue;
      const sim = jaccardSimilarity(
        preprocessed[i].grams,
        preprocessed[j].grams,
      );
      if (sim >= 0.8) {
        senders.add(preprocessed[j].sender);
        matchedGroup.push(preprocessed[j].id);
      }
    }

    if (senders.size >= 3) {
      matchedGroup.forEach((id) => spamIds.add(id));
    }
  }

  // 3. Phân loại theo luật và cổng an toàn (có LLM thẩm định khi cần)
  const results: ModerationGateResult[] = [];

  for (const p of preprocessed) {
    // 3a. Spam đồng loạt
    if (spamIds.has(p.id)) {
      results.push({
        id: p.id,
        sender: p.sender,
        displayContent: p.displayContent,
        detectionContent: p.detectionContent,
        label: "spam",
        isQuarantined: true,
        quarantineReason: "Spam đồng loạt từ nhiều người gửi cùng nội dung",
        piiRedactions: p.piiRedactions,
        hasVideoPrivacyRisk: p.hasVideoPrivacyRisk,
      });
      continue;
    }

    // 3b. Rủi ro riêng tư trong video
    if (p.hasVideoPrivacyRisk) {
      results.push({
        id: p.id,
        sender: p.sender,
        displayContent: p.displayContent,
        detectionContent: p.detectionContent,
        label: "rui-ro-rieng-tu-trong-video",
        isQuarantined: true,
        quarantineReason:
          "CẢNH BÁO KHẨN: Góp ý báo video có nguy cơ làm lộ thông tin cá nhân",
        piiRedactions: p.piiRedactions,
        hasVideoPrivacyRisk: true,
      });
      continue;
    }

    // 3c. Chứa PII -> Luôn giữ chờ duyệt theo chính sách
    if (p.hasPii) {
      results.push({
        id: p.id,
        sender: p.sender,
        displayContent: p.displayContent,
        detectionContent: p.detectionContent,
        label: "co-pii",
        isQuarantined: true,
        quarantineReason: `Chứa thông tin cá nhân (${p.piiRedactions.map((r) => r.type).join(", ")})`,
        piiRedactions: p.piiRedactions,
        hasVideoPrivacyRisk: false,
      });
      continue;
    }

    // 3d. Kiểm tra luật từ điển
    const ruleRes = checkModerationLexiconRules(p.rawText);

    if (ruleRes.nhan === "cai-lenh") {
      results.push({
        id: p.id,
        sender: p.sender,
        displayContent: "[Nội dung cài lệnh bị cách ly]",
        detectionContent: p.detectionContent,
        label: "cai-lenh",
        isQuarantined: true,
        quarantineReason:
          ruleRes.lyDo || "Nội dung có dấu hiệu cài lệnh hệ thống",
        piiRedactions: p.piiRedactions,
        hasVideoPrivacyRisk: false,
      });
      continue;
    }

    if (ruleRes.nhan === "lac-de") {
      results.push({
        id: p.id,
        sender: p.sender,
        displayContent: p.displayContent,
        detectionContent: p.detectionContent,
        label: "lac-de",
        isQuarantined: true,
        quarantineReason: ruleRes.lyDo || "Lạc đề sang hành chính / khóa học",
        piiRedactions: p.piiRedactions,
        hasVideoPrivacyRisk: false,
      });
      continue;
    }

    if (ruleRes.nhan === "chi-cam-xuc") {
      results.push({
        id: p.id,
        sender: p.sender,
        displayContent: p.displayContent,
        detectionContent: p.detectionContent,
        label: "chi-cam-xuc",
        isQuarantined: false,
        quarantineReason: ruleRes.lyDo,
        piiRedactions: p.piiRedactions,
        hasVideoPrivacyRisk: false,
      });
      continue;
    }

    // Lớp an toàn LLM: chỉ chạy khi luật định cách ly vì công kích, hoặc luật chưa chắc chắn
    // LLM chỉ được hạ mức cách ly xuống, không tự cách ly thêm
    let finalLabel: ModerationLabel = ruleRes.nhan;
    let isQuarantined = ruleRes.nhan === "cong-kich-ca-nhan";
    let quarantineReason = isQuarantined
      ? ruleRes.lyDo || "Công kích cá nhân"
      : undefined;
    let yDungDuoc = ruleRes.yDungDuoc;

    const needsLlm =
      ruleRes.nhan === "cong-kich-ca-nhan" || ruleRes.chacChan === false;

    if (needsLlm) {
      if (options.llmClassifier) {
        try {
          const llmRes = await options.llmClassifier(p.displayContent);
          if (
            ruleRes.nhan === "cong-kich-ca-nhan" &&
            (llmRes.nhan === "an-toan" ||
              llmRes.nhan === "tho-tuc-noi-dung" ||
              llmRes.nhan === "chi-cam-xuc")
          ) {
            finalLabel = llmRes.nhan as ModerationLabel;
            isQuarantined = false;
            quarantineReason = undefined;
            yDungDuoc = llmRes.yDungDuoc || yDungDuoc;
          }
        } catch (err: any) {
          options.onWarning?.(
            `Góp ý ${p.id}: Lỗi khi gọi LLM kiểm duyệt an toàn: ${err.message}`,
          );
        }
      } else if (options.model) {
        try {
          const prompt = `Góp ý cần phân loại:\n<gop_y>\n${p.displayContent}\n</gop_y>`;
          const res = await generateText({
            model: options.model,
            system: PROMPT_AN_TOAN_SYSTEM,
            prompt,
            output: Output.object({ schema: SafetyClassificationOutput }),
          });
          const llmRes = res.output;
          if (
            ruleRes.nhan === "cong-kich-ca-nhan" &&
            (llmRes.nhan === "an-toan" ||
              llmRes.nhan === "tho-tuc-noi-dung" ||
              llmRes.nhan === "chi-cam-xuc")
          ) {
            finalLabel = llmRes.nhan as ModerationLabel;
            isQuarantined = false;
            quarantineReason = undefined;
            yDungDuoc = llmRes.yDungDuoc || yDungDuoc;
          }
        } catch (err: any) {
          options.onWarning?.(
            `Góp ý ${p.id}: Lỗi khi gọi model kiểm duyệt an toàn: ${err.message}`,
          );
        }
      } else {
        if (ruleRes.nhan === "cong-kich-ca-nhan") {
          options.onWarning?.(
            `Góp ý ${p.id}: Không có model kiểm duyệt an toàn; giữ cách ly theo bộ luật từ điển.`,
          );
        }
      }
    }

    let displayContent = p.displayContent;
    if (isQuarantined) {
      displayContent = "[Nội dung công kích cá nhân bị cách ly]";
    } else if (finalLabel === "tho-tuc-noi-dung") {
      displayContent = yDungDuoc || p.displayContent;
    }

    results.push({
      id: p.id,
      sender: p.sender,
      displayContent,
      detectionContent: p.detectionContent,
      label: finalLabel,
      isQuarantined,
      quarantineReason,
      yDungDuoc,
      piiRedactions: p.piiRedactions,
      hasVideoPrivacyRisk: false,
    });
  }

  return results;
}

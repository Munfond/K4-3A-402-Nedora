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

export function moderateFeedbackBatch(
  items: ModerationGateItem[],
  _llmClassifier?: (text: string) => Promise<ModerationRuleResult>,
): ModerationGateResult[] {
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

  // 3. Phân loại theo luật và cổng an toàn
  const results: ModerationGateResult[] = preprocessed.map((p) => {
    // 3a. Spam đồng loạt
    if (spamIds.has(p.id)) {
      return {
        id: p.id,
        sender: p.sender,
        displayContent: p.displayContent,
        detectionContent: p.detectionContent,
        label: "spam",
        isQuarantined: true,
        quarantineReason: "Spam đồng loạt từ nhiều người gửi cùng nội dung",
        piiRedactions: p.piiRedactions,
        hasVideoPrivacyRisk: p.hasVideoPrivacyRisk,
      };
    }

    // 3b. Rủi ro riêng tư trong video
    if (p.hasVideoPrivacyRisk) {
      return {
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
      };
    }

    // 3c. Chứa PII -> Luôn giữ chờ duyệt theo chính sách
    if (p.hasPii) {
      return {
        id: p.id,
        sender: p.sender,
        displayContent: p.displayContent,
        detectionContent: p.detectionContent,
        label: "co-pii",
        isQuarantined: true,
        quarantineReason: `Chứa thông tin cá nhân (${p.piiRedactions.map((r) => r.type).join(", ")})`,
        piiRedactions: p.piiRedactions,
        hasVideoPrivacyRisk: false,
      };
    }

    // 3d. Kiểm tra luật từ điển
    const ruleRes = checkModerationLexiconRules(p.rawText);

    if (ruleRes.nhan === "cai-lenh") {
      return {
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
      };
    }

    if (ruleRes.nhan === "cong-kich-ca-nhan") {
      return {
        id: p.id,
        sender: p.sender,
        displayContent: "[Nội dung công kích cá nhân bị cách ly]",
        detectionContent: p.detectionContent,
        label: "cong-kich-ca-nhan",
        isQuarantined: true,
        quarantineReason: ruleRes.lyDo || "Công kích cá nhân",
        piiRedactions: p.piiRedactions,
        hasVideoPrivacyRisk: false,
      };
    }

    if (ruleRes.nhan === "tho-tuc-noi-dung") {
      return {
        id: p.id,
        sender: p.sender,
        displayContent: ruleRes.yDungDuoc || p.displayContent,
        detectionContent: p.detectionContent,
        label: "tho-tuc-noi-dung",
        isQuarantined: false,
        yDungDuoc: ruleRes.yDungDuoc,
        piiRedactions: p.piiRedactions,
        hasVideoPrivacyRisk: false,
      };
    }

    if (ruleRes.nhan === "lac-de") {
      return {
        id: p.id,
        sender: p.sender,
        displayContent: p.displayContent,
        detectionContent: p.detectionContent,
        label: "lac-de",
        isQuarantined: true,
        quarantineReason: ruleRes.lyDo || "Lạc đề sang hành chính / khóa học",
        piiRedactions: p.piiRedactions,
        hasVideoPrivacyRisk: false,
      };
    }

    if (ruleRes.nhan === "chi-cam-xuc") {
      return {
        id: p.id,
        sender: p.sender,
        displayContent: p.displayContent,
        detectionContent: p.detectionContent,
        label: "chi-cam-xuc",
        isQuarantined: false,
        quarantineReason: ruleRes.lyDo,
        piiRedactions: p.piiRedactions,
        hasVideoPrivacyRisk: false,
      };
    }

    // Mặc định an toàn
    return {
      id: p.id,
      sender: p.sender,
      displayContent: p.displayContent,
      detectionContent: p.detectionContent,
      label: "an-toan",
      isQuarantined: false,
      piiRedactions: p.piiRedactions,
      hasVideoPrivacyRisk: false,
    };
  });

  return results;
}

import { LEXICON } from "./lexicon";
import { toDetection } from "./normalize";

export type ModerationLabel =
  | "an-toan"
  | "tho-tuc-noi-dung"
  | "cong-kich-ca-nhan"
  | "cai-lenh"
  | "co-pii"
  | "rui-ro-rieng-tu-trong-video"
  | "lac-de"
  | "spam"
  | "chi-cam-xuc";

export interface ModerationRuleResult {
  nhan: ModerationLabel;
  chacChan: boolean;
  lyDo?: string;
  yDungDuoc?: string;
}

const ONLY_EMOJI_REGEX = /^[\p{Extended_Pictographic}\s]+$/u;

export function checkModerationLexiconRules(
  rawText: string,
): ModerationRuleResult {
  const norm = toDetection(rawText);

  // 1. Kiểm tra chỉ cảm xúc / emoji
  if (ONLY_EMOJI_REGEX.test(rawText.trim())) {
    return {
      nhan: "chi-cam-xuc",
      chacChan: true,
      lyDo: "Nội dung chỉ gồm biểu tượng cảm xúc (emoji)",
    };
  }

  for (const cx of LEXICON.camXuc) {
    if (norm === cx || norm === `${cx} nha` || norm === `${cx} a`) {
      return {
        nhan: "chi-cam-xuc",
        chacChan: true,
        lyDo: "Nội dung khen ngợi hoặc cảm xúc chung, không có góp ý chỉnh sửa",
      };
    }
  }

  // 2. Kiểm tra cài lệnh (Prompt Injection)
  // 2a. Dấu vai trò
  for (const vr of LEXICON.caiLenh.dauVaiTro) {
    if (norm.includes(vr) || rawText.toLowerCase().includes(vr)) {
      return {
        nhan: "cai-lenh",
        chacChan: true,
        lyDo: `Chứa dấu phân tách vai trò hệ thống: '${vr}'`,
      };
    }
  }

  // 2b. Thao túng kết quả & Dò hỏi prompt
  if (
    norm.includes("system prompt") ||
    rawText.toLowerCase().includes("system prompt")
  ) {
    return {
      nhan: "cai-lenh",
      chacChan: true,
      lyDo: "Chứa yêu cầu dò hỏi system prompt hoặc nội quy hệ thống",
    };
  }

  for (const tt of LEXICON.caiLenh.thaoTung) {
    if (norm.includes(tt)) {
      return {
        nhan: "cai-lenh",
        chacChan: true,
        lyDo: `Chứa yêu cầu thao túng kết quả đầu ra: '${tt}'`,
      };
    }
  }

  // 2c. Động từ điều khiển + đối tượng
  let hasControlVerb = false;
  for (const dt of LEXICON.caiLenh.dongTu) {
    if (norm.includes(dt)) {
      hasControlVerb = true;
      break;
    }
  }

  if (hasControlVerb) {
    for (const obj of LEXICON.caiLenh.doiTuong) {
      if (norm.includes(obj)) {
        return {
          nhan: "cai-lenh",
          chacChan: true,
          lyDo: `Có cấu trúc ra lệnh cho AI (động từ điều khiển + đối tượng: '${obj}')`,
        };
      }
    }
  }

  // 2d. Yêu cầu đóng vai
  for (const vt of LEXICON.caiLenh.vaiTro) {
    if (norm.includes(vt)) {
      return {
        nhan: "cai-lenh",
        chacChan: true,
        lyDo: `Yêu cầu AI thay đổi vai trò: '${vt}'`,
      };
    }
  }

  function makeWordPattern(phrase: string): RegExp {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(
      `(?:^|[^\\p{L}\\p{N}])${escaped}(?:[^\\p{L}\\p{N}]|$)`,
      "iu",
    );
  }

  function extractNeutralFeedback(raw: string, normalized: string): string {
    if (
      normalized.includes("nhac") &&
      (normalized.includes("to") || normalized.includes("lon"))
    ) {
      return "Nhạc nền hơi to, lấn át tiếng nói";
    }
    if (
      normalized.includes("am thanh") ||
      normalized.includes("be") ||
      normalized.includes("nho") ||
      normalized.includes("nghe")
    ) {
      return "Âm thanh hơi nhỏ, khó nghe rõ lời";
    }
    if (normalized.includes("nhanh") || normalized.includes("nuot")) {
      return "Nói hơi nhanh ở một số đoạn";
    }
    if (normalized.includes("slide") || normalized.includes("chinh ta")) {
      return "Slide có chỗ sai chính tả cần chỉnh sửa";
    }
    let cleanIdea = raw;
    const allBadWords = [
      ...LEXICON.thoTucCoDau,
      ...LEXICON.thoTucKhongDau,
      ...LEXICON.congKich.tuCoDau,
      ...LEXICON.congKich.tuKhongDau,
    ];
    for (const bw of allBadWords) {
      cleanIdea = cleanIdea.replace(makeWordPattern(bw), " ");
    }
    return cleanIdea.replace(/\s+/g, " ").trim() || raw;
  }

  // 3. Kiểm tra công kích cá nhân (Đòi hỏi CẢ 2: từ miệt thị VÀ đối tượng là người)
  const nfc = rawText.normalize("NFC");
  let offensiveWord: string | null = null;
  for (const tu of LEXICON.congKich.tuCoDau) {
    if (makeWordPattern(tu).test(nfc)) {
      offensiveWord = tu;
      break;
    }
  }
  if (!offensiveWord) {
    for (const tu of LEXICON.congKich.tuKhongDau) {
      if (makeWordPattern(tu).test(norm)) {
        offensiveWord = tu;
        break;
      }
    }
  }

  let personTarget: string | null = null;
  for (const dt of LEXICON.congKich.doiTuongCoDau) {
    if (makeWordPattern(dt).test(nfc)) {
      personTarget = dt;
      break;
    }
  }
  if (!personTarget) {
    for (const dt of LEXICON.congKich.doiTuongKhongDau) {
      if (makeWordPattern(dt).test(norm)) {
        personTarget = dt;
        break;
      }
    }
  }

  // 3a. Có từ miệt thị VÀ có đối tượng người -> công kích cá nhân
  if (offensiveWord && personTarget) {
    return {
      nhan: "cong-kich-ca-nhan",
      chacChan: true,
      lyDo: `Công kích cá nhân nhắm vào ${personTarget} (từ ngữ: '${offensiveWord}')`,
    };
  }

  // 3b. Có từ miệt thị nhưng KHÔNG có đối tượng người -> tho-tuc-noi-dung (giữ ý, diễn đạt lại trung tính)
  if (offensiveWord && !personTarget) {
    const yDung = extractNeutralFeedback(rawText, norm);
    return {
      nhan: "tho-tuc-noi-dung",
      chacChan: false, // Cần thẩm định thêm nếu có model
      lyDo: `Có từ ngữ miệt thị ('${offensiveWord}') nhưng không nhắm vào đối tượng cá nhân cụ thể`,
      yDungDuoc: yDung,
    };
  }

  // 4. Kiểm tra thô tục cảm thán về nội dung
  let vulgarWord: string | null = null;
  for (const tt of LEXICON.thoTucCoDau) {
    if (makeWordPattern(tt).test(nfc)) {
      vulgarWord = tt;
      break;
    }
  }
  if (!vulgarWord) {
    for (const tt of LEXICON.thoTucKhongDau) {
      if (makeWordPattern(tt).test(norm)) {
        vulgarWord = tt;
        break;
      }
    }
  }

  if (vulgarWord) {
    if (personTarget) {
      return {
        nhan: "cong-kich-ca-nhan",
        chacChan: true,
        lyDo: `Sử dụng từ ngữ thô tục nhắm vào ${personTarget} ('${vulgarWord}')`,
      };
    }

    const yDung = extractNeutralFeedback(rawText, norm);
    return {
      nhan: "tho-tuc-noi-dung",
      chacChan: true,
      lyDo: `Có từ ngữ thô tục cảm thán ('${vulgarWord}') nhưng hướng về nội dung video`,
      yDungDuoc: yDung,
    };
  }

  // 5. Kiểm tra lạc đề hành chính
  for (const ld of LEXICON.lacDe) {
    if (norm.includes(ld)) {
      return {
        nhan: "lac-de",
        chacChan: true,
        lyDo: `Chủ đề liên quan đến hành chính/khóa học ('${ld}'), không phải nội dung video`,
      };
    }
  }

  return {
    nhan: "an-toan",
    chacChan: false,
  };
}

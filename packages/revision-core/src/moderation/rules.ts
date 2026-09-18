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

  // 3. Kiểm tra công kích cá nhân
  let offensiveWord: string | null = null;
  for (const tu of LEXICON.congKich.tu) {
    const wordPattern = new RegExp(
      `(?:^|[^\\p{L}\\p{N}])${tu}(?:[^\\p{L}\\p{N}]|$)`,
      "iu",
    );
    if (wordPattern.test(norm) || wordPattern.test(rawText)) {
      offensiveWord = tu;
      break;
    }
  }

  let personTarget: string | null = null;
  for (const dt of LEXICON.congKich.doiTuongNguoi) {
    const targetPattern = new RegExp(
      `(?:^|[^\\p{L}\\p{N}])${dt}(?:[^\\p{L}\\p{N}]|$)`,
      "iu",
    );
    if (targetPattern.test(norm)) {
      personTarget = dt;
      break;
    }
  }

  // Từ xúc phạm/công kích luôn được ưu tiên xử lý trước thô tục cảm thán
  if (offensiveWord) {
    return {
      nhan: "cong-kich-ca-nhan",
      chacChan: true,
      lyDo: personTarget
        ? `Công kích cá nhân nhắm vào ${personTarget} (từ ngữ: '${offensiveWord}')`
        : `Chứa từ ngữ miệt thị, xúc phạm: '${offensiveWord}'`,
    };
  }

  // 4. Kiểm tra thô tục cảm thán về nội dung
  let vulgarWord: string | null = null;
  for (const tt of LEXICON.thoTuc) {
    const vulgarPattern = new RegExp(
      `(?:^|[^\\p{L}\\p{N}])${tt}(?:[^\\p{L}\\p{N}]|$)`,
      "iu",
    );
    if (vulgarPattern.test(norm) || vulgarPattern.test(rawText.toLowerCase())) {
      vulgarWord = tt;
      break;
    }
  }

  if (vulgarWord) {
    if (personTarget) {
      return {
        nhan: "cong-kich-ca-nhan",
        chacChan: true,
        lyDo: `Sử dụng từ ngữ thô tục nhắm vào ${personTarget}`,
      };
    }

    // Thô tục về nội dung (ví dụ: "đm nhạc nền to vãi", "như cc", "slide như cứt")
    // Trích xuất ý nội dung sạch đã diễn đạt lại trung tính
    let yDung: string | undefined;
    if (
      norm.includes("nhac") &&
      (norm.includes("to") || norm.includes("lon"))
    ) {
      yDung = "Nhạc nền hơi to, lấn át tiếng nói";
    } else if (
      norm.includes("am thanh") ||
      norm.includes("be") ||
      norm.includes("nho") ||
      norm.includes("nghe")
    ) {
      yDung = "Âm thanh hơi nhỏ, khó nghe rõ lời";
    } else if (norm.includes("nhanh") || norm.includes("nuot")) {
      yDung = "Nói hơi nhanh ở một số đoạn";
    } else if (norm.includes("slide") || norm.includes("chinh ta")) {
      yDung = "Slide có chỗ sai chính tả cần chỉnh sửa";
    } else {
      let cleanIdea = rawText;
      for (const tt of LEXICON.thoTuc) {
        cleanIdea = cleanIdea
          .replace(new RegExp(`\\b${tt}\\b`, "gi"), "")
          .trim();
      }
      yDung = cleanIdea.replace(/\s+/g, " ").trim();
    }

    return {
      nhan: "tho-tuc-noi-dung",
      chacChan: true,
      lyDo: `Có từ ngữ thô tục cảm thán ('${vulgarWord}') nhưng hướng về nội dung video`,
      yDungDuoc: yDung || undefined,
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

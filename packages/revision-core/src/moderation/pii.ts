export interface PiiRedaction {
  type: string;
  count: number;
}

export interface PiiDetectionResult {
  text: string;
  redactions: PiiRedaction[];
  hasPii: boolean;
  hasVideoPrivacyRisk: boolean;
}

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

const OBFUSCATED_EMAIL_REGEX =
  /[\p{L}\p{N}._%+-]+\s*[[(]\s*(?:at|a còng)\s*[\])]\s*[\p{L}\p{N}.-]+(?:\s*[[(]\s*(?:dot|chấm)\s*[\])]\s*[\p{L}\p{N}-]+)+/giu;

const URL_REGEX = /https?:\/\/[^\s]+/g;
const BARE_LINK_REGEX =
  /(?<![\p{L}\p{N}@.])(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\/[^\s,;]*/giu;
const HANDLE_REGEX = /@[A-Za-z0-9_.-]+/g;

// Số điện thoại Việt Nam (+84 hoặc 0 và 9 số)
const VN_PHONE_REGEX =
  /(?<![\p{L}\p{N}])(?:\+84|0)(?:[\s.-]*\d){9}(?![\p{L}\p{N}])/gu;

// Ngày tháng
const DATE_REGEX =
  /(?<![\p{L}\p{N}./-])\d{1,2}[/.-]\d{1,2}[/.-](?:\d{4}|\d{2})(?![\p{L}\p{N}]|[/.-]\d)/gu;

// Mã có từ khóa báo hiệu
const RECORD_CODE_REGEX =
  /(?<![\p{L}\p{N}])(?:(?:HV|SV|GV|MSSV|MSV|MSHV)[-\s]?\d{4,}|(?:mssv|msv|mshv|mã (?:số )?(?:hồ sơ|sinh viên|học viên|nhân viên))\s*[:#]?\s*[\p{L}\p{N}-]*\d[\p{L}\p{N}-]*)(?![\p{L}\p{N}])/giu;

// Mã sinh viên dạng chữ-số không từ khóa (vd: 21DH110234, B2012345, 522h0101)
const ALPHANUMERIC_STUDENT_ID_REGEX =
  /(?<![\p{L}\p{N}])(?:\d{2}[A-Za-z]{2,5}\d{3,}|[A-Za-z]{1,2}\d{6,8}|\d{3}[A-Za-z]\d{4,})(?![\p{L}\p{N}])/gu;

// Mã lớp: "lớp 21CNTT1", "lớp 22DTH01"
const CLASS_CODE_REGEX =
  /(?<![\p{L}\p{N}])(lớp\s+)([A-Za-z0-9-]+)(?![\p{L}\p{N}])/giu;

// Khóa + số thứ tự: "k65 số 0123", "k66 1234"
const BATCH_NUMBER_REGEX =
  /(?<![\p{L}\p{N}])k\d{2,3}\s+(?:số\s+)?\d+(?![\p{L}\p{N}])/giu;

// Số tài khoản sau từ "tài khoản/stk"
const BANK_ACCOUNT_REGEX =
  /(?<![\p{L}\p{N}])(?:(?:số\s+)?tài\s+khoản|stk)\s*[:#]?\s*\d{6,}(?![\p{L}\p{N}])/giu;

// Dãy số liên tiếp >= 7 chữ số (CCCD, CMND, MST)
const LONG_DIGITS_REGEX = /(?<![\p{L}\p{N}-])\d{7,}(?![\p{L}\p{N}-])/gu;

// Địa chỉ sau từ báo hiệu
const ADDRESS_REGEX =
  /(?<![\p{L}])(?:địa chỉ|nhà (?:em|mình|tôi) ở|sống ở|ở số)\s*[:-]?\s*[^,.;!?\n]+/giu;

// Tên người họ Việt
const VN_SURNAMES =
  "Nguyễn|Trần|Lê|Phạm|Hoàng|Huỳnh|Phan|Vũ|Võ|Đặng|Bùi|Đỗ|Hồ|Ngô|Dương|Lý|Đinh|Trương|Lâm|Đoàn|Lương|Trịnh|Tạ|Chu|Cao|Tô|Châu|Quách|Thái|Kiều|Mạc|Hứa|Vương|Phùng|Tăng|La|Lưu|Diệp|Triệu";
const FULL_NAME_REGEX = new RegExp(
  String.raw`(?<![\p{L}])(?:${VN_SURNAMES})(?:\s+\p{Lu}(?:\p{Ll}+|\.)?)(?:\s*\p{Lu}(?:\p{Ll}+|\.)?){0,2}(?![\p{L}])`,
  "gu",
);

// Tên sau mẫu tự giới thiệu (vd: "Em tên Minh Anh")
const INTRO_NAME_REGEX =
  /(?<![\p{L}])((?:[Tt]ên (?:tôi|em|mình|con) là|(?:[Tt]ôi|[Ee]m|[Mm]ình) tên(?: là)?|(?:[Tt]ôi|[Ee]m|[Mm]ình) là)\s+)(\p{Lu}\p{Ll}*(?:\s+\p{Lu}(?:\p{Ll}+|\.)){0,3})/gu;

// Tên sau xưng hô: "bạn Minh", "thầy Tuấn", "cô Hoa"
const HONORIFIC_NAME_REGEX =
  /(?<![\p{L}])((?:bạn|thầy|cô|anh|chị)\s+)(\p{Lu}\p{Ll}+(?:\s+\p{Lu}\p{Ll}+){0,2})(?![\p{L}])/gu;

// Dấu hiệu góp ý báo video làm lộ dữ liệu riêng tư
const VIDEO_PRIVACY_RISK_REGEX =
  /(?:video\s+.*?(?:bị\s+lộ|làm\s+lộ|lộ|chứa)\s+.*?(?:thông\s+tin\s+cá\s+nhân|thông\s+tin|dữ\s+liệu|cccd|cmnd|sđt|email|mã\s+sv|tài\s+khoản))|(?:(?:bị\s+lộ|làm\s+lộ|lộ|chứa)\s+.*?(?:thông\s+tin\s+cá\s+nhân|thông\s+tin|dữ\s+liệu|cccd|cmnd|sđt|email|mã\s+sv|tài\s+khoản).*?video)/iu;

export function detectAndRedactPii(
  text: string,
  { heuristics = true }: { heuristics?: boolean } = {},
): PiiDetectionResult {
  const counts = new Map<string, number>();
  let res = text;

  const hasVideoPrivacyRisk = VIDEO_PRIVACY_RISK_REGEX.test(text);

  const apply = (
    regex: RegExp,
    type: string,
    replacement: string,
    prefixPreserve?: boolean,
  ) => {
    res = res.replace(regex, (...args: unknown[]) => {
      counts.set(type, (counts.get(type) ?? 0) + 1);
      if (
        prefixPreserve &&
        typeof args[1] === "string" &&
        typeof args[2] === "string"
      ) {
        return `${args[1]}${replacement}`;
      }
      return replacement;
    });
  };

  apply(EMAIL_REGEX, "email", "[EMAIL]");
  apply(OBFUSCATED_EMAIL_REGEX, "email", "[EMAIL]");
  apply(URL_REGEX, "lien-ket", "[LIÊN-KẾT]");
  apply(BARE_LINK_REGEX, "lien-ket", "[LIÊN-KẾT]");
  apply(HANDLE_REGEX, "lien-ket", "[LIÊN-KẾT]");
  apply(VN_PHONE_REGEX, "so-dien-thoai", "[SĐT]");
  apply(DATE_REGEX, "ngay", "[NGÀY]");
  apply(RECORD_CODE_REGEX, "ma-ho-so", "[MÃ-SỐ]");
  apply(ALPHANUMERIC_STUDENT_ID_REGEX, "ma-sinh-vien", "[MÃ-SV]");
  apply(CLASS_CODE_REGEX, "ma-lop", "[LỚP]", true);
  apply(BATCH_NUMBER_REGEX, "ma-khoa-so", "[MÃ-SỐ]");
  apply(BANK_ACCOUNT_REGEX, "so-tai-khoan", "[STK]");
  apply(LONG_DIGITS_REGEX, "ma-so", "[MÃ-SỐ]");

  if (heuristics) {
    apply(ADDRESS_REGEX, "dia-chi", "[ĐỊA-CHỈ]");
    apply(INTRO_NAME_REGEX, "ten", "[TÊN]", true);
    apply(HONORIFIC_NAME_REGEX, "ten", "[TÊN]", true);
    apply(FULL_NAME_REGEX, "ten", "[TÊN]");
  }

  const redactions: PiiRedaction[] = Array.from(counts.entries()).map(
    ([type, count]) => ({ type, count }),
  );

  return {
    text: res,
    redactions,
    hasPii: redactions.length > 0,
    hasVideoPrivacyRisk,
  };
}

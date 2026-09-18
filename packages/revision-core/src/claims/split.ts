import type { FeedbackItem } from "../types";
import type { Claim, Intent } from "./types";
import { extractTimeMentions } from "./time-mentions";

/**
 * Phân loại ý định (Intent) của một mệnh đề góp ý bằng tập luật chính xác cao.
 */
export function classifyIntent(text: string): Intent {
  const norm = text.toLowerCase();

  // Helper kiểm tra từ đơn nguyên vẹn
  const hasWord = (word: string) => {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${word}(?![\\p{L}\\p{N}])`, "iu");
    return re.test(norm);
  };

  // 1. Khen ngợi & Giữ nguyên (Ưu tiên nhận diện nếu là lời khen)
  if (
    norm.includes("rất hay") ||
    norm.includes("rat hay") ||
    norm.includes("tuyệt vời") ||
    norm.includes("tuyet voi") ||
    norm.includes("cảm ơn") ||
    norm.includes("cam on") ||
    norm.includes("dễ hiểu") ||
    norm.includes("de hieu") ||
    (hasWord("tốt") && !norm.includes("chưa tốt")) ||
    (hasWord("hay") && !norm.includes("chưa hay"))
  ) {
    return "khen-giu";
  }

  // 2. Đề nghị chung (Ý kiến bao quát bài học, tài liệu, tóm tắt...)
  if (
    norm.includes("đề nghị") ||
    norm.includes("de nghi") ||
    norm.includes("đề xuất") ||
    norm.includes("de xuat") ||
    norm.includes("nên có thêm") ||
    norm.includes("nen co them") ||
    norm.includes("tài liệu") ||
    norm.includes("tai lieu") ||
    norm.includes("tóm tắt") ||
    norm.includes("tom tat")
  ) {
    return "de-nghi-chung";
  }

  // 3. Phụ đề (Subtitles)
  if (
    norm.includes("phụ đề") ||
    norm.includes("phu de") ||
    hasWord("subtitle") ||
    hasWord("sub") ||
    hasWord("caption")
  ) {
    return "phu-de";
  }

  // 4. Nhịp độ - Khoảng dừng
  if (
    norm.includes("khoảng dừng") ||
    norm.includes("khoang dung") ||
    norm.includes("ngắt câu") ||
    norm.includes("ngat cau") ||
    norm.includes("lấy hơi") ||
    norm.includes("lay hoi") ||
    norm.includes("dừng đột ngột")
  ) {
    return "nhip-khoang-dung";
  }

  // 5. Nhịp độ - Tốc độ nói
  if (
    norm.includes("nói nhanh") ||
    norm.includes("noi nhanh") ||
    norm.includes("nuốt chữ") ||
    norm.includes("nuot chu") ||
    norm.includes("nói chậm") ||
    norm.includes("noi cham") ||
    norm.includes("buồn ngủ") ||
    norm.includes("buon ngu") ||
    norm.includes("tốc độ") ||
    norm.includes("toc do") ||
    norm.includes("nhịp độ") ||
    norm.includes("nhip do") ||
    hasWord("nhanh") ||
    hasWord("chậm")
  ) {
    return "nhip-toc-do";
  }

  // 6. Âm thanh & Nhạc nền
  if (
    norm.includes("âm thanh") ||
    norm.includes("am thanh") ||
    norm.includes("nhạc nền") ||
    norm.includes("nhac nen") ||
    hasWord("tiếng") ||
    hasWord("tieng") ||
    hasWord("micro") ||
    hasWord("mic") ||
    hasWord("rè") ||
    hasWord("re") ||
    hasWord("ồn") ||
    hasWord("on") ||
    norm.includes("volume") ||
    (norm.includes("nghe") &&
      (norm.includes("bé") || norm.includes("nhỏ") || norm.includes("to")))
  ) {
    return "am-thanh";
  }

  // 7. Giọng đọc & Phát âm
  if (
    norm.includes("phát âm") ||
    norm.includes("phat am") ||
    norm.includes("giọng đọc") ||
    norm.includes("giong doc") ||
    norm.includes("ngữ điệu") ||
    norm.includes("ngu dieu") ||
    norm.includes("nhấn nhá") ||
    norm.includes("nhan nha") ||
    norm.includes("đọc vấp") ||
    norm.includes("doc vap")
  ) {
    return "giong-doc";
  }

  // 8. Nội dung sai (Factual error / Misstatement)
  if (
    norm.includes("sai") ||
    norm.includes("nhầm") ||
    norm.includes("nham") ||
    norm.includes("chưa đúng") ||
    norm.includes("chua dung") ||
    norm.includes("định nghĩa") ||
    norm.includes("dinh nghia") ||
    norm.includes("chính tả") ||
    norm.includes("chinh ta")
  ) {
    return "noi-dung-sai";
  }

  // 9. Khó hiểu / Trừu tượng
  if (
    norm.includes("khó hiểu") ||
    norm.includes("kho hieu") ||
    norm.includes("trừu tượng") ||
    norm.includes("tru tuong") ||
    norm.includes("chưa rõ") ||
    norm.includes("chua ro") ||
    norm.includes("thiếu ví dụ") ||
    norm.includes("thieu vi du") ||
    norm.includes("mông lung") ||
    norm.includes("mong lung")
  ) {
    return "kho-hieu";
  }

  // 10. Hình ảnh & Slide
  if (
    hasWord("slide") ||
    hasWord("hình") ||
    hasWord("hinh") ||
    hasWord("ảnh") ||
    hasWord("anh") ||
    norm.includes("hình ảnh") ||
    norm.includes("chữ trên") ||
    norm.includes("chu tren") ||
    hasWord("font") ||
    norm.includes("bố cục") ||
    norm.includes("bo cuc") ||
    norm.includes("màu sắc") ||
    norm.includes("mau sac") ||
    hasWord("mờ") ||
    hasWord("mo")
  ) {
    return "hinh-anh";
  }

  return "nhieu";
}

/**
 * Phân tách một phản hồi (FeedbackItem) thành 1 hoặc nhiều ý góp ý độc lập (Claims).
 * Xử lý góp ý phức hợp (compound feedback) có liên từ nối và đề cập nhiều khía cạnh khác nhau.
 */
export function splitFeedbackToClaims(item: FeedbackItem): Claim[] {
  const text = (item.sanitizedText || "").trim();
  if (!text) {
    return [];
  }

  // Xác định vai trò từ sender (hv-..., tg-..., gv-...)
  let role: Claim["role"] = "khac";
  if (item.sender.startsWith("hv-")) role = "hv";
  else if (item.sender.startsWith("tg-")) role = "tg";
  else if (item.sender.startsWith("gv-")) role = "gv";

  // Thử phân tách các mệnh đề bằng liên từ và dấu câu
  const clauses = text
    .split(/(?:\s+(?:và|nhưng|đồng thời|với lại|ngoài ra|còn)\s+|;\s*|\n+)/iu)
    .map((c) => c.trim())
    .filter((c) => c.length >= 5);

  // Nếu chỉ có 1 mệnh đề hoặc các mệnh đề cùng một chủ đề
  if (clauses.length <= 1) {
    const intent = classifyIntent(text);
    const tm = extractTimeMentions(text);
    return [
      {
        id: `clm-${item.id}-1`,
        feedbackId: item.id,
        sender: item.sender,
        role,
        intent,
        trich: text.slice(0, 80).trim(),
        goiYViTri: tm ? tm.raw : undefined,
        mocNoi: tm ? { tu: tm.tu, den: tm.den, nguon: tm.raw } : undefined,
        baoGianTiep: false,
        lanHoiLai: 0,
      },
    ];
  }

  // Kiểm tra xem các mệnh đề có chủ đề (intent) khác nhau không
  const intents = clauses.map((c) => classifyIntent(c));
  const uniqueIntents = new Set(intents);

  // Nếu các mệnh đề mang các intent khác nhau -> Tách thành các claim riêng
  if (uniqueIntents.size > 1 || clauses.length >= 2) {
    const claims: Claim[] = [];
    for (let i = 0; i < clauses.length; i++) {
      const clause = clauses[i];
      const tm = extractTimeMentions(clause) || extractTimeMentions(text);
      claims.push({
        id: `clm-${item.id}-${i + 1}`,
        feedbackId: item.id,
        sender: item.sender,
        role,
        intent: intents[i],
        trich: clause.slice(0, 80).trim(),
        goiYViTri: tm ? tm.raw : undefined,
        mocNoi: tm ? { tu: tm.tu, den: tm.den, nguon: tm.raw } : undefined,
        baoGianTiep: false,
        lanHoiLai: 0,
      });
    }
    return claims;
  }

  // Nếu cùng intent, giữ làm 1 claim duy nhất
  const tm = extractTimeMentions(text);
  return [
    {
      id: `clm-${item.id}-1`,
      feedbackId: item.id,
      sender: item.sender,
      role,
      intent: intents[0],
      trich: text.slice(0, 80).trim(),
      goiYViTri: tm ? tm.raw : undefined,
      mocNoi: tm ? { tu: tm.tu, den: tm.den, nguon: tm.raw } : undefined,
      baoGianTiep: false,
      lanHoiLai: 0,
    },
  ];
}

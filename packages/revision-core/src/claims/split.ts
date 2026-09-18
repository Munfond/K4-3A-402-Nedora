import { PROMPT_TACH_Y_SYSTEM, ClaimExtractionSchema } from "@feedback/ai";
import { generateObject, type LanguageModel } from "ai";
import type { FeedbackItem } from "../types";
import type { Claim, Intent } from "./types";
import { extractTimeMentions } from "./time-mentions";

/**
 * Phân loại ý định (Intent) của một mệnh đề góp ý bằng tập luật chính xác cao.
 * Hoạt động trên văn bản tiếng Việt còn dấu, không bắt nhầm chuỗi con.
 */
export function classifyIntent(text: string): Intent {
  const norm = text.toLowerCase().normalize("NFC");

  // Helper kiểm tra từ đơn nguyên vẹn không ngắt sai ký tự có dấu
  const hasWord = (word: string) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `(?:^|[^\\p{L}\\p{N}])${escaped}(?:[^\\p{L}\\p{N}]|$)`,
      "iu",
    );
    return re.test(norm);
  };

  // 1. Khen ngợi & Giữ nguyên
  if (
    norm.includes("rất hay") ||
    norm.includes("rat hay") ||
    norm.includes("tuyệt vời") ||
    norm.includes("tuyet voi") ||
    norm.includes("cảm ơn") ||
    norm.includes("cam on") ||
    norm.includes("dễ hiểu") ||
    norm.includes("de hieu") ||
    norm.includes("dễ nhớ") ||
    norm.includes("hay nhất") ||
    norm.includes("mới vỡ ra") ||
    norm.includes("phản hồi tốt") ||
    (norm.includes("giữ nguyên") && !norm.includes("không nên giữ")) ||
    (hasWord("tốt") && !norm.includes("chưa tốt")) ||
    (hasWord("hay") &&
      !norm.includes("chưa hay") &&
      !norm.includes("hay bị") &&
      !norm.includes("hay là"))
  ) {
    return "khen-giu";
  }

  // 2. Nhịp độ - Khoảng dừng (Ưu tiên nhận diện khoảng dừng suy nghĩ)
  if (
    norm.includes("khoảng dừng") ||
    norm.includes("khoang dung") ||
    norm.includes("ngắt câu") ||
    norm.includes("ngat cau") ||
    norm.includes("lấy hơi") ||
    norm.includes("lay hoi") ||
    norm.includes("dừng đột ngột") ||
    norm.includes("suy nghĩ ngắn") ||
    norm.includes("suy nghĩ hơi dài") ||
    norm.includes("giây suy nghĩ") ||
    norm.includes("chưa kịp nghĩ") ||
    norm.includes("sốt ruột") ||
    norm.includes("rút ngắn lại")
  ) {
    return "nhip-khoang-dung";
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

  // 4. Âm thanh & Nhạc nền (Tránh nhầm tiếng Việt / tiếng Anh)
  const isLanguageMention =
    norm.includes("tiếng việt") ||
    norm.includes("tiếng anh") ||
    norm.includes("tieng viet") ||
    norm.includes("tieng anh");

  if (
    norm.includes("âm thanh") ||
    norm.includes("am thanh") ||
    norm.includes("nhạc nền") ||
    norm.includes("nhac nen") ||
    norm.includes("micro") ||
    norm.includes("mic") ||
    norm.includes("rè") ||
    norm.includes("ồn") ||
    norm.includes("volume") ||
    norm.includes("âm lượng") ||
    norm.includes("lấn át") ||
    norm.includes("át giọng") ||
    (!isLanguageMention &&
      hasWord("tiếng") &&
      (norm.includes("nhạc") ||
        norm.includes("nói") ||
        norm.includes("đọc") ||
        norm.includes("to") ||
        norm.includes("nhỏ") ||
        norm.includes("bé"))) ||
    (norm.includes("nghe") &&
      (norm.includes("bé") || norm.includes("nhỏ") || norm.includes("to hơn")))
  ) {
    return "am-thanh";
  }

  // 5. Khó hiểu / Trừu tượng / Lẫn lộn khái niệm
  if (
    norm.includes("khó hiểu") ||
    norm.includes("kho hieu") ||
    norm.includes("trừu tượng") ||
    norm.includes("chưa rõ") ||
    norm.includes("không rõ") ||
    norm.includes("thiếu ví dụ") ||
    norm.includes("mông lung") ||
    norm.includes("mới hiểu") ||
    norm.includes("ba lần mới hiểu") ||
    norm.includes("nghe ba lần") ||
    norm.includes("vẫn thấy lẫn") ||
    norm.includes("thấy lẫn") ||
    norm.includes("cứ lẫn") ||
    norm.includes("lẫn giữa") ||
    norm.includes("vẫn lẫn") ||
    norm.includes("rốt cuộc") ||
    norm.includes("phân biệt")
  ) {
    return "kho-hieu";
  }

  // 6. Nhịp độ - Tốc độ nói
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
    norm.includes("hơi nhanh") ||
    norm.includes("không kịp ghi") ||
    hasWord("nhanh") ||
    hasWord("chậm")
  ) {
    return "nhip-toc-do";
  }

  // 7. Giọng đọc & Phát âm
  if (
    norm.includes("phát âm") ||
    norm.includes("phat am") ||
    norm.includes("giọng đọc") ||
    norm.includes("giong doc") ||
    norm.includes("ngữ điệu") ||
    norm.includes("nhấn nhá") ||
    norm.includes("đọc vấp")
  ) {
    return "giong-doc";
  }

  // 8. Nội dung sai / Sai kiến thức / Câu cụt
  if (
    norm.includes("sai") ||
    norm.includes("nhầm") ||
    norm.includes("chưa đúng") ||
    norm.includes("định nghĩa") ||
    norm.includes("chính tả") ||
    norm.includes("hơi cụt") ||
    norm.includes("câu chốt")
  ) {
    return "noi-dung-sai";
  }

  // 9a. Đề xuất tài liệu / tóm tắt / bổ sung chung (Ưu tiên trước hình ảnh slide)
  if (
    norm.includes("tóm tắt") ||
    norm.includes("tài liệu") ||
    norm.includes("thêm slide") ||
    norm.includes("có thêm slide") ||
    norm.includes("thêm ví dụ") ||
    norm.includes("ví dụ về tiếng việt") ||
    norm.includes("ví dụ tiếng việt")
  ) {
    return "de-nghi-chung";
  }

  // 9. Hình ảnh & Slide (KHÔNG khớp 'hình' trong 'mô hình')
  const isModelOnly =
    norm.includes("mô hình") &&
    !norm.includes("hình ảnh") &&
    !norm.includes("chữ trên") &&
    !norm.includes("slide");

  if (
    !isModelOnly &&
    (hasWord("slide") ||
      norm.includes("hình ảnh") ||
      norm.includes("chữ trên") ||
      norm.includes("màn hình") ||
      norm.includes("ba thẻ") ||
      hasWord("ảnh") ||
      hasWord("font") ||
      norm.includes("bố cục") ||
      norm.includes("màu sắc") ||
      hasWord("mờ"))
  ) {
    return "hinh-anh";
  }

  // 10. Đề nghị chung (Bao gồm đề nghị thêm ví dụ tiếng Việt, v.v.)
  if (
    norm.includes("đề nghị") ||
    norm.includes("đề xuất") ||
    norm.includes("nên có") ||
    norm.includes("ví dụ") ||
    norm.includes("tài liệu") ||
    norm.includes("tóm tắt") ||
    isLanguageMention
  ) {
    return "de-nghi-chung";
  }

  return "de-nghi-chung";
}

function determineChiDan(
  text: string,
  intent: Intent,
): "sua" | "giu" | "khen" | "hoi" {
  const norm = text.toLowerCase();
  if (intent === "khen-giu") {
    if (norm.includes("giữ") || norm.includes("giu")) return "giu";
    return "khen";
  }
  if (
    norm.includes("?") ||
    norm.includes("không rõ") ||
    norm.includes("chưa rõ") ||
    norm.includes("rốt cuộc") ||
    norm.includes("có phải là") ||
    norm.includes("hỏi")
  ) {
    return "hoi";
  }
  return "sua";
}

/**
 * Phân tách một phản hồi (FeedbackItem) thành 1 hoặc nhiều ý góp ý độc lập (Claims).
 * Xử lý góp ý phức hợp (compound feedback) có liên từ nối và đề cập nhiều khía cạnh khác nhau.
 */
export function splitFeedbackToClaims(item: FeedbackItem): Claim[] {
  const text = (item.sanitizedText || item.rawText || "").trim();
  if (!text) {
    return [];
  }

  let role: Claim["role"] = "khac";
  if (item.sender.startsWith("hv-")) role = "hv";
  else if (item.sender.startsWith("tg-")) role = "tg";
  else if (item.sender.startsWith("gv-")) role = "gv";

  // Phân tách các mệnh đề bằng liên từ và dấu câu
  const clauses = text
    .split(/(?:\s+(?:và|nhưng|đồng thời|với lại|ngoài ra|còn)\s+|;\s*|\n+)/iu)
    .map((c) => c.trim())
    .filter((c) => c.length >= 5);

  if (clauses.length <= 1) {
    const intent = classifyIntent(text);
    const tm = extractTimeMentions(text);
    const chiDan = determineChiDan(text, intent);
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
        chiDan,
        baoGianTiep: false,
        lanHoiLai: 0,
        heuristicIntent: intent,
      },
    ];
  }

  const intents = clauses.map((c) => classifyIntent(c));
  const uniqueIntents = new Set(intents);

  if (uniqueIntents.size > 1 || clauses.length >= 2) {
    const claims: Claim[] = [];
    for (let i = 0; i < clauses.length; i++) {
      const clause = clauses[i];
      const tm = extractTimeMentions(clause) || extractTimeMentions(text);
      const chiDan = determineChiDan(clause, intents[i]);
      claims.push({
        id: `clm-${item.id}-${i + 1}`,
        feedbackId: item.id,
        sender: item.sender,
        role,
        intent: intents[i],
        trich: clause.slice(0, 80).trim(),
        goiYViTri: tm ? tm.raw : undefined,
        mocNoi: tm ? { tu: tm.tu, den: tm.den, nguon: tm.raw } : undefined,
        chiDan,
        baoGianTiep: false,
        lanHoiLai: 0,
        heuristicIntent: intents[i],
      });
    }
    return claims;
  }

  const tm = extractTimeMentions(text);
  const chiDan = determineChiDan(text, intents[0]);
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
      chiDan,
      baoGianTiep: false,
      lanHoiLai: 0,
      heuristicIntent: intents[0],
    },
  ];
}

/**
 * Tách ý và phân loại intent cho toàn bộ danh sách góp ý.
 * Dùng generateObject với LLM nếu có model; fallback về bộ luật tất định nếu không có.
 */
export async function splitFeedbackBatch(
  items: FeedbackItem[],
  options?: {
    model?: LanguageModel | null;
    modelMode?: "that" | "gia-lap";
    signal?: AbortSignal;
    onWarning?: (msg: string) => void;
  },
): Promise<Claim[]> {
  // Nếu có model thật: Dùng generateObject với PROMPT_TACH_Y_SYSTEM
  if (options?.model) {
    try {
      const payload = items.map((it) => ({
        id: it.id,
        sender: it.sender,
        text: it.sanitizedText || it.rawText || "",
      }));
      const prompt = `Danh sách phản hồi cần tách ý và phân loại:\n${JSON.stringify(payload, null, 2)}`;

      const res = await generateObject({
        model: options.model,
        system: PROMPT_TACH_Y_SYSTEM,
        prompt,
        schema: ClaimExtractionSchema,
        abortSignal: options.signal,
      });

      const extractedClaims = res.object.claims;
      const resultClaims: Claim[] = [];

      for (let i = 0; i < extractedClaims.length; i++) {
        const ec = extractedClaims[i];
        const origItem = items.find((it) => it.id === ec.feedbackId);
        const sender = origItem?.sender || "nguoi-dung";
        let role: Claim["role"] = "khac";
        if (sender.startsWith("hv-")) role = "hv";
        else if (sender.startsWith("tg-")) role = "tg";
        else if (sender.startsWith("gv-")) role = "gv";

        // Mốc thời gian tất định trích bằng code
        const tm =
          extractTimeMentions(ec.trich) ||
          (origItem
            ? extractTimeMentions(
                origItem.sanitizedText || origItem.rawText || "",
              )
            : null);

        const mocNoi = tm
          ? { tu: tm.tu, den: tm.den, nguon: tm.raw }
          : ec.mocNoi
            ? { tu: ec.mocNoi.tu, den: ec.mocNoi.den, nguon: ec.mocNoi.nguon }
            : undefined;

        // Tín hiệu phụ heuristic ghi vào trace
        const heuristicIntent = classifyIntent(ec.trich);

        resultClaims.push({
          id: `clm-${ec.feedbackId}-${i + 1}`,
          feedbackId: ec.feedbackId,
          sender,
          role,
          intent: ec.intent as Intent,
          trich: ec.trich.slice(0, 80).trim(),
          goiYViTri: tm ? tm.raw : (ec.goiYViTri ?? undefined),
          mocNoi,
          chiDan: ec.chiDan,
          baoGianTiep: false,
          lanHoiLai: 0,
          heuristicIntent,
        });
      }

      if (resultClaims.length > 0) {
        return resultClaims;
      }
    } catch (err: any) {
      options?.onWarning?.(
        `Lỗi khi gọi model tách ý: ${err.message}. Sử dụng bộ luật tất định.`,
      );
    }
  }

  // Fallback tất định: Chạy splitFeedbackToClaims cho từng item
  const allClaims: Claim[] = [];
  for (const item of items) {
    const claims = splitFeedbackToClaims(item);
    allClaims.push(...claims);
  }
  return allClaims;
}

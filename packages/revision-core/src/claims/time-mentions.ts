import { parseTimecodeSeconds } from "../video-index/timecode";

export interface ExtractedTimeRange {
  tu: number;
  den: number;
  raw: string;
  isSentenceNumber?: boolean;
  sentenceN?: number;
}

/**
 * Trích xuất các mốc hoặc khoảng thời gian được người góp ý đề cập trong văn bản.
 * Ví dụ:
 * - "từ 1:00 đến 1:30": { tu: 60, den: 90 }
 * - "phút 1:15": { tu: 75, den: 75 }
 * - "00:35 - 00:50": { tu: 35, den: 50 }
 * - "đoạn 35s": { tu: 35, den: 35 }
 * - "câu 5", "câu số 12": { sentenceN: 5 }
 */
export function extractTimeMentions(text: string): ExtractedTimeRange | null {
  if (!text) return null;

  // 1. Nhắc số câu: "câu 5", "câu số 12", "ở câu 18"
  const cauMatch = /(?:ở\s+)?câu(?:\s+số)?\s+(\d+)\b/iu.exec(text);
  if (cauMatch) {
    const n = parseInt(cauMatch[1], 10);
    return {
      tu: 0,
      den: 0,
      raw: cauMatch[0].trim(),
      isSentenceNumber: true,
      sentenceN: n,
    };
  }

  // 2. Khoảng thời gian dạng: từ mm:ss đến mm:ss hoặc mm:ss - mm:ss
  const rangeMatch =
    /(?:từ\s+)?(\d{1,2}:\d{2}(?:\.\d+)?)\s*(?:đến|-|tới)\s*(\d{1,2}:\d{2}(?:\.\d+)?)/iu.exec(
      text,
    );
  if (rangeMatch) {
    const tu = parseTimecodeSeconds(rangeMatch[1]);
    const den = parseTimecodeSeconds(rangeMatch[2]);
    return {
      tu,
      den,
      raw: rangeMatch[0].trim(),
    };
  }

  // 3. Khoảng giây: "từ 60s đến 90s" hoặc "60-90s"
  const secRangeMatch =
    /(?:từ\s+)?(\d+)\s*(?:s|giây)?\s*(?:đến|-|tới)\s*(\d+)\s*(?:s|giây)/iu.exec(
      text,
    );
  if (secRangeMatch) {
    const tu = parseInt(secRangeMatch[1], 10);
    const den = parseInt(secRangeMatch[2], 10);
    return {
      tu,
      den,
      raw: secRangeMatch[0].trim(),
    };
  }

  // 4. Mốc thời gian đơn lẻ: "ở phút 1:15", "đoạn 02:10", "1:20"
  const singleMatch =
    /(?:ở\s+|phút\s+|đoạn\s+)?(\d{1,2}:\d{2}(?:\.\d+)?)/iu.exec(text);
  if (singleMatch) {
    const sec = parseTimecodeSeconds(singleMatch[1]);
    return {
      tu: sec,
      den: sec,
      raw: singleMatch[0].trim(),
    };
  }

  // 5. Dạng 1p20, 2phút15
  const pMatch = /(\d+)\s*(?:p|phút|phut)\s*(\d+)?\s*(?:s|giây|giay)?/iu.exec(
    text,
  );
  if (pMatch) {
    const m = parseInt(pMatch[1], 10);
    const s = pMatch[2] ? parseInt(pMatch[2], 10) : 0;
    const sec = m * 60 + s;
    return {
      tu: sec,
      den: sec,
      raw: pMatch[0].trim(),
    };
  }

  // 6. Dạng chỉ có giây đơn lẻ: "đoạn 35s", "giây thứ 45"
  const singleSecMatch =
    /(?:ở\s+|đoạn\s+|giây\s+(?:thứ\s+)?)(\d+)\s*(?:s|giây)/iu.exec(text);
  if (singleSecMatch) {
    const sec = parseInt(singleSecMatch[1], 10);
    return {
      tu: sec,
      den: sec,
      raw: singleSecMatch[0].trim(),
    };
  }

  return null;
}

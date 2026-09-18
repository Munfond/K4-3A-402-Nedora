/**
 * Trích xuất mốc thời gian nhắc đến trong lời góp ý (ví dụ "ở phút 1:15", "đoạn 35s", "02:10", "1p20").
 * Trả về số giây hoặc null nếu không tìm thấy.
 */
export function extractTimeMentionSeconds(text: string): number | null {
  if (!text) return null;

  // 1. Dạng mm:ss hoặc mm:ss.s (ví dụ "01:20", "2:15", "03:45.5")
  const mmssMatch =
    /(?:^|\s|[([])(?:ở\s+|phút\s+|đoạn\s+)?(\d{1,2}):(\d{2})(?:\.(\d+))?(?:$|\s|[)\].,!?])/iu.exec(
      text,
    );
  if (mmssMatch) {
    const mins = parseInt(mmssMatch[1], 10);
    const secs = parseInt(mmssMatch[2], 10);
    const frac = mmssMatch[3] ? parseFloat(`0.${mmssMatch[3]}`) : 0;
    return mins * 60 + secs + frac;
  }

  // 2. Dạng 1p20, 1p20s, 2phút15, 2phut15giay
  const pMatch = /(\d+)\s*(?:p|phút|phut)\s*(\d+)?\s*(?:s|giây|giay)?/iu.exec(
    text,
  );
  if (pMatch) {
    const mins = parseInt(pMatch[1], 10);
    const secs = pMatch[2] ? parseInt(pMatch[2], 10) : 0;
    return mins * 60 + secs;
  }

  // 3. Dạng chỉ có giây: "35s", "giây thứ 45", "đoạn 50 giây"
  const secMatch =
    /(?:ở\s+|đoạn\s+|giây\s+(?:thứ\s+)?)(\d+)\s*(?:s|giây|giay)?/iu.exec(text);
  if (secMatch) {
    return parseInt(secMatch[1], 10);
  }

  return null;
}

export interface CalibrationMatch<T> {
  matched: T | null;
  distance: number;
  exact: boolean;
}

/**
 * Khớp mốc thời gian vào câu gần nhất trong danh sách.
 * - exact: nằm hoàn toàn trong [batDau, ketThuc]
 * - nếu không nằm trong khoảng, tìm câu gần nhất với độ lệch <= toleranceSec (mặc định 3.0s)
 */
export function calibrateTimeToSentence<
  T extends { n: number; batDau: number; ketThuc: number },
>(targetSec: number, sentences: T[], toleranceSec = 3.0): CalibrationMatch<T> {
  if (!sentences || sentences.length === 0 || targetSec < 0) {
    return { matched: null, distance: Infinity, exact: false };
  }

  // 1. Kiểm tra nằm chính xác trong khoảng
  for (const s of sentences) {
    if (targetSec >= s.batDau && targetSec <= s.ketThuc) {
      return { matched: s, distance: 0, exact: true };
    }
  }

  // 2. Tìm câu gần nhất trong ngưỡng dung sai
  let best: T | null = null;
  let minDistance = Infinity;

  for (const s of sentences) {
    const distToStart = Math.abs(s.batDau - targetSec);
    const distToEnd = Math.abs(s.ketThuc - targetSec);
    const d = Math.min(distToStart, distToEnd);

    if (d < minDistance) {
      minDistance = d;
      best = s;
    }
  }

  if (minDistance <= toleranceSec && best) {
    return {
      matched: best,
      distance: Math.round(minDistance * 10) / 10,
      exact: false,
    };
  }

  return {
    matched: null,
    distance: Math.round(minDistance * 10) / 10,
    exact: false,
  };
}

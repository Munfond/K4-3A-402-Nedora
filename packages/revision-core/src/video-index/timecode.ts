export interface ParsedTimecodeSentence {
  n: number;
  batDau: number;
  ketThucTieng: number;
  ketThuc: number;
  soFrame: number;
  loi: string;
}

/**
 * Chuyển chuỗi timecode mm:ss.s (ví dụ "01:09.3", "00:05.4") thành giây (số thực).
 */
export function parseTimecodeSeconds(tc: string): number {
  if (!tc || typeof tc !== "string") return 0;
  const parts = tc.trim().split(":");
  if (parts.length === 1) {
    return parseFloat(parts[0]) || 0;
  }
  const minutes = parseFloat(parts[0]) || 0;
  const seconds = parseFloat(parts[1]) || 0;
  return Math.round((minutes * 60 + seconds) * 10) / 10;
}

/**
 * Chuyển số giây thành định dạng mm:ss.s (ví dụ 69.3 -> "01:09.3").
 */
export function formatSecondsToTimecode(sec: number): string {
  if (Number.isNaN(sec) || sec < 0) return "00:00.0";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const mStr = m.toString().padStart(2, "0");
  const sStr = s.toFixed(1).padStart(4, "0");
  return `${mStr}:${sStr}`;
}

/**
 * Phân tích nội dung file cau-timecode-d1.csv thành danh sách câu với thời gian thực tế.
 */
export function parseTimecodeCsv(csvText: string): ParsedTimecodeSentence[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length <= 1) return [];

  const results: ParsedTimecodeSentence[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Khớp CSV với trường lời có dấu ngoặc kép: cau,batDau,ketThucTieng,ketThuc,soFrame,loi
    const match = /^(\d+),([^,]+),([^,]+),([^,]+),(\d+),(.*)$/.exec(line);
    if (!match) continue;

    const n = parseInt(match[1], 10);
    const batDau = parseTimecodeSeconds(match[2]);
    const ketThucTieng = parseTimecodeSeconds(match[3]);
    const ketThuc = parseTimecodeSeconds(match[4]);
    const soFrame = parseInt(match[5], 10);
    let loi = match[6].trim();
    if (loi.startsWith('"') && loi.endsWith('"')) {
      loi = loi.slice(1, -1).replace(/""/g, '"');
    }

    results.push({
      n,
      batDau,
      ketThucTieng,
      ketThuc,
      soFrame,
      loi,
    });
  }

  return results;
}

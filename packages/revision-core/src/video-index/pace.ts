/**
 * Đếm số âm tiết tiếng Việt (mỗi từ tách bởi khoảng trắng là 1 âm tiết).
 */
export function countSyllables(text: string): number {
  if (!text) return 0;
  // Bỏ dấu câu và ký tự đặc biệt
  const clean = text.replace(/[.,/#!$%^&*;:{}=\-_`~()?"'“”…]/g, " ").trim();
  if (!clean) return 0;
  const words = clean.split(/\s+/).filter(Boolean);
  return words.length;
}

/**
 * Tính tốc độ nói cho một câu (âm tiết / giây).
 */
export function computeSentencePace(
  amTiet: number,
  thoiLuongTieng: number,
): number {
  if (thoiLuongTieng <= 0.05) return 0;
  return Math.round((amTiet / thoiLuongTieng) * 100) / 100;
}

export type PaceCategory = "nuot-chu" | "cham" | "binh-thuong";

/**
 * Phân loại tốc độ:
 * - nuot-chu: > 6.0 âm tiết/giây
 * - cham: < 2.5 âm tiết/giây
 * - binh-thuong: 2.5 - 6.0 âm tiết/giây
 */
export function classifyPace(tocDo: number): PaceCategory {
  if (tocDo > 6.0) return "nuot-chu";
  if (tocDo < 2.5) return "cham";
  return "binh-thuong";
}

/**
 * Tính toán thống kê tốc độ giọng đọc toàn video:
 * - trungBinh: Tổng âm tiết / Tổng thời lượng tiếng nói thực tế
 * - doLech: Độ lệch chuẩn (standard deviation) giữa các câu
 * - saiSoP90: Sai số phân vị 90 (90th percentile) của độ lệch so với trung bình
 */
export function computePaceStats(
  sentences: Array<{ amTiet: number; batDau: number; ketThucTieng: number }>,
): {
  trungBinh: number;
  doLech: number;
  saiSoP90: number;
} {
  if (sentences.length === 0) {
    return { trungBinh: 4.52, doLech: 0.5, saiSoP90: 0.8 };
  }

  let totalSyllables = 0;
  let totalSpeechDuration = 0;
  const paces: number[] = [];

  for (const s of sentences) {
    const dur = Math.max(0, s.ketThucTieng - s.batDau);
    totalSyllables += s.amTiet;
    totalSpeechDuration += dur;
    if (dur > 0) {
      paces.push(s.amTiet / dur);
    }
  }

  const trungBinh =
    totalSpeechDuration > 0
      ? Math.round((totalSyllables / totalSpeechDuration) * 100) / 100
      : 4.52;

  // Độ lệch chuẩn
  let variance = 0;
  if (paces.length > 1) {
    const sumDiffSq = paces.reduce((acc, p) => acc + (p - trungBinh) ** 2, 0);
    variance = sumDiffSq / (paces.length - 1);
  }
  const doLech = Math.round(Math.sqrt(variance) * 100) / 100;

  // Sai số phân vị 90
  const absDiffs = paces
    .map((p) => Math.abs(p - trungBinh))
    .sort((a, b) => a - b);
  const p90Index = Math.floor(absDiffs.length * 0.9);
  const saiSoP90 =
    absDiffs.length > 0
      ? Math.round(absDiffs[Math.min(p90Index, absDiffs.length - 1)] * 100) /
        100
      : 0.8;

  return {
    trungBinh,
    doLech,
    saiSoP90,
  };
}

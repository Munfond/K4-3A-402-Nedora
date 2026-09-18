import { countSyllables } from "../video-index/pace";

export interface SentenceDurationEstimate {
  syllables: number;
  speechDuration: number;
  silenceDuration: number;
  totalDuration: number;
}

/**
 * Mô hình tính toán thời lượng ước tính cho một câu kịch bản:
 * - Lời nói: số âm tiết / tốc độ giọng (mặc định chuẩn D1 là 4.52 âm tiết/giây)
 * - Khoảng lặng: thời gian nghỉ tự nhiên sau câu (mặc định 1.4s)
 */
export function estimateSentenceDuration(
  text: string,
  pace = 4.52,
  silence = 1.4,
): SentenceDurationEstimate {
  const syllables = countSyllables(text);
  const effectivePace = Math.max(1.0, pace);
  const speechDuration = Math.round((syllables / effectivePace) * 10) / 10;
  const totalDuration = Math.round((speechDuration + silence) * 10) / 10;

  return {
    syllables,
    speechDuration,
    silenceDuration: silence,
    totalDuration,
  };
}

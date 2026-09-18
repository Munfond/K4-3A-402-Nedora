import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

export interface AudioSentenceMetrics {
  rmsLoi: number;
  rmsLang: number;
  khoangCachDb: number;
}

export interface AudioAnalysisResult {
  levels: Map<number, AudioSentenceMetrics>;
  ffmpegAvailable: boolean;
  missingReason?: string;
}

/**
 * Kiểm tra ffmpeg có sẵn trong môi trường hay không.
 */
export function isFfmpegAvailable(): boolean {
  try {
    const res = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return res.status === 0;
  } catch {
    return false;
  }
}

/**
 * Trích xuất mức âm lượng (RMS dB) của lời nói và nhạc nền cho từng câu.
 * Chuẩn WCAG khuyến nghị khoảng cách giọng đọc và nhạc nền >= 20 dB.
 *
 * Hiện chưa cài phần đo thật bằng ffmpeg. Theo luật "không bịa số đo",
 * hàm này trả về rỗng kèm lý do thay vì sinh số giả; nơi dùng phải hiển thị
 * "chưa đo" và chuyển sang việc cần người nghe kiểm tra.
 */
export function analyzeAudioSentences(
  videoPath: string | undefined,
  _sentences: Array<{
    n: number;
    batDau: number;
    ketThucTieng: number;
    ketThuc: number;
  }>,
): AudioAnalysisResult {
  const levels = new Map<number, AudioSentenceMetrics>();

  if (!videoPath || !existsSync(videoPath)) {
    return {
      levels,
      ffmpegAvailable: false,
      missingReason: `Không tìm thấy file video tại: ${videoPath || "chưa cấu hình"}`,
    };
  }

  if (!isFfmpegAvailable()) {
    return {
      levels,
      ffmpegAvailable: false,
      missingReason: "Máy chưa cài ffmpeg nên không đo được âm lượng",
    };
  }

  return {
    levels,
    ffmpegAvailable: true,
    missingReason:
      "Chưa cài phần đo âm lượng bằng ffmpeg; cần người nghe kiểm tra thủ công",
  };
}

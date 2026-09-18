import { createHash } from "node:crypto";

import type { ScriptData } from "../types";
import { analyzeAudioSentences } from "./audio";
import { findSlideForSentence, parseSlideJson } from "./frames";
import { extractNewTermsPerSentence } from "./glossary";
import { computePaceStats, computeSentencePace, countSyllables } from "./pace";
import { mapSubtitlesToSentences, parseSubtitleFile } from "./subtitle";
import { type ParsedTimecodeSentence, parseTimecodeCsv } from "./timecode";
import type { SegmentIndex, VideoIndex } from "./types";

export interface BuildVideoIndexOptions {
  videoId: string;
  versionId: string;
  script: ScriptData;
  timecodeCsvText?: string;
  transcriptText?: string;
  slideJsonText?: string;
  videoFilePath?: string;
}

/**
 * Xây dựng chỉ mục video toàn diện (VideoIndex).
 */
export function buildVideoIndex(options: BuildVideoIndexOptions): VideoIndex {
  const {
    videoId,
    versionId,
    script,
    timecodeCsvText,
    transcriptText,
    slideJsonText,
    videoFilePath,
  } = options;

  const thieu: string[] = [];

  // 1. Phân tích Timecodes
  let timecodes: ParsedTimecodeSentence[] = [];
  if (timecodeCsvText) {
    timecodes = parseTimecodeCsv(timecodeCsvText);
  } else {
    thieu.push(
      "Thiếu file timecode CSV, sử dụng mốc thời gian ước tính từ kịch bản",
    );
  }
  const timecodeMap = new Map<number, ParsedTimecodeSentence>();
  timecodes.forEach((tc) => timecodeMap.set(tc.n, tc));

  // 2. Phân tích Phụ đề
  const subtitlePages = transcriptText ? parseSubtitleFile(transcriptText) : [];
  if (!transcriptText) {
    thieu.push("Thiếu file phụ đề transcript, không có ánh xạ trang phụ đề");
  }

  // 3. Phân tích Slide
  const slides = slideJsonText ? parseSlideJson(slideJsonText) : [];
  if (!slideJsonText) {
    thieu.push("Thiếu file cấu trúc slide, không có dữ liệu hình ảnh chi tiết");
  }

  // 4. Phân tích Thuật ngữ mới
  const glossaryMap = extractNewTermsPerSentence(
    script.cau.map((c) => ({
      n: c.n,
      loi: timecodeMap.get(c.n)?.loi || c.loi,
    })),
  );

  // 5. Chuẩn bị danh sách câu sơ bộ để phân tích phụ đề và âm thanh
  const rawSentences = script.cau.map((c) => {
    const tc = timecodeMap.get(c.n);
    const batDau = tc?.batDau ?? c.batDauGiay;
    const ketThucTieng = tc?.ketThucTieng ?? c.ketThucTiengGiay;
    const ketThuc = tc?.ketThuc ?? c.ketThucGiay;
    return {
      n: c.n,
      batDau,
      ketThucTieng,
      ketThuc,
    };
  });

  const subtitlesBySentence = mapSubtitlesToSentences(
    rawSentences,
    subtitlePages,
  );

  // 6. Phân tích Âm thanh
  const audioAnalysis = analyzeAudioSentences(videoFilePath, rawSentences);
  if (!audioAnalysis.ffmpegAvailable && audioAnalysis.missingReason) {
    thieu.push(audioAnalysis.missingReason);
  }

  // 7. Xây dựng từng SegmentIndex
  const phanNameMap = new Map<number, string>();
  script.phan.forEach((p) => phanNameMap.set(p.so, p.ten));

  const segments: SegmentIndex[] = [];

  for (const c of script.cau) {
    const tc = timecodeMap.get(c.n);
    const batDau = tc?.batDau ?? c.batDauGiay;
    const ketThucTieng = tc?.ketThucTieng ?? c.ketThucTiengGiay;
    const ketThuc = tc?.ketThuc ?? c.ketThucGiay;
    const soFrame = tc?.soFrame ?? Math.round((ketThuc - batDau) * 30);
    const loi = tc?.loi || c.loi || "";

    const amTiet = countSyllables(loi);
    const durSpeech = Math.max(0, ketThucTieng - batDau);
    const tocDo = computeSentencePace(amTiet, durSpeech);
    const khoangLangCuoi =
      Math.round(Math.max(0, ketThuc - ketThucTieng) * 10) / 10;

    const slideInfo = findSlideForSentence(slides, c.n);
    const chuManHinh = c.chuTrenManHinh || "";
    const soThanhPhanChu = chuManHinh
      ? chuManHinh.split(/[,.;\n]/).filter((t) => t.trim().length > 0).length
      : 0;

    const matchedSubs = subtitlesBySentence.get(c.n) || [];
    const trangPhuDe = matchedSubs.map((sub) => ({
      text: sub.text,
      batDau: sub.batDau,
      ketThuc: sub.ketThuc,
      kyTuMoiGiay: sub.kyTuMoiGiay,
    }));

    const audioMetrics = audioAnalysis.levels.get(c.n);

    const kieuVal = c.kieu as SegmentIndex["kieu"];
    const kieu: SegmentIndex["kieu"] =
      kieuVal === "ke" ||
      kieuVal === "giang" ||
      kieuVal === "nhe" ||
      kieuVal === "hoi" ||
      kieuVal === "nhan"
        ? kieuVal
        : "giang";

    segments.push({
      n: c.n,
      phan: c.phan,
      phanTen: phanNameMap.get(c.phan) || `Phần ${c.phan}`,
      batDau,
      ketThucTieng,
      ketThuc,
      soFrame,
      loi,
      dungGiay: c.dungGiay,
      chuTrenManHinh: c.chuTrenManHinh,
      yDoHinh: c.yDoHinh,
      kieu,
      amTiet,
      tocDo,
      khoangLangCuoi,
      slideId: slideInfo.slide?.id,
      viTriTrongSlide: slideInfo.viTriTrongSlide,
      slideDungDan: true,
      khungCuoi: slideInfo.slide?.anhDaiDien,
      tinHieuHinh: {
        doDaiChuManHinh: chuManHinh.length,
        soThanhPhanChu,
        soCauCungSlide: slideInfo.soCauCungSlide,
      },
      trangPhuDe,
      amThanh: audioMetrics,
      thuatNguMoi: glossaryMap.get(c.n) || [],
    });
  }

  // 8. Thống kê tốc độ giọng
  const tocDoGiong = computePaceStats(
    segments.map((s) => ({
      amTiet: s.amTiet,
      batDau: s.batDau,
      ketThucTieng: s.ketThucTieng,
    })),
  );

  // 9. Danh sách chương
  const chuongMap = new Map<
    number,
    { phan: number; ten: string; batDau: number }
  >();
  for (const s of segments) {
    if (!chuongMap.has(s.phan)) {
      chuongMap.set(s.phan, {
        phan: s.phan,
        ten: s.phanTen,
        batDau: s.batDau,
      });
    }
  }
  const chuong = Array.from(chuongMap.values()).sort((a, b) => a.phan - b.phan);

  const tongThoiLuong =
    segments.length > 0 ? Math.max(...segments.map((s) => s.ketThuc)) : 0;

  // 10. Hash xác định
  const hashInput = JSON.stringify({
    videoId,
    versionId,
    scriptId: script.id,
    segmentTimes: segments.map((s) => [s.n, s.batDau, s.ketThuc]),
  });
  const hash = createHash("sha256")
    .update(hashInput)
    .digest("hex")
    .slice(0, 16);

  return {
    videoId,
    versionId,
    hash,
    builtAt: new Date().toISOString(),
    segments,
    tocDoGiong,
    luatKhoangLang: {
      thuong: 1.4,
      cuoiPhan: 2.0,
      truocCauDung: 0.0,
    },
    chuong,
    tongThoiLuong: Math.round(tongThoiLuong * 10) / 10,
    thieu,
  };
}

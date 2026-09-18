import { existsSync } from "node:fs";
import { join } from "node:path";

import { getDefaultStore, loadScriptD1 } from "../src";
import {
  buildVideoIndex,
  calibrateTimeToSentence,
  detectSlideChains,
  extractTimeMentionSeconds,
  loadVideoIndexCache,
  parseSlideJson,
  parseSubtitleFile,
  parseTimecodeCsv,
  saveVideoIndexCache,
} from "../src/video-index";
import { TestSuite } from "./lib/assert";

async function runVideoIndexTests() {
  const suite = new TestSuite(
    "KIỂM THỬ TRÍCH XUẤT CHỈ MỤC VIDEO (VIDEO INDEX - TK §4)",
  );
  const store = getDefaultStore();
  const packDir = store.getPackDir();

  const script = loadScriptD1(store);
  const timecodeCsvText = store.readPackFile("video-mau/cau-timecode-d1.csv");
  const transcriptText = store.readPackFile("video-mau/transcript-d1.txt");
  const slideJsonText = store.readPackFile("video-mau/slide-d1.json");

  const candidateVideo = join(packDir, "video-mau", "d1.mp4");
  const videoFilePath = existsSync(candidateVideo) ? candidateVideo : undefined;

  // --------------------------------------------------------------------------
  // 1. Kiểm thử phân tích Timecodes
  // --------------------------------------------------------------------------
  console.log("\n--- [1] Phân tích Timecodes thực tế ---");

  await suite.run("TC-01: Phân tích CSV timecode đủ 40 câu", () => {
    const timecodes = parseTimecodeCsv(timecodeCsvText);
    if (timecodes.length < 40) {
      throw new Error(`Kỳ vọng >= 40 câu timecode, nhận: ${timecodes.length}`);
    }
    const c1 = timecodes[0];
    if (
      c1.n !== 1 ||
      c1.batDau !== 0 ||
      c1.ketThucTieng !== 5.4 ||
      c1.ketThuc !== 6.8
    ) {
      throw new Error(`Câu 1 timecode sai: ${JSON.stringify(c1)}`);
    }
  });

  // --------------------------------------------------------------------------
  // 2. Kiểm thử Phụ đề (Transcript)
  // --------------------------------------------------------------------------
  console.log("\n--- [2] Phân tích Phụ đề Transcript ---");

  await suite.run("SUB-01: Khớp chính xác 72 trang phụ đề của D1", () => {
    const pages = parseSubtitleFile(transcriptText);
    if (pages.length !== 72) {
      throw new Error(
        `D1 phải có đúng 72 trang phụ đề, thực tế: ${pages.length}`,
      );
    }
    const firstPage = pages[0];
    if (firstPage.batDau !== 0 || firstPage.ketThuc !== 2) {
      throw new Error(
        `Trang 1 sai mốc thời gian: ${firstPage.batDau} -> ${firstPage.ketThuc}`,
      );
    }
    const lastPage = pages[pages.length - 1];
    if (lastPage.batDau !== 247 || lastPage.ketThuc !== 249) {
      throw new Error(
        `Trang cuối sai mốc thời gian: ${lastPage.batDau} -> ${lastPage.ketThuc}`,
      );
    }
  });

  // --------------------------------------------------------------------------
  // 3. Xây dựng VideoIndex hoàn chỉnh
  // --------------------------------------------------------------------------
  console.log("\n--- [3] Xây dựng VideoIndex toàn diện ---");

  const videoIndex = buildVideoIndex({
    videoId: "d1",
    versionId: "v1",
    script,
    timecodeCsvText,
    transcriptText,
    slideJsonText,
    videoFilePath,
  });

  await suite.run("VIX-01: Cấu trúc VideoIndex và số lượng segment", () => {
    if (videoIndex.videoId !== "d1" || videoIndex.versionId !== "v1") {
      throw new Error("Thông tin videoId hoặc versionId không khớp");
    }
    if (videoIndex.segments.length !== script.cau.length) {
      throw new Error(
        `Số lượng segment (${videoIndex.segments.length}) khác số câu kịch bản (${script.cau.length})`,
      );
    }
    if (videoIndex.tongThoiLuong < 240 || videoIndex.tongThoiLuong > 260) {
      throw new Error(
        `Tổng thời lượng không hợp lý: ${videoIndex.tongThoiLuong}s`,
      );
    }
  });

  // --------------------------------------------------------------------------
  // 4. Kiểm thử Tốc độ giọng đọc (Pace)
  // --------------------------------------------------------------------------
  console.log("\n--- [4] Tốc độ giọng đọc chuẩn D1 ---");

  await suite.run("PACE-01: Tốc độ trung bình xấp xỉ 4.52 âm tiết/giây", () => {
    const avg = videoIndex.tocDoGiong.trungBinh;
    console.log(`    Tốc độ trung bình D1: ${avg} âm tiết/giây`);
    if (Math.abs(avg - 4.52) > 0.15) {
      throw new Error(
        `Tốc độ trung bình ${avg} lệch quá ngưỡng so với chuẩn 4.52`,
      );
    }
  });

  await suite.run("PACE-02: Phân vị P90 và độ lệch chuẩn hợp lệ", () => {
    if (
      videoIndex.tocDoGiong.doLech <= 0 ||
      videoIndex.tocDoGiong.saiSoP90 <= 0
    ) {
      throw new Error("Thông số độ lệch chuẩn hoặc P90 không hợp lệ");
    }
  });

  // --------------------------------------------------------------------------
  // 5. Kiểm thử Hiệu chuẩn Mốc thời gian (Calibrate)
  // --------------------------------------------------------------------------
  console.log("\n--- [5] Hiệu chuẩn Mốc thời gian từ góp ý ---");

  await suite.run("CAL-01: Khớp 'ở phút 1:15' vào câu 12/13", () => {
    const sec = extractTimeMentionSeconds("ở phút 1:15 nói đoạn này chưa rõ");
    if (sec !== 75) throw new Error(`Trích xuất sai giây: ${sec}`);
    const match = calibrateTimeToSentence(sec, videoIndex.segments);
    if (!match.matched) throw new Error("Không khớp được câu");
    // Câu 12 kết thúc lúc 75.0, câu 13 bắt đầu lúc 75.0
    if (match.matched.n !== 12 && match.matched.n !== 13) {
      throw new Error(`Khớp sai câu: ${match.matched.n}`);
    }
  });

  await suite.run("CAL-02: Khớp 'đoạn 35s' vào câu 6", () => {
    const sec = extractTimeMentionSeconds("ở đoạn 35s slide nhảy hơi nhanh");
    if (sec !== 35) throw new Error(`Trích xuất sai giây: ${sec}`);
    const match = calibrateTimeToSentence(sec, videoIndex.segments);
    if (!match.matched || match.matched.n !== 6) {
      throw new Error(`Kỳ vọng câu 6, nhận câu: ${match.matched?.n}`);
    }
  });

  await suite.run("CAL-03: Khớp '02:10' vào câu 21", () => {
    const sec = extractTimeMentionSeconds(
      "Phần 02:10 chữ trên màn hình bị che",
    );
    if (sec !== 130) throw new Error(`Trích xuất sai giây: ${sec}`);
    const match = calibrateTimeToSentence(sec, videoIndex.segments);
    if (!match.matched || match.matched.n !== 21) {
      throw new Error(`Kỳ vọng câu 21, nhận câu: ${match.matched?.n}`);
    }
  });

  // --------------------------------------------------------------------------
  // 6. Kiểm thử Đo đạc Âm thanh & Lỗi WCAG
  // --------------------------------------------------------------------------
  console.log("\n--- [6] Phân tích Âm thanh & Lỗi WCAG (1:00 - 2:00) ---");

  await suite.run("AUD-01: Không bịa số đo âm lượng khi chưa đo được", () => {
    // Luật: thiếu công cụ đo thì để trống kèm lý do, không sinh số giả.
    const coSoDo = videoIndex.segments.some((s) => s.amThanh);
    if (!coSoDo) {
      if (!videoIndex.thieu || videoIndex.thieu.length === 0) {
        throw new Error(
          "Chưa đo được âm lượng nhưng VideoIndex không ghi lý do vào 'thieu'",
        );
      }
      console.log(`    Chưa đo được âm lượng, đã ghi cảnh báo (đúng luật)`);
      return;
    }
    // Nếu đã đo thật thì số phải nằm trong khoảng vật lý hợp lý
    for (const s of videoIndex.segments) {
      if (!s.amThanh) continue;
      const db = s.amThanh.khoangCachDb;
      if (!Number.isFinite(db) || db < -10 || db > 80) {
        throw new Error(`Câu ${s.n} có khoảng cách dB vô lý: ${db}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // 7. Kiểm thử Chuỗi Phụ thuộc Slide (Slide Chains)
  // --------------------------------------------------------------------------
  console.log("\n--- [7] Phát hiện Chuỗi phụ thuộc Slide ---");

  await suite.run(
    "SLD-01: Phát hiện chuỗi slide liên kết nhiều câu (s15, s19, s24...)",
    () => {
      const slides = parseSlideJson(slideJsonText);
      const chains = detectSlideChains(slides);
      if (chains.length === 0) {
        throw new Error("Không phát hiện được chuỗi slide nào");
      }

      const s15Chain = chains.find((c) => c.slideId === "s15");
      if (
        !s15Chain ||
        s15Chain.cau.length !== 2 ||
        s15Chain.cau[0] !== 15 ||
        s15Chain.cau[1] !== 16
      ) {
        throw new Error(
          `Chuỗi slide s15 không chính xác: ${JSON.stringify(s15Chain)}`,
        );
      }

      // Kiểm tra thông tin trong segment
      const seg15 = videoIndex.segments.find((s) => s.n === 15);
      const seg16 = videoIndex.segments.find((s) => s.n === 16);
      if (seg15?.slideId !== "s15" || seg16?.slideId !== "s15") {
        throw new Error("Segment 15 và 16 không liên kết cùng slideId s15");
      }
      if (
        seg15.tinHieuHinh.soCauCungSlide !== 2 ||
        seg16.tinHieuHinh.soCauCungSlide !== 2
      ) {
        throw new Error("soCauCungSlide của segment 15 hoặc 16 không bằng 2");
      }
      console.log(`    Phát hiện ${chains.length} chuỗi slide liên kết`);
    },
  );

  // --------------------------------------------------------------------------
  // 8. Kiểm thử Cache VideoIndex
  // --------------------------------------------------------------------------
  console.log("\n--- [8] Bộ nhớ đệm VideoIndex trên đĩa ---");

  await suite.run("CCH-01: Lưu và tải lại VideoIndex từ Cache", () => {
    saveVideoIndexCache(videoIndex, store);
    const reloaded = loadVideoIndexCache("d1", "v1", store);
    if (!reloaded) throw new Error("Không tải lại được index từ cache");
    if (reloaded.hash !== videoIndex.hash) {
      throw new Error("Hash của index tải lại không khớp với bản gốc");
    }
    if (reloaded.segments.length !== videoIndex.segments.length) {
      throw new Error("Số lượng segment không khớp sau khi đọc lại từ cache");
    }
  });

  const passed = suite.summary();
  if (!passed) {
    process.exit(1);
  }
}

runVideoIndexTests().catch((err) => {
  console.error("Lỗi khi chạy test video index:", err);
  process.exit(1);
});

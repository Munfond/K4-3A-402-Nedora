import { TestSuite, skip } from "./lib/assert";
import { getStudioPackDir } from "./lib/pack";
import { buildVideoIndex } from "../src/video-index/build";
import { retrieveCandidates } from "../src/localize/retrieve";
import { verifyCandidates } from "../src/localize/verify";
import { localizeClaim } from "../src/localize";
import {
  createRevisionTools,
  type ToolCallTelemetry,
} from "../src/tools/registry";
import type { Claim } from "../src/claims/types";

import { getDefaultStore, loadScriptD1 } from "../src";

async function runLocalizeTests() {
  const suite = new TestSuite(
    "KIỂM THỬ ĐỊNH VỊ GÓP Ý & GROUNDING (LOCALIZE - TK §7.4)",
  );

  const packDir = getStudioPackDir();
  if (!packDir) {
    skip(
      "Không tìm thấy data/studio-pack/c5-feedbackradar, bỏ qua bài kiểm thử định vị trên D1",
    );
    process.exit(0);
  }

  const store = getDefaultStore();
  const script = loadScriptD1(store);
  const timecodeCsvText = store.readPackFile("video-mau/cau-timecode-d1.csv");
  const transcriptText = store.readPackFile("video-mau/transcript-d1.txt");
  const slideJsonText = store.readPackFile("video-mau/slide-d1.json");

  const videoIndex = buildVideoIndex({
    videoId: "d1",
    versionId: "v1",
    script,
    timecodeCsvText,
    transcriptText,
    slideJsonText,
  });

  // --------------------------------------------------------------------------
  // 1. Kiểm tra BM25 & RRF Engine
  // --------------------------------------------------------------------------
  console.log("\n--- [1] Truy xuất BM25 + RRF trên VideoIndex D1 ---");

  await suite.run("RET-01: Truy xuất từ khóa 'bộ lọc học từ những thư'", () => {
    const cands = retrieveCandidates("bộ lọc học từ những thư", videoIndex, 3);
    if (cands.length === 0) throw new Error("Không tìm thấy ứng viên");
    // Câu 24: "Hãy đặt thẻ đầu tiên lên bản đồ: bộ lọc học từ những thư đã được đánh dấu để phân loại thư mới"
    if (cands[0].n !== 24) {
      throw new Error(`Kỳ vọng câu 24 đứng đầu, nhận câu: ${cands[0].n}`);
    }
  });

  await suite.run("RET-02: Truy xuất hình ảnh 'ba thẻ ứng dụng'", () => {
    const cands = retrieveCandidates("ba thẻ ứng dụng", videoIndex, 3);
    if (cands.length === 0) throw new Error("Không tìm thấy ứng viên");
    // Câu 24-30 thuộc slide ba thẻ ứng dụng (s21)
    if (cands[0].n < 24 || cands[0].n > 30) {
      throw new Error(`Kỳ vọng thuộc khoảng [24, 30], nhận: ${cands[0].n}`);
    }
  });

  // --------------------------------------------------------------------------
  // 2. Kiểm tra Tools Registry & Telemetry
  // --------------------------------------------------------------------------
  console.log("\n--- [2] Công cụ Tools Registry & Đo lường Telemetry ---");

  await suite.run("TOOL-01: find_by_time đo mốc 75s (phút 1:15)", async () => {
    const telemetryEvents: ToolCallTelemetry[] = [];
    const tools = createRevisionTools(videoIndex, {
      onToolCall: (e) => telemetryEvents.push(e),
    });

    const res = await tools.find_by_time.execute({ tu: 75 });
    if (res.soLuong === 0 || res.ketQua[0].n !== 12) {
      throw new Error(`Kỳ vọng câu 12 ở 75s, nhận: ${JSON.stringify(res)}`);
    }

    if (
      telemetryEvents.length !== 1 ||
      telemetryEvents[0].name !== "find_by_time" ||
      !telemetryEvents[0].ok
    ) {
      throw new Error(
        `Telemetry không ghi nhận: ${JSON.stringify(telemetryEvents)}`,
      );
    }
  });

  await suite.run(
    "TOOL-02: get_segment lấy câu 14 và ngữ cảnh ±1",
    async () => {
      const tools = createRevisionTools(videoIndex);
      const res = await tools.get_segment.execute({ n: 14, lanCan: 1 });
      if (!res.cauChinh || res.cauChinh.n !== 14) {
        throw new Error("Không lấy được câu 14");
      }
      if (
        res.lanCan.length !== 3 ||
        res.lanCan[0].n !== 13 ||
        res.lanCan[2].n !== 15
      ) {
        throw new Error(
          `Ngữ cảnh ±1 không đúng: ${res.lanCan.map((s) => s.n)}`,
        );
      }
    },
  );

  await suite.run(
    "TOOL-03: glossary tra cứu 'trí tuệ nhân tạo tạo sinh'",
    async () => {
      const tools = createRevisionTools(videoIndex);
      const res = await tools.glossary.execute({ term: "tạo sinh" });
      if (res.soLuong === 0) {
        throw new Error("Không tìm thấy thuật ngữ tạo sinh");
      }
    },
  );

  // --------------------------------------------------------------------------
  // 3. Kiểm tra CRAG Verification
  // --------------------------------------------------------------------------
  console.log("\n--- [3] Kiểm chứng CRAG (Verification) ---");

  await suite.run(
    "CRAG-01: Phát hiện khẳng định ngược kịch bản 'học máy không thuộc trí tuệ nhân tạo'",
    () => {
      const claim: Claim = {
        id: "clm-fake-1",
        feedbackId: "fb-1",
        sender: "hv-001",
        role: "hv",
        intent: "noi-dung-sai",
        trich: "video nói học máy không thuộc trí tuệ nhân tạo",
        baoGianTiep: false,
        lanHoiLai: 0,
      };
      const cands = retrieveCandidates(claim.trich, videoIndex, 5);
      const ver = verifyCandidates(claim, cands, videoIndex);
      if (ver.kiemChung !== "nguoc-kich-ban") {
        throw new Error(`Kỳ vọng nguoc-kich-ban, nhận: ${ver.kiemChung}`);
      }
      if (!ver.trongTam.includes(11)) {
        throw new Error(`Kỳ vọng trongTam chứa câu 11, nhận: ${ver.trongTam}`);
      }
    },
  );

  await suite.run(
    "CRAG-02: Phát hiện nội dung không có trong video 'phần token'",
    () => {
      const claim: Claim = {
        id: "clm-fake-2",
        feedbackId: "fb-2",
        sender: "hv-002",
        role: "hv",
        intent: "noi-dung-sai",
        trich: "phần giải thích token trong transformer bị sai",
        baoGianTiep: false,
        lanHoiLai: 0,
      };
      const cands = retrieveCandidates(claim.trich, videoIndex, 5);
      const ver = verifyCandidates(claim, cands, videoIndex);
      if (ver.kiemChung !== "khong-khop-video") {
        throw new Error(`Kỳ vọng khong-khop-video, nhận: ${ver.kiemChung}`);
      }
    },
  );

  // --------------------------------------------------------------------------
  // 4. Kiểm tra Định vị trên các Ca Golden D1 Chuẩn (TK §7.4 & Kế hoạch T6)
  // --------------------------------------------------------------------------
  console.log(
    "\n--- [4] Định vị các Ca Golden D1 (gy-002, gy-007, gy-008, gy-010, gy-015) ---",
  );

  // Ca 1: gy-008: Nhạc nền to ở phút thứ hai -> mocNoi [60, 120] -> [10..19]
  await suite.run(
    "GOLDEN-01: gy-008 mốc phút thứ hai thuộc [10, 19]",
    async () => {
      const claim: Claim = {
        id: "clm-gy-008",
        feedbackId: "gy-008",
        sender: "hv-044",
        role: "hv",
        intent: "am-thanh",
        trich: "Tiếng nhạc nền to hơn giọng đọc ở khoảng phút thứ hai",
        goiYViTri: "khoảng phút thứ hai",
        mocNoi: { tu: 60, den: 120, nguon: "khoảng phút thứ hai" },
        baoGianTiep: false,
        lanHoiLai: 0,
      };

      const loc = await localizeClaim(claim, videoIndex, { mode: "k2" });
      if (loc.cach !== "moc-thoi-gian") {
        throw new Error(`Kỳ vọng cách 'moc-thoi-gian', nhận: ${loc.cach}`);
      }
      const allIn10to19 = loc.trongTam.every((n) => n >= 10 && n <= 19);
      if (!allIn10to19 || loc.trongTam.length === 0) {
        throw new Error(
          `Kỳ vọng các câu trong [10, 19], nhận: ${JSON.stringify(loc.trongTam)}`,
        );
      }
    },
  );

  // Ca 2: gy-015: mô hình học máy nằm bên trong bộ lọc -> [10]
  await suite.run("GOLDEN-02: gy-015 định vị chính xác câu 10", async () => {
    const claim: Claim = {
      id: "clm-gy-015",
      feedbackId: "gy-015",
      sender: "hv-070",
      role: "hv",
      intent: "kho-hieu",
      trich:
        "Chỗ giải thích mô hình học máy nằm bên trong bộ lọc em nghe ba lần mới hiểu",
      baoGianTiep: false,
      lanHoiLai: 0,
    };

    const loc = await localizeClaim(claim, videoIndex, { mode: "k2" });
    if (!loc.trongTam.includes(10)) {
      throw new Error(
        `Kỳ vọng trongTam chứa câu 10, nhận: ${JSON.stringify(loc.trongTam)}`,
      );
    }
  });

  // Ca 3: gy-007: ba ví dụ văn bản hình ảnh âm thanh -> [14]
  await suite.run("GOLDEN-03: gy-007 định vị chính xác câu 14", async () => {
    const claim: Claim = {
      id: "clm-gy-007",
      feedbackId: "gy-007",
      sender: "tg-02",
      role: "tg",
      intent: "kho-hieu",
      trich:
        "định nghĩa trí tuệ nhân tạo tạo sinh nhồi ba ví dụ văn bản hình ảnh âm thanh",
      baoGianTiep: true,
      lanHoiLai: 0,
    };

    const loc = await localizeClaim(claim, videoIndex, { mode: "k2" });
    if (!loc.trongTam.includes(14)) {
      throw new Error(
        `Kỳ vọng trongTam chứa câu 14, nhận: ${JSON.stringify(loc.trongTam)}`,
      );
    }
  });

  // Ca 4: gy-010: slide ba thẻ ứng dụng -> thuộc [24, 30]
  await suite.run(
    "GOLDEN-04: gy-010 định vị thuộc slide ba thẻ s21 [24, 30]",
    async () => {
      const claim: Claim = {
        id: "clm-gy-010",
        feedbackId: "gy-010",
        sender: "hv-052",
        role: "hv",
        intent: "hinh-anh",
        trich: "Chữ trên màn hình ở đoạn ba thẻ ứng dụng bị nhỏ",
        baoGianTiep: false,
        lanHoiLai: 0,
      };

      const loc = await localizeClaim(claim, videoIndex, { mode: "k2" });
      const allIn24to30 = loc.trongTam.every((n) => n >= 24 && n <= 30);
      if (!allIn24to30 || loc.trongTam.length === 0) {
        throw new Error(
          `Kỳ vọng trongTam thuộc [24, 30], nhận: ${JSON.stringify(loc.trongTam)}`,
        );
      }
    },
  );

  // Ca 5: gy-002: phân biệt mô hình ngôn ngữ lớn với ứng dụng trò chuyện -> câu 22 trong trongTam, câu 39 KHÔNG trong trongTam
  await suite.run(
    "GOLDEN-05: gy-002 câu 22 trong trongTam và câu 39 không trong trongTam",
    async () => {
      const claim: Claim = {
        id: "clm-gy-002",
        feedbackId: "gy-002",
        sender: "hv-011",
        role: "hv",
        intent: "kho-hieu",
        trich:
          "Phần phân biệt mô hình ngôn ngữ lớn với ứng dụng trò chuyện... cùng một ứng dụng nối được nhiều mô hình",
        baoGianTiep: false,
        lanHoiLai: 0,
      };

      const loc = await localizeClaim(claim, videoIndex, { mode: "k2" });
      if (!loc.trongTam.includes(22)) {
        throw new Error(
          `Kỳ vọng trongTam chứa câu 22, nhận: ${JSON.stringify(loc.trongTam)}`,
        );
      }
      if (loc.trongTam.includes(39)) {
        throw new Error(
          `Kỳ vọng câu 39 KHÔNG nằm trong trongTam, nhưng lại có mặt: ${JSON.stringify(loc.trongTam)}`,
        );
      }
    },
  );

  const passed = suite.summary();
  if (!passed) {
    process.exit(1);
  }
}

runLocalizeTests().catch((err) => {
  console.error("Lỗi khi chạy test localize:", err);
  process.exit(1);
});

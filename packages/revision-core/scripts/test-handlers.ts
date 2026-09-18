import assert from "node:assert/strict";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { getStudioPackDir } from "./lib/pack";
import { TestSuite, skip } from "./lib/assert";
import { createMockModel, scriptEditResponse } from "./lib/mock-model";
import { getDefaultStore } from "../src/store";
import { loadScriptD1 } from "../src/load";
import { buildVideoIndex } from "../src/video-index/build";
import type { VideoIndex } from "../src/video-index/types";
import type { IssueV3 } from "../src/issues/form";
import type { Claim } from "../src/claims/types";

import {
  createRevisionTools,
  findByTimeFn,
  searchSegmentsFn,
  getSegmentFn,
  glossaryFn,
  visualProfileFn,
  audioProfileFn,
  paceProfileFn,
  subtitleProfileFn,
  estimateDurationFn,
  checkScriptRulesFn,
  simulatePlanFn,
  searchCourseFn,
  pastDecisionsFn,
} from "../src/tools/registry";
import { handleAmThanh } from "../src/handlers/am-thanh";
import { handlePhuDe } from "../src/handlers/phu-de";
import { handleNhip } from "../src/handlers/nhip";
import { handleHinhAnh } from "../src/handlers/hinh-anh";
import { handleGiongDoc } from "../src/handlers/giong-doc";
import { handleDeNghiChung } from "../src/handlers/de-nghi-chung";
import { handleKhen } from "../src/handlers/khen";
import { handleNoiDung } from "../src/handlers/noi-dung";
import { routeIssue, routeAllIssues } from "../src/handlers/router";

async function runHandlerTests() {
  const suite = new TestSuite(
    "KIỂM THỬ 10 BỘ XỬ LÝ CHUYÊN TRÁCH & 13 READ-ONLY TOOLS (T8 - TK §7.6, §7.7)",
  );

  const packDir = getStudioPackDir();
  let videoIndex: VideoIndex;

  if (packDir) {
    const store = getDefaultStore();
    const script = loadScriptD1(store);
    const timecodeCsvText = store.readPackFile("video-mau/cau-timecode-d1.csv");
    const transcriptText = store.readPackFile("video-mau/transcript-d1.txt");
    const slideJsonText = store.readPackFile("video-mau/slide-d1.json");

    const candidateVideo = join(packDir, "video-mau", "d1.mp4");
    const videoFilePath = existsSync(candidateVideo)
      ? candidateVideo
      : undefined;

    videoIndex = buildVideoIndex({
      videoId: "d1",
      versionId: "v1",
      script,
      timecodeCsvText,
      transcriptText,
      slideJsonText,
      videoFilePath,
    });
  } else {
    // Fallback fixture D1 nếu không có pack
    videoIndex = {
      videoId: "d1",
      versionId: "v1",
      hash: "mock-d1",
      builtAt: new Date().toISOString(),
      tongThoiLuong: 270,
      segments: [
        {
          n: 10,
          phan: 2,
          phanTen: "Phần 2: Khái niệm AI",
          batDau: 65,
          ketThucTieng: 71,
          ketThuc: 72.4,
          soFrame: 175,
          loi: "Ví dụ như bộ lọc thư rác, nó tự học từ những bức thư bạn đánh dấu là rác.",
          amTiet: 21,
          kieu: "giang",
          tinHieuHinh: {
            doDaiChuManHinh: 25,
            soThanhPhanChu: 1,
            soCauCungSlide: 1,
          },
          khoangLangCuoi: 1.4,
          slideDungDan: false,
          thuatNguMoi: ["học máy"],
          trangPhuDe: [],
          amThanh: { rmsLoi: -20, rmsLang: -30, khoangCachDb: 9.3 },
        },
        {
          n: 14,
          phan: 2,
          phanTen: "Phần 2: Khái niệm AI",
          batDau: 88,
          ketThucTieng: 94,
          ketThuc: 95.4,
          soFrame: 175,
          loi: "Trí tuệ nhân tạo tạo sinh là công nghệ có khả năng tạo ra nội dung mới như văn bản hình ảnh hoặc âm thanh.",
          amTiet: 27,
          kieu: "giang",
          tinHieuHinh: {
            doDaiChuManHinh: 30,
            soThanhPhanChu: 1,
            soCauCungSlide: 1,
          },
          khoangLangCuoi: 1.4,
          slideDungDan: false,
          thuatNguMoi: ["trí tuệ nhân tạo tạo sinh"],
          trangPhuDe: [],
          amThanh: { rmsLoi: -20, rmsLang: -30, khoangCachDb: 9.8 },
        },
        {
          n: 22,
          phan: 3,
          phanTen: "Phần 3: Mô hình và Ứng dụng",
          batDau: 130,
          ketThucTieng: 137,
          ketThuc: 138.4,
          soFrame: 180,
          loi: "Nếu cần nhiều năng lực khác nhau, bạn phải chuyển đổi qua lại giữa các ứng dụng này.",
          amTiet: 22,
          kieu: "giang",
          tinHieuHinh: {
            doDaiChuManHinh: 32,
            soThanhPhanChu: 2,
            soCauCungSlide: 2,
          },
          khoangLangCuoi: 1.4,
          slideDungDan: true,
          thuatNguMoi: ["mô hình ngôn ngữ lớn"],
          trangPhuDe: [],
          amThanh: { rmsLoi: -19, rmsLang: -32, khoangCachDb: 13.0 },
        },
        {
          n: 28,
          phan: 4,
          phanTen: "Phần 4: Bản đồ khái niệm",
          batDau: 160,
          ketThucTieng: 167,
          ketThuc: 168.4,
          soFrame: 180,
          loi: "Ba nhánh ứng dụng chính bao gồm văn bản hình ảnh và âm thanh.",
          amTiet: 18,
          kieu: "giang",
          tinHieuHinh: {
            doDaiChuManHinh: 42,
            soThanhPhanChu: 3,
            soCauCungSlide: 7,
          },
          khoangLangCuoi: 1.4,
          slideDungDan: true,
          slideId: "s21",
          thuatNguMoi: [],
          trangPhuDe: [],
          amThanh: { rmsLoi: -18, rmsLang: -38, khoangCachDb: 20.0 },
        },
        {
          n: 35,
          phan: 5,
          phanTen: "Phần 5: Tổng kết và Bài tập",
          batDau: 210,
          ketThucTieng: 215,
          ketThuc: 220,
          soFrame: 250,
          loi: "Hãy thử mở một ứng dụng trò chuyện và đặt câu hỏi xem nó trả lời ra sao nhé?",
          amTiet: 21,
          kieu: "hoi",
          dungGiay: 5,
          tinHieuHinh: {
            doDaiChuManHinh: 28,
            soThanhPhanChu: 1,
            soCauCungSlide: 1,
          },
          khoangLangCuoi: 5.0,
          slideDungDan: false,
          thuatNguMoi: [],
          trangPhuDe: [],
          amThanh: { rmsLoi: -18, rmsLang: -38, khoangCachDb: 20.0 },
        },
      ],
      tocDoGiong: { trungBinh: 4.52, doLech: 0.3, saiSoP90: 0.51 },
      luatKhoangLang: { thuong: 1.4, cuoiPhan: 2.0, truocCauDung: 0.6 },
      chuong: [],
      slideChains: [{ slideId: "s21", cau: [24, 25, 26, 27, 28, 29, 30] }],
      glossary: [
        {
          thuatNgu: "trí tuệ nhân tạo tạo sinh",
          xuatHienLanDau: 14,
          dinhNghia: "Công nghệ tạo ra nội dung mới",
        },
        {
          thuatNgu: "mô hình ngôn ngữ lớn",
          xuatHienLanDau: 20,
          dinhNghia: "Mô hình xử lý ngôn ngữ tự nhiên quy mô lớn",
        },
      ],
      thieu: [],
    };
  }

  // --------------------------------------------------------------------------
  // 1. Kiểm thử 13 Tools trong Tools Registry (TK §7.7)
  // --------------------------------------------------------------------------
  console.log("\n--- [1] Kiểm thử 13 Tools trong Tools Registry ---");

  await suite.run(
    "TOOL-01: find_by_time tìm câu giao nhau với mốc thời gian",
    () => {
      const seg10 = videoIndex.segments.find((s) => s.n === 10);
      const res = findByTimeFn(
        videoIndex,
        seg10 ? seg10.batDau : 65,
        seg10 ? seg10.ketThuc : 75,
      );
      assert.ok(res.ketQua.length > 0);
      assert.ok(res.ketQua.some((c) => c.n === 10));
    },
  );

  await suite.run("TOOL-02: search_segments truy xuất bằng BM25", () => {
    const res = searchSegmentsFn(videoIndex, "bộ lọc thư rác");
    assert.ok(res.ungVien.length > 0);
    assert.ok(res.ungVien.some((c) => c.n === 10 || c.n === 16));
  });

  await suite.run("TOOL-03: get_segment lấy chi tiết câu và ngữ cảnh", () => {
    const res = getSegmentFn(videoIndex, 14, 1);
    assert.ok(res.cauChinh !== null);
    assert.equal(res.cauChinh?.n, 14);
  });

  await suite.run("TOOL-04: glossary tra cứu thuật ngữ bài giảng", () => {
    const res = glossaryFn(videoIndex, "ngôn ngữ lớn");
    assert.ok(res.soLuong && res.soLuong > 0);
  });

  await suite.run(
    "TOOL-05: visual_profile trích xuất tín hiệu hình ảnh & slide",
    () => {
      const res = visualProfileFn(videoIndex, { ns: [28] });
      assert.ok(res.cau.length > 0);
      assert.equal(res.cau[0].n, 28);
      assert.equal(res.cau[0].slideId, "s21");
      assert.ok(res.slideChains.length > 0);
    },
  );

  await suite.run("TOOL-06: audio_profile đo đạc dB giọng - nhạc nền", () => {
    const res = audioProfileFn(videoIndex, { ns: [10, 14], nguongDb: 20 });
    assert.ok(
      res.ketLuan === "xac-nhan" || res.ketLuan === "xac-nhan-mot-phan",
    );
    assert.ok(res.khoangCachDbNhoNhat < 10.0);
    assert.ok(res.mucHaDeXuatDb >= 10);
  });

  await suite.run("TOOL-07: pace_profile phân tích nhịp và z-score", () => {
    const res = paceProfileFn(videoIndex, { ns: [10] });
    assert.ok(res.chiTietCau.length > 0);
    assert.ok(Math.abs(res.zScoreTrungBinh) < 1.5);
    assert.ok(res.chanDoan.includes("không khác biệt"));
  });

  await suite.run("TOOL-08: subtitle_profile kiểm tra phụ đề", () => {
    // Câu 10 (vị trí gy-009) không bị lệch -> kết luận khong-tai-hien và tạo câu hỏi
    const res10 = subtitleProfileFn(videoIndex, { ns: [10] });
    assert.equal(res10.ketLuan, "khong-tai-hien");
    assert.ok(res10.cauHoiChoNguoiGui !== undefined);

    // Câu 14 có độ lệch mốc > 0.3s -> phát hiện vi phạm
    const res14 = subtitleProfileFn(videoIndex, { ns: [14] });
    assert.equal(res14.ketLuan, "xac-nhan");
    assert.ok(res14.trangViPham && res14.trangViPham.length > 0);
  });

  await suite.run(
    "TOOL-09: estimate_duration ước lượng thời lượng theo kiểu đọc",
    () => {
      const estGiang = estimateDurationFn(videoIndex, {
        text: "Trí tuệ nhân tạo tạo sinh là công nghệ mới.",
        kieu: "giang",
      });
      const estHoi = estimateDurationFn(videoIndex, {
        text: "Trí tuệ nhân tạo tạo sinh là công nghệ mới.",
        kieu: "hoi",
      });
      assert.ok(estGiang.thoiLuongUocTinhGiay > 0);
      // Kiểu hỏi hệ số 0.90 -> tốc độ chậm hơn một chút -> thời lượng dài hơn
      assert.ok(estHoi.thoiLuongUocTinhGiay >= estGiang.thoiLuongUocTinhGiay);
    },
  );

  await suite.run(
    "TOOL-10: check_script_rules kiểm tra ràng buộc mẫu kịch bản",
    () => {
      const seg10 = videoIndex.segments.find((s) => s.n === 10);
      const okCheck = checkScriptRulesFn(videoIndex, {
        n: 10,
        truong: "loi",
        text:
          seg10?.loi ||
          "Ví dụ như bộ lọc thư rác, nó tự học từ những bức thư bạn đánh dấu là rác.",
      });
      assert.ok(okCheck.hopLe);

      const failDigit = checkScriptRulesFn(videoIndex, {
        n: 10,
        truong: "loi",
        text: "Có 3 mô hình chính trong bài học.",
      });
      assert.ok(!failDigit.hopLe);
      assert.ok(failDigit.viPham.some((v) => v.ma === "QUY_TAC_CHU_SO"));

      const failScreenText = checkScriptRulesFn(videoIndex, {
        n: 10,
        truong: "chuTrenManHinh",
        text: "Dòng chữ này quá dài vượt qua bốn mươi ký tự quy định cho một slide hiển thị",
      });
      assert.ok(!failScreenText.hopLe);
      assert.ok(failScreenText.viPham.some((v) => v.ma === "T2"));
    },
  );

  await suite.run(
    "TOOL-11: simulate_plan mô phỏng thay đổi dòng thời gian",
    () => {
      const sim = simulatePlanFn(videoIndex, {
        changes: [
          {
            kind: "loi",
            n: 10,
            after: "Bộ lọc tự học từ những bức thư bạn đã đánh dấu rác.",
          },
        ],
      });
      assert.ok(sim.thuLai.length >= 1);
      assert.ok(sim.kyTuThuLai > 0);
    },
  );

  await suite.run("TOOL-12: search_course tra cứu kiến thức chuẩn", () => {
    const res = searchCourseFn(videoIndex, "học máy");
    assert.ok(res.ketQua.length > 0);
    assert.ok(
      res.ketQua[0].trichDan.includes("Machine Learning") ||
        res.ketQua[0].trichDan.includes("học"),
    );
  });

  await suite.run("TOOL-13: past_decisions tra cứu bộ nhớ quyết định", () => {
    const res = pastDecisionsFn("bản đồ");
    assert.ok(res.danhSach.length > 0);
  });

  // --------------------------------------------------------------------------
  // 2. Kiểm thử 10 Bộ xử lý chuyên trách (TK §7.6)
  // --------------------------------------------------------------------------
  console.log("\n--- [2] Kiểm thử các Bộ xử lý chuyên trách (Handlers) ---");

  // HDL-01: Âm thanh
  await suite.run(
    "HDL-01: handleAmThanh phát hiện vùng trũng 1:00-2:00, đề xuất hạ nhạc",
    async () => {
      const issue: IssueV3 = {
        id: "iss-aud-1",
        intent: "am-thanh",
        tieuDe: "Nhạc nền lấn át tiếng nói ở phút thứ hai",
        moTa: "Tiếng nhạc nền to hơn giọng đọc ở khoảng phút thứ hai",
        trongTam: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
        ngCanh: [9, 20],
        claimIds: ["clm-1"],
        gopYIds: ["gy-008"],
        nguoiDocLap: 1,
        soLuot: 1,
        coHoiLai: false,
        baoGianTiep: false,
        traiChieu: false,
        mucDoUuTien: 3,
      };

      const res = await handleAmThanh({
        issue,
        videoIndex,
      });

      assert.equal(res.nhom, "am-thanh");
      assert.ok(
        res.ketLuan === "xac-nhan" || res.ketLuan === "xac-nhan-mot-phan",
      );
      assert.ok(res.bangChungDo?.includes("WCAG"));
      assert.equal(res.changes.length, 1);
      assert.equal(res.changes[0].kind, "ky-thuat");
      if (res.changes[0].kind === "ky-thuat") {
        assert.equal(res.changes[0].viec, "mix");
        assert.equal(res.changes[0].tu, 60);
        assert.equal(res.changes[0].den, 120);
      }
    },
  );

  // HDL-02: Phụ đề
  await suite.run(
    "HDL-02: handlePhuDe trên D1 kết luận khong-tai-hien và tạo câu hỏi",
    async () => {
      const issue: IssueV3 = {
        id: "iss-sub-1",
        intent: "phu-de",
        tieuDe: "Phụ đề chạy lệch so với lời nói",
        moTa: "Phụ đề xuất hiện chậm hơn tiếng giảng",
        trongTam: [10],
        ngCanh: [9, 11],
        claimIds: ["clm-2"],
        gopYIds: ["gy-009"],
        nguoiDocLap: 1,
        soLuot: 1,
        coHoiLai: false,
        baoGianTiep: false,
        traiChieu: false,
        mucDoUuTien: 3,
      };

      const res = await handlePhuDe({
        issue,
        videoIndex,
      });

      assert.equal(res.nhom, "phu-de");
      assert.equal(res.ketLuan, "khong-tai-hien");
      assert.ok(res.cauHoi && res.cauHoi.length === 1);
      assert.ok(res.cauHoi[0].noiDung.includes("72 trang phụ đề"));
    },
  );

  // HDL-03: Nhịp tốc độ
  await suite.run(
    "HDL-03: handleNhip (nhip-toc-do) gy-001 chẩn đoán tốc độ không khác biệt",
    async () => {
      const issue: IssueV3 = {
        id: "iss-pace-1",
        intent: "nhip-toc-do",
        tieuDe: "Đoạn giữa nói quá nhanh",
        moTa: "Đoạn giữa nói dồn dập nghe không kịp",
        trongTam: [10],
        ngCanh: [9, 11],
        claimIds: ["clm-3"],
        gopYIds: ["gy-001"],
        nguoiDocLap: 1,
        soLuot: 1,
        coHoiLai: false,
        baoGianTiep: false,
        traiChieu: false,
        mucDoUuTien: 3,
      };

      const res = await handleNhip({
        issue,
        videoIndex,
      });

      assert.equal(res.nhom, "dung-hinh");
      assert.equal(res.ketLuan, "toc-do-khong-khac-biet");
      assert.ok(res.bangChungDo?.includes("âm tiết/s"));
      assert.equal(res.changes[0].kind, "dung");
    },
  );

  // HDL-04: Nhịp khoảng dừng
  await suite.run(
    "HDL-04: handleNhip (nhip-khoang-dung) câu 35 tạo câu hỏi 3 lựa chọn kèm mô phỏng",
    async () => {
      const issue: IssueV3 = {
        id: "iss-pause-1",
        intent: "nhip-khoang-dung",
        tieuDe: "Khoảng dừng câu 35 quá dài",
        moTa: "Khoảng dừng 5 giây sau câu hỏi làm ngắt mạch",
        trongTam: [35],
        ngCanh: [34],
        claimIds: ["clm-4"],
        gopYIds: ["gy-005", "gy-006"],
        nguoiDocLap: 2,
        soLuot: 2,
        coHoiLai: false,
        baoGianTiep: false,
        traiChieu: true,
        mucDoUuTien: 3,
      };

      const res = await handleNhip({
        issue,
        videoIndex,
      });

      assert.equal(res.nhom, "dung-hinh");
      assert.equal(res.ketLuan, "can-lua-chon");
      assert.ok(res.cauHoi && res.cauHoi.length === 1);
      assert.equal(res.cauHoi[0].luaChon.length, 3);
      assert.ok(
        res.cauHoi[0].moPhongLuaChon &&
          res.cauHoi[0].moPhongLuaChon.length === 3,
      );
    },
  );

  // HDL-05: Hình ảnh slide s21
  await suite.run(
    "HDL-05: handleHinhAnh slide s21 cảnh báo Vùng bảo vệ và tính 7 cảnh",
    async () => {
      const issue: IssueV3 = {
        id: "iss-vis-1",
        intent: "hinh-anh",
        tieuDe: "Chữ trên màn hình ở đoạn ba thẻ ứng dụng bị nhỏ",
        moTa: "Chữ ở ba thẻ văn bản hình ảnh âm thanh khó nhìn trên điện thoại",
        trongTam: [28],
        ngCanh: [24, 25, 26, 27, 29, 30],
        claimIds: ["clm-5"],
        gopYIds: ["gy-010"],
        nguoiDocLap: 1,
        soLuot: 1,
        coHoiLai: false,
        baoGianTiep: false,
        traiChieu: false,
        mucDoUuTien: 2,
      };

      const res = await handleHinhAnh({
        issue,
        videoIndex,
        vungBaoVe: [
          {
            ns: [24, 25, 26, 27, 28, 29, 30, 31, 32],
            gopYIds: ["gy-016"],
            lyDo: "Bản đồ khái niệm",
          },
        ],
      });

      assert.equal(res.nhom, "dung-hinh");
      assert.equal(res.ketLuan, "can-nguoi-xem-khung");
      assert.ok(res.canhBao && res.canhBao.length > 0);
      assert.ok(res.canhBao[0].includes("Vùng bảo vệ"));
      assert.equal(
        res.chiPhi?.canhDungLai.length,
        7,
        "Dây chuyền slide s21 phải dựng lại 7 cảnh",
      );
    },
  );

  // HDL-06: Giọng đọc
  await suite.run(
    "HDL-06: handleGiongDoc đề xuất kiểu đọc và từ điển phát âm",
    async () => {
      const issue: IssueV3 = {
        id: "iss-voice-1",
        intent: "giong-doc",
        tieuDe: "Phát âm chưa chuẩn một số thuật ngữ tiếng Anh",
        moTa: "Cần nhấn rõ từ GenAI và Prompt",
        trongTam: [14],
        ngCanh: [13, 15],
        claimIds: ["clm-6"],
        gopYIds: ["gy-011"],
        nguoiDocLap: 1,
        soLuot: 1,
        coHoiLai: false,
        baoGianTiep: false,
        traiChieu: false,
        mucDoUuTien: 4,
      };

      const res = await handleGiongDoc({
        issue,
        videoIndex,
      });

      assert.equal(res.nhom, "thu-am");
      assert.equal(res.changes[0].kind, "kieu");
    },
  );

  // HDL-07: Đề nghị chung
  await suite.run(
    "HDL-07: handleDeNghiChung ghi nhận vào Sổ ý tưởng",
    async () => {
      const issue: IssueV3 = {
        id: "iss-sug-1",
        intent: "de-nghi-chung",
        tieuDe: "Đề nghị bổ sung thêm slide bài tập thực hành",
        moTa: "Nên có bài tập trắc nghiệm cuối video",
        trongTam: [35],
        ngCanh: [],
        claimIds: ["clm-7"],
        gopYIds: ["gy-012"],
        nguoiDocLap: 1,
        soLuot: 1,
        coHoiLai: false,
        baoGianTiep: false,
        traiChieu: false,
        mucDoUuTien: 5,
      };

      const res = await handleDeNghiChung({
        issue,
        videoIndex,
      });

      assert.equal(res.ketLuan, "luu-so-y-tuong");
      assert.equal(res.changes.length, 0);
      assert.ok(res.ghiNhan && res.ghiNhan.length > 0);
    },
  );

  // HDL-08: Khen ngợi & Vùng bảo vệ
  await suite.run("HDL-08: handleKhen củng cố Vùng bảo vệ", async () => {
    const issue: IssueV3 = {
      id: "iss-praise-1",
      intent: "khen-giu",
      tieuDe: "Khen phần bản đồ khái niệm rất hay",
      moTa: "Giảng viên dặn giữ nguyên sơ đồ này",
      trongTam: [24, 25, 26, 27, 28, 29, 30, 31, 32],
      ngCanh: [],
      claimIds: ["clm-8"],
      gopYIds: ["gy-016"],
      nguoiDocLap: 1,
      soLuot: 1,
      coHoiLai: false,
      baoGianTiep: false,
      traiChieu: false,
      mucDoUuTien: 5,
    };

    const res = await handleKhen({
      issue,
      videoIndex,
    });

    assert.equal(res.ketLuan, "thiet-lap-vung-bao-ve");
    assert.ok(res.vungBaoVe && res.vungBaoVe.length > 0);
  });

  // HDL-09: Sửa lời câu 22
  await suite.run(
    "HDL-09: handleNoiDung câu 22 đề xuất lời giải thích đa mô hình đạt T1-T6",
    async () => {
      const issue: IssueV3 = {
        id: "iss-script-22",
        intent: "kho-hieu",
        tieuDe: "Phân biệt mô hình và ứng dụng",
        moTa: "Hiểu nhầm một ứng dụng chỉ nối được với một mô hình",
        trongTam: [22],
        ngCanh: [20, 21, 23],
        claimIds: ["clm-22"],
        gopYIds: ["gy-002"],
        nguoiDocLap: 1,
        soLuot: 1,
        coHoiLai: false,
        baoGianTiep: false,
        traiChieu: false,
        mucDoUuTien: 2,
      };

      const seg22 = videoIndex.segments.find((s) => s.n === 22);
      const model = createMockModel(() =>
        scriptEditResponse(
          22,
          "Trong thực tế, một ứng dụng trò chuyện có thể phối hợp nhiều mô hình chuyên biệt cho từng loại yêu cầu.",
          { n: 22, after: "Một ứng dụng có thể gọi nhiều mô hình" },
        ),
      );

      const res = await handleNoiDung({
        issue,
        videoIndex,
        mode: "k2",
        model,
      });

      assert.equal(res.nhom, "bien-kich");
      assert.equal(res.ketLuan, "dat-chuan-ky-thuat");
      assert.equal(res.changes.length, 1);
      assert.equal(res.changes[0].kind, "loi");
      assert.ok(
        res.cachKhac !== null,
        "Có đề xuất phương án phụ tiết kiệm chi phí",
      );
      // Luật: không được có đề xuất rỗng (lời mới trùng lời cũ)
      const change22 = res.changes[0] as { after?: string };
      assert.notEqual(
        (change22.after || "").trim(),
        (seg22?.loi || "").trim(),
        "Lời mới phải khác lời cũ",
      );
      assert.equal(
        res.chiPhi?.viPham.length,
        0,
        "Đề xuất đạt chuẩn T1–T6, 0 vi phạm",
      );
    },
  );

  // HDL-09b: Không có model thì trả việc can-nguoi-viet, không bịa lời
  await suite.run(
    "HDL-09b: handleNoiDung chế độ giả lập trả can-nguoi-viet, không sinh lời",
    async () => {
      const issue: IssueV3 = {
        id: "iss-script-22-mock",
        intent: "kho-hieu",
        tieuDe: "Phân biệt mô hình và ứng dụng",
        moTa: "Hiểu nhầm một ứng dụng chỉ nối được với một mô hình",
        trongTam: [22],
        ngCanh: [21, 23],
        claimIds: ["clm-22"],
        gopYIds: ["gy-002"],
        nguoiDocLap: 1,
        soLuot: 1,
        coHoiLai: false,
        baoGianTiep: false,
        traiChieu: false,
        mucDoUuTien: 2,
      };

      const res = await handleNoiDung({ issue, videoIndex, mode: "k2" });

      assert.equal(res.changes.length, 0, "Không được sinh thay đổi nào");
      assert.equal(
        (res.deXuat as { kieu?: string })?.kieu,
        "can-nguoi-viet",
        "Phải trả việc cần người viết",
      );
      assert.ok(
        res.canhBao && res.canhBao.length > 0,
        "Phải có cảnh báo, không hạ cấp im lặng",
      );
    },
  );

  // HDL-09c: Model lỗi thì lý do phải đi vào cảnh báo
  await suite.run(
    "HDL-09c: handleNoiDung đưa lỗi gọi model vào cảnh báo",
    async () => {
      const issue: IssueV3 = {
        id: "iss-script-err",
        intent: "kho-hieu",
        tieuDe: "Phân biệt mô hình và ứng dụng",
        moTa: "Hiểu nhầm",
        trongTam: [22],
        ngCanh: [21, 23],
        claimIds: ["clm-22"],
        gopYIds: ["gy-002"],
        nguoiDocLap: 1,
        soLuot: 1,
        coHoiLai: false,
        baoGianTiep: false,
        traiChieu: false,
        mucDoUuTien: 2,
      };

      const model = createMockModel(() => null); // luôn ném lỗi
      const res = await handleNoiDung({ issue, videoIndex, mode: "k2", model });

      assert.equal(res.changes.length, 0);
      assert.ok(
        res.canhBao?.some((c) => c.includes("lỗi")),
        "Cảnh báo phải nêu lỗi gọi model",
      );
    },
  );

  // HDL-10: Sửa lời câu 10
  await suite.run(
    "HDL-10: handleNoiDung câu 10 đạt chuẩn kịch bản T1-T6",
    async () => {
      const issue: IssueV3 = {
        id: "iss-script-10",
        intent: "kho-hieu",
        tieuDe: "Giải thích mô hình học máy trong bộ lọc",
        moTa: "Khó hiểu về mô hình nằm bên trong ứng dụng",
        trongTam: [10],
        ngCanh: [9, 11],
        claimIds: ["clm-10"],
        gopYIds: ["gy-015"],
        nguoiDocLap: 1,
        soLuot: 1,
        coHoiLai: false,
        baoGianTiep: false,
        traiChieu: false,
        mucDoUuTien: 2,
      };

      const model = createMockModel(() =>
        scriptEditResponse(
          10,
          "Bộ lọc này hoạt động dựa trên một mô hình học máy đã học từ rất nhiều thư trước đó.",
        ),
      );

      const res = await handleNoiDung({
        issue,
        videoIndex,
        mode: "k2",
        model,
      });

      assert.equal(res.nhom, "bien-kich");
      assert.equal(res.ketLuan, "dat-chuan-ky-thuat");
      assert.equal(
        res.chiPhi?.viPham.length,
        0,
        "Đề xuất đạt chuẩn T1–T6, 0 vi phạm",
      );
    },
  );

  // --------------------------------------------------------------------------
  // 3. Kiểm thử Router và Gộp Intent Phụ (TK §7.6)
  // --------------------------------------------------------------------------
  console.log("\n--- [3] Kiểm thử Router và Định tuyến Gộp ---");

  await suite.run(
    "RTR-01: routeIssue định tuyến chính xác theo intent",
    async () => {
      const issue: IssueV3 = {
        id: "iss-route-1",
        intent: "am-thanh",
        tieuDe: "Tiếng nhạc nền to",
        moTa: "Nhạc nền lấn át",
        trongTam: [10],
        ngCanh: [],
        claimIds: ["c1"],
        gopYIds: ["g1"],
        nguoiDocLap: 1,
        soLuot: 1,
        coHoiLai: false,
        baoGianTiep: false,
        traiChieu: false,
        mucDoUuTien: 3,
      };

      const res = await routeIssue({
        issue,
        videoIndex,
      });
      assert.equal(res.nhom, "am-thanh");
    },
  );

  await suite.run(
    "RTR-02: routeIssue gộp kết quả khi có intent phụ",
    async () => {
      const claimWithSecondary: Claim = {
        id: "c-multi",
        feedbackId: "g-multi",
        sender: "hv-001",
        role: "hv",
        intent: "hinh-anh",
        intentPhu: "kho-hieu",
        trich: "Chữ nhỏ và giải thích khó hiểu ở câu 28",
        baoGianTiep: false,
        lanHoiLai: 0,
      };

      const issue: IssueV3 = {
        id: "iss-multi",
        intent: "hinh-anh",
        tieuDe: "Vừa chữ nhỏ vừa khó hiểu",
        moTa: "Slide s21",
        trongTam: [28],
        ngCanh: [24, 25, 26, 27, 29, 30],
        claimIds: ["c-multi"],
        gopYIds: ["g-multi"],
        nguoiDocLap: 1,
        soLuot: 1,
        coHoiLai: false,
        baoGianTiep: false,
        traiChieu: false,
        mucDoUuTien: 2,
      };

      const model = createMockModel(() =>
        scriptEditResponse(
          28,
          "Ba thẻ ứng dụng này minh họa ba nhiệm vụ khác nhau của cùng một mô hình.",
        ),
      );

      const res = await routeIssue({
        issue,
        claims: [claimWithSecondary],
        videoIndex,
        model,
      });

      assert.ok(
        res.changes.length >= 2,
        "Gộp thay đổi từ cả hai handler hình ảnh và sửa lời",
      );
    },
  );

  const passed = suite.summary();
  if (!passed) {
    process.exit(1);
  }
}

runHandlerTests().catch((err) => {
  console.error("Lỗi khi chạy test handlers:", err);
  process.exit(1);
});

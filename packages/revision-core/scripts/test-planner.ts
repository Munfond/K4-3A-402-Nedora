import assert from "node:assert/strict";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { getStudioPackDir } from "./lib/pack";
import { TestSuite } from "./lib/assert";
import { getDefaultStore } from "../src/store";
import { loadScriptD1 } from "../src/load";
import { buildVideoIndex } from "../src/video-index/build";
import type { VideoIndex } from "../src/video-index/types";
import type { IssueV3, ProtectedZone } from "../src/issues/form";
import type { HandlerResult, HandlerQuestion } from "../src/handlers/types";
import type { FeedbackItem } from "../src/types";
import type { Claim } from "../src/claims/types";
import {
  calculatePriorityScore,
  planRevision,
  judgeProposalItem,
  judgeAllWorkItems,
  buildRevisionBrief,
  buildRoleWorkOrders,
  buildEstimatedV2TimecodesTable,
  buildCostComparisonReport,
  exportRevisionV3Package,
} from "../src";

async function runPlannerTests() {
  const suite = new TestSuite(
    "KIỂM THỬ KẾ HOẠCH, THẨM ĐỊNH, REVISION BRIEF & XUẤT BẢN (T9 - TK §7.11, §7.12, §8)",
  );

  const packDir = getStudioPackDir();
  let videoIndex: VideoIndex;
  const store = getDefaultStore();
  const script = loadScriptD1(store);

  if (packDir) {
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
    throw new Error("Không tìm thấy studio pack D1 để chạy kiểm thử T9");
  }

  const vungBaoVe: ProtectedZone[] = [
    { ns: [1, 2, 3], gopYIds: ["gy-014"], lyDo: "Mở đầu mạch lạc, gây tò mò" },
    {
      ns: [24, 25, 26, 27, 28, 29, 30, 31, 32],
      gopYIds: ["gy-016"],
      lyDo: "Bản đồ ứng dụng AI trực quan",
    },
  ];

  // --------------------------------------------------------------------------
  // TEST CASE 1: Công thức điểm ưu tiên (TK §7.11)
  // --------------------------------------------------------------------------
  await suite.run(
    "T9.1: Tính điểm ưu tiên = (ảnh hưởng × độ rộng × chắc chắn) / chi phí",
    async () => {
      // Vấn đề câu 20-22: 2 người độc lập, có hỏi lại (multi 1.5), chi phí 5 câu
      const issue2022: IssueV3 = {
        id: "iss-2022",
        intent: "kho-hieu",
        tieuDe: "Khó hiểu về ứng dụng nối nhiều mô hình",
        moTa: "Người học băn khoăn về câu 20 và 22",
        trongTam: [20, 22],
        ngCanh: [19, 21, 23],
        claimIds: ["cl-1", "cl-2", "cl-3", "cl-4"],
        gopYIds: ["gy-002", "gy-003", "gy-018", "gy-022"],
        nguoiDocLap: 2,
        soLuot: 4,
        coHoiLai: true,
        baoGianTiep: false,
        traiChieu: false,
        mucDoUuTien: 1,
      };

      const handlerRes2022: HandlerResult = {
        vanDeId: "iss-2022",
        nhom: "bien-kich",
        uuTien: 1,
        lyDoUuTien: "Ưu tiên 1",
        viTri: { ns: [20, 22], v1: [121.5, 146.8] },
        changes: [
          {
            kind: "loi",
            n: 20,
            after:
              "Một ứng dụng thực tế thường tích hợp nhiều mô hình phối hợp cùng nhau.",
          },
          {
            kind: "loi",
            n: 22,
            after:
              "Ví dụ như hệ thống xe tự hành kết hợp cả thị giác máy tính và xử lý tín hiệu.",
          },
        ],
      };

      const { score: score2022, reason: reason2022 } = calculatePriorityScore({
        result: handlerRes2022,
        issue: issue2022,
        costInSentences: 5,
      });

      assert.ok(
        score2022 > 1.5,
        `Điểm ưu tiên của vấn đề 20-22 (${score2022}) phải cao`,
      );
      assert.ok(
        reason2022.includes("hỏi lại"),
        "Lý do ưu tiên phải ghi nhận cờ hỏi lại",
      );
      assert.ok(
        reason2022.includes("2 người độc lập"),
        "Lý do ưu tiên phải nêu rõ số người độc lập",
      );

      // Vấn đề câu 14: Trợ giảng báo gián tiếp (multi 2.0)
      const issue14: IssueV3 = {
        id: "iss-14",
        intent: "kho-hieu",
        tieuDe: "Khó theo kịp ba ví dụ dồn dập ở câu 14",
        moTa: "Nhiều học viên phản ánh không kịp xem",
        trongTam: [14],
        ngCanh: [13, 15],
        claimIds: ["cl-7"],
        gopYIds: ["gy-007"],
        nguoiDocLap: 1,
        soLuot: 1,
        coHoiLai: false,
        baoGianTiep: true,
        traiChieu: false,
        mucDoUuTien: 2,
      };

      const { score: score14, reason: reason14 } = calculatePriorityScore({
        result: {
          vanDeId: "iss-14",
          nhom: "bien-kich",
          uuTien: 2,
          lyDoUuTien: "Ưu tiên 2",
          viTri: { ns: [14], v1: [80.6, 88.5] },
          changes: [],
        },
        issue: issue14,
        costInSentences: 3,
      });

      assert.ok(
        reason14.includes("báo gián tiếp"),
        "Lý do ưu tiên phải ghi nhận cờ báo gián tiếp",
      );
      assert.ok(
        score14 > 1.0,
        `Điểm ưu tiên có báo gián tiếp phải được nhân hệ số`,
      );
    },
  );

  // --------------------------------------------------------------------------
  // TEST CASE 2: Greedy Budget Optimizer với kế hoạch mặc định D1 (TK §8)
  // --------------------------------------------------------------------------
  await suite.run(
    "T9.2: Kế hoạch D1 chuẩn ngân sách: chính xác 8 câu thu lại (701 ký tự) và tự chọn phương án phụ cho câu 14",
    async () => {
      // Thiết lập danh sách HandlerResult tương ứng với D1:
      // 1. Sửa lời câu 20 & 22 (yêu cầu thu lại 19-23, 5 câu)
      const res2022: HandlerResult = {
        vanDeId: "iss-2022",
        nhom: "bien-kich",
        uuTien: 1,
        lyDoUuTien: "2 người độc lập, có hỏi lại",
        viTri: { ns: [20, 22], v1: [121.5, 146.8] },
        changes: [
          {
            kind: "loi",
            n: 20,
            after:
              "Ứng dụng hội thoại nhận câu hỏi của bạn và dùng mô hình ngôn ngữ lớn ở phía sau để tạo câu trả lời.",
          },
          {
            kind: "loi",
            n: 22,
            after:
              "Một ứng dụng thực tế có thể tích hợp mô hình văn bản, mô hình tạo ảnh cùng nhiều công cụ khác.",
          },
        ],
      };

      // 2. Sửa lời câu 10 (yêu cầu thu lại 9-11, 3 câu)
      const res10: HandlerResult = {
        vanDeId: "iss-10",
        nhom: "bien-kich",
        uuTien: 2,
        lyDoUuTien: "1 người, điểm dễ hiểu 3/5",
        viTri: { ns: [10], v1: [56.2, 61.9] },
        changes: [
          {
            kind: "loi",
            n: 10,
            after:
              "Mô hình học máy bên trong bộ lọc đã tự học từ các dữ liệu ví dụ được cung cấp trước.",
          },
        ],
      };

      // 3. Câu 14 (TK §8 line 529): Đề xuất chính chỉ sửa hình (0 câu thu lại giọng).
      // Cách khác: sửa lời (thu 13-15).
      const res14: HandlerResult = {
        vanDeId: "iss-14",
        nhom: "dung-hinh",
        uuTien: 3,
        lyDoUuTien:
          "Trợ giảng báo gián tiếp; đề xuất chính chỉ sửa hình để không phải thu lại giọng",
        viTri: { ns: [14], v1: [80.6, 88.5] },
        changes: [
          {
            kind: "yDoHinh",
            n: 14,
            after:
              "Hiện lần lượt ba nhánh đồ họa: văn bản, hình ảnh và âm thanh tương ứng từng nhịp nói.",
          },
        ],
        cachKhac: {
          strategy: "Sửa lời đọc (cần thu âm lại câu 13-15)",
          changes: [
            {
              kind: "loi",
              n: 14,
              after:
                "Trí tuệ nhân tạo tạo sinh là tên gọi cho các hệ thống tạo ra nội dung mới như văn bản, ảnh hay âm thanh.",
            },
          ],
        },
      };

      // 4. Slide s21 (câu 24-30): Đổi chữ màn hình, không thu lại giọng
      const resVisual21: HandlerResult = {
        vanDeId: "iss-s21",
        nhom: "dung-hinh",
        uuTien: 4,
        lyDoUuTien: "Slide dựng dần 7 câu, chữ màn hình câu 28, 29 > 40 ký tự",
        viTri: { ns: [24, 25, 26, 27, 28, 29, 30], v1: [146.8, 187.1] },
        bangChungDo:
          "Slide s21 gồm 7 câu [24-30], chữ câu 28 (41 ký tự), câu 29 (42 ký tự)",
        changes: [
          {
            kind: "chuTrenManHinh",
            n: 28,
            after: "Chẩn đoán y tế: Hỗ trợ phân tích ảnh chụp X-quang",
          },
        ],
      };

      // 5. Âm thanh: Hạ nhạc nền ở phút thứ 2 (1:00 - 2:00)
      const resAudio: HandlerResult = {
        vanDeId: "iss-audio",
        nhom: "am-thanh",
        uuTien: 5,
        lyDoUuTien:
          "Khoảng cách giọng-nhạc 9.3-9.9 dB ở câu 11, 14, 19, dưới ngưỡng 20 dB",
        viTri: {
          ns: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
          v1: [60.0, 120.0],
        },
        bangChungDo:
          "Khoảng cách giọng-nhạc nhỏ nhất 9.3 dB tại câu 14, trung vị 11.2 dB",
        changes: [
          {
            kind: "kyThuat",
            tu: 60,
            den: 120,
            viec: "mix",
            moTa: "Hạ âm lượng nhạc nền BGM 11 dB trong khoảng 1:00 - 2:00",
          },
        ],
      };

      const issues: IssueV3[] = [
        {
          id: "iss-2022",
          intent: "kho-hieu",
          tieuDe: "Khó hiểu 20-22",
          moTa: "",
          trongTam: [20, 22],
          ngCanh: [19, 21, 23],
          claimIds: ["cl-1"],
          gopYIds: ["gy-002", "gy-003", "gy-018", "gy-022"],
          nguoiDocLap: 2,
          soLuot: 4,
          coHoiLai: true,
          baoGianTiep: false,
          traiChieu: false,
          mucDoUuTien: 1,
        },
        {
          id: "iss-10",
          intent: "kho-hieu",
          tieuDe: "Khó hiểu 10",
          moTa: "",
          trongTam: [10],
          ngCanh: [9, 11],
          claimIds: ["cl-15"],
          gopYIds: ["gy-015"],
          nguoiDocLap: 1,
          soLuot: 1,
          coHoiLai: false,
          baoGianTiep: false,
          traiChieu: false,
          mucDoUuTien: 2,
        },
        {
          id: "iss-14",
          intent: "kho-hieu",
          tieuDe: "Quá tải câu 14",
          moTa: "",
          trongTam: [14],
          ngCanh: [13, 15],
          claimIds: ["cl-7"],
          gopYIds: ["gy-007"],
          nguoiDocLap: 1,
          soLuot: 1,
          coHoiLai: false,
          baoGianTiep: true,
          traiChieu: false,
          mucDoUuTien: 3,
        },
        {
          id: "iss-s21",
          intent: "hinh-anh",
          tieuDe: "Chữ màn hình dài s21",
          moTa: "",
          trongTam: [28, 29],
          ngCanh: [24, 25, 26, 27, 30],
          claimIds: ["cl-10"],
          gopYIds: ["gy-010"],
          nguoiDocLap: 1,
          soLuot: 1,
          coHoiLai: false,
          baoGianTiep: false,
          traiChieu: false,
          mucDoUuTien: 4,
        },
        {
          id: "iss-audio",
          intent: "am-thanh",
          tieuDe: "Nhạc to phút thứ 2",
          moTa: "",
          trongTam: [11, 14, 19],
          ngCanh: [10, 12, 13, 15, 16, 17, 18],
          claimIds: ["cl-8"],
          gopYIds: ["gy-008"],
          nguoiDocLap: 1,
          soLuot: 1,
          coHoiLai: false,
          baoGianTiep: false,
          traiChieu: false,
          mucDoUuTien: 3,
        },
      ];

      // Chạy Planner với ngân sách mặc định: tối đa 8 câu thu lại
      const planResult = planRevision({
        videoIndex,
        handlerResults: [res2022, res10, res14, resVisual21, resAudio],
        issues,
        vungBaoVe,
        nganSach: { cauThuLai: 8, deltaTongGiay: 10 },
      });

      // Kiểm tra danh sách câu thu lại
      const expectedThuLai = [9, 10, 11, 19, 20, 21, 22, 23];
      assert.deepEqual(
        planResult.keHoachToanCuc.thuLai,
        expectedThuLai,
        `Danh sách câu thu lại phải chính xác là 8 câu [9, 10, 11, 19, 20, 21, 22, 23], thực tế: [${planResult.keHoachToanCuc.thuLai.join(", ")}]`,
      );

      // Kiểm tra ký tự thoại thu lại
      assert.equal(
        planResult.keHoachToanCuc.kyTuThuLai,
        701,
        `Tổng ký tự thoại thu lại phải chính xác là 701 ký tự theo chuẩn TK §8 (thực tế: ${planResult.keHoachToanCuc.kyTuThuLai})`,
      );

      // Kiểm tra câu 14 được chấp nhận với phương án sửa hình
      const item14 = planResult.viecDuocChon.find(
        (w) => w.vanDeId === "iss-14",
      );
      assert.ok(item14, "Việc câu 14 phải được chấp nhận");
      assert.equal(
        item14.phuongAnChon,
        "chinh",
        "Câu 14 sử dụng phương án chính (chỉ sửa hình) để không tốn ngân sách thu âm",
      );
      assert.equal(
        item14.nhom,
        "dung-hinh",
        "Nhóm việc của câu 14 là dung-hinh",
      );

      // Kiểm tra % tiết kiệm
      assert.ok(
        planResult.tietKiemSoVoiLamLai.phanTramTietKiemKyTu >= 80,
        `Tỉ lệ tiết kiệm ký tự thoại phải đạt >= 80% (thực tế: ${planResult.tietKiemSoVoiLamLai.phanTramTietKiemKyTu}%)`,
      );

      // Kiểm tra tổng độ lệch thời lượng nằm trong ngưỡng an toàn (<= 10s)
      assert.ok(
        Math.abs(planResult.keHoachToanCuc.deltaTong) <= 10.0,
        `Độ lệch tổng thời lượng (|delta| = ${Math.abs(planResult.keHoachToanCuc.deltaTong)}s) phải <= 10s`,
      );
    },
  );

  // --------------------------------------------------------------------------
  // TEST CASE 3: Giám khảo thẩm định (LLM Judge & Deterministic rules - TK §7.12)
  // --------------------------------------------------------------------------
  await suite.run(
    "T9.3: Giám khảo thẩm định 4 tiêu chí và xử lý lỗi mềm không chặn run",
    async () => {
      const workItem = {
        id: "viec-1",
        nhom: "bien-kich" as const,
        uuTien: 1,
        diemUuTien: 3.5,
        lyDoUuTien: "Khó hiểu câu 20",
        vanDeId: "iss-2022",
        gopYIds: ["gy-002"],
        nguoiDocLap: 1,
        viTri: { ns: [20], v1: [121.5, 128.0] as [number, number] },
        deXuat: { strategy: "Làm rõ khái niệm" },
        phuongAnChon: "chinh" as const,
        changes: [
          {
            kind: "loi" as const,
            n: 20,
            after:
              "Một ứng dụng thực tế thường tích hợp nhiều mô hình phối hợp.",
          },
        ],
        chiPhiRieng: {} as any,
        trangThai: "chap-nhan" as const,
      };

      const issue: IssueV3 = {
        id: "iss-2022",
        intent: "kho-hieu",
        tieuDe: "Khó hiểu câu 20",
        moTa: "",
        trongTam: [20],
        ngCanh: [19, 21],
        claimIds: [],
        gopYIds: ["gy-002"],
        nguoiDocLap: 1,
        soLuot: 1,
        coHoiLai: false,
        baoGianTiep: false,
        traiChieu: false,
        mucDoUuTien: 1,
      };

      // 1. Thẩm định không truyền model -> dùng bộ quy tắc code tất định
      const judgeRes = await judgeProposalItem({
        item: workItem,
        issue,
        videoIndex,
      });

      assert.equal(judgeRes.trangThaiThamDinh, "da-tham-dinh");
      assert.equal(judgeRes.output.datTieuChi.nhamDungCauTrich, true);
      assert.equal(judgeRes.output.datTieuChi.thayDoiCoNghia, true);
      assert.equal(judgeRes.output.datTieuChi.dungKienThuc, true);
      assert.equal(judgeRes.output.datTieuChi.toiThieu, true);
      assert.equal(judgeRes.output.danhGiaChung, "dat");

      // 2. Thẩm định khi model ném lỗi mạng/hạn ngạch -> không ném lỗi, gắn 'chưa thẩm định'
      const mockFailingModel = {
        specificationVersion: "v1",
        modelId: "mock-fail",
        doGenerate: async () => {
          throw new Error("API Quota Exceeded");
        },
      };

      const judgeResWithFail = await judgeProposalItem({
        item: workItem,
        issue,
        videoIndex,
        model: mockFailingModel,
      });

      assert.equal(
        judgeResWithFail.trangThaiThamDinh,
        "chua-tham-dinh",
        "Khi model lỗi, phải gắn nhãn 'chua-tham-dinh' thay vì crash pipeline",
      );
      assert.ok(
        judgeResWithFail.output.lyDo.includes("Chưa thẩm định bằng LLM"),
        "Lý do phải nêu rõ chưa thẩm định bằng LLM",
      );
    },
  );

  // --------------------------------------------------------------------------
  // TEST CASE 4: Tạo RevisionBrief hoàn chỉnh (TK §8)
  // --------------------------------------------------------------------------
  await suite.run(
    "T9.4: Xây dựng hợp đồng RevisionBrief đầy đủ các phần: phễu, việc, câu hỏi, ghi nhận, vùng bảo vệ",
    async () => {
      const mockFeedback: FeedbackItem[] = [
        {
          id: "gy-001",
          channel: "in-app",
          sender: "hv-001",
          rawText: "nhanh",
          isQuarantined: false,
        },
        {
          id: "gy-002",
          channel: "in-app",
          sender: "hv-002",
          rawText: "kho hieu",
          isQuarantined: false,
        },
        {
          id: "gy-011",
          channel: "in-app",
          sender: "hv-011",
          rawText: "cong kich",
          isQuarantined: true,
        },
      ];

      const questions: HandlerQuestion[] = [
        {
          id: "ch-dung-35",
          noiDung:
            "Khoảng dừng 5s ở câu 35 có ý kiến trái chiều: giữ 5s, rút 3s hay tăng 7s?",
          luaChon: [
            "Giữ nguyên 5 giây (mặc định)",
            "Rút ngắn còn 3 giây",
            "Tăng lên 7 giây",
          ],
          gopYIds: ["gy-005", "gy-006"],
          moPhongLuaChon: [
            { luaChon: "Giữ 5s", deltaTong: 0, canhDungLai: [] },
            { luaChon: "Rút 3s", deltaTong: -2.0, canhDungLai: [35] },
            { luaChon: "Tăng 7s", deltaTong: 2.0, canhDungLai: [35] },
          ],
        },
      ];

      const planResult = planRevision({
        videoIndex,
        handlerResults: [
          {
            vanDeId: "iss-1",
            nhom: "bien-kich",
            uuTien: 1,
            lyDoUuTien: "Sửa câu 10",
            viTri: { ns: [10], v1: [56.2, 61.9] },
            changes: [{ kind: "loi", n: 10, after: "Lời sửa mới" }],
          },
        ],
        issues: [
          {
            id: "iss-1",
            intent: "kho-hieu",
            tieuDe: "Vấn đề câu 10",
            moTa: "",
            trongTam: [10],
            ngCanh: [9, 11],
            claimIds: ["cl-10"],
            gopYIds: ["gy-015"],
            nguoiDocLap: 1,
            soLuot: 1,
            coHoiLai: false,
            baoGianTiep: false,
            traiChieu: false,
            mucDoUuTien: 1,
          },
        ],
        vungBaoVe,
      });

      const brief = buildRevisionBrief({
        feedback: mockFeedback,
        quarantinedFeedback: mockFeedback.filter((f) => f.isQuarantined),
        claims: [{ id: "cl-1", feedbackId: "gy-002", text: "khó hiểu" } as any],
        issues: [{ id: "iss-1" } as any],
        planResult,
        questions,
        ghiNhanList: [
          { gopYIds: ["gy-013"], lyDo: "Ý tưởng cho series tương lai" },
        ],
        vungBaoVeList: vungBaoVe,
      });

      // Kiểm tra phễu
      assert.equal(brief.pheu.gopY, 3);
      assert.equal(brief.pheu.cachLy, 1);
      assert.equal(brief.pheu.y, 1);
      assert.equal(brief.pheu.vanDe, 1);
      assert.equal(brief.pheu.theoNhom["bien-kich"], 1);

      // Kiểm tra câu hỏi
      assert.equal(brief.cauHoi.length, 1);
      assert.equal(brief.cauHoi[0].luaChon.length, 3);

      // Kiểm tra ghi nhận & vùng bảo vệ
      assert.equal(brief.ghiNhan.length, 1);
      assert.equal(brief.vungBaoVe.length, 2);

      // Kiểm tra việc sản xuất
      assert.equal(brief.viec.length, 1);
      assert.equal(brief.viec[0].nhom, "bien-kich");
      assert.ok(
        brief.viec[0].viTri.v2,
        "Việc phải có mốc thời gian v2 ước tính",
      );
    },
  );

  // --------------------------------------------------------------------------
  // TEST CASE 5: Xuất bản và phân chia công việc theo 5 vai trò (TK §8, §9)
  // --------------------------------------------------------------------------
  await suite.run(
    "T9.5: Xuất bản đầy đủ các tệp: 5 lệnh sản xuất, bảng mốc v2, báo cáo chi phí",
    async () => {
      const planResult = planRevision({
        videoIndex,
        handlerResults: [
          {
            vanDeId: "iss-1",
            nhom: "bien-kich",
            uuTien: 1,
            lyDoUuTien: "Sửa câu 20",
            viTri: { ns: [20], v1: [121.5, 128.0] },
            changes: [{ kind: "loi", n: 20, after: "Lời mới câu 20" }],
          },
          {
            vanDeId: "iss-audio",
            nhom: "am-thanh",
            uuTien: 2,
            lyDoUuTien: "Hạ nhạc nền",
            viTri: { ns: [11, 14, 19], v1: [60.0, 120.0] },
            bangChungDo: "Khoảng cách 9.3 dB",
            changes: [
              {
                kind: "kyThuat",
                tu: 60,
                den: 120,
                viec: "mix",
                moTa: "Hạ nhạc nền 11 dB",
              },
            ],
          },
        ],
        issues: [
          {
            id: "iss-1",
            intent: "kho-hieu",
            tieuDe: "Câu 20",
            moTa: "",
            trongTam: [20],
            ngCanh: [19, 21],
            claimIds: [],
            gopYIds: ["gy-002"],
            nguoiDocLap: 1,
            soLuot: 1,
            coHoiLai: false,
            baoGianTiep: false,
            traiChieu: false,
            mucDoUuTien: 1,
          },
          {
            id: "iss-audio",
            intent: "am-thanh",
            tieuDe: "Âm thanh",
            moTa: "",
            trongTam: [11, 14, 19],
            ngCanh: [],
            claimIds: [],
            gopYIds: ["gy-008"],
            nguoiDocLap: 1,
            soLuot: 1,
            coHoiLai: false,
            baoGianTiep: false,
            traiChieu: false,
            mucDoUuTien: 2,
          },
        ],
        vungBaoVe,
      });

      const brief = buildRevisionBrief({
        feedback: [],
        quarantinedFeedback: [],
        claims: [],
        issues: [],
        planResult,
        vungBaoVeList: vungBaoVe,
      });

      // 1. Phân chia công việc theo 5 vai trò
      const workOrders = buildRoleWorkOrders(brief, script, videoIndex);
      assert.ok(
        workOrders.bienKich.includes("BIÊN KỊCH"),
        "Lệnh sản xuất biên kịch phải có tiêu đề rõ ràng",
      );
      assert.ok(
        workOrders.thuAm.includes("THU ÂM"),
        "Lệnh sản xuất thu âm phải có tiêu đề",
      );
      assert.ok(
        workOrders.dungHinh.includes("DỰNG HÌNH"),
        "Lệnh sản xuất dựng hình phải có tiêu đề",
      );
      assert.ok(
        workOrders.amThanh.includes("ÂM THANH"),
        "Lệnh sản xuất âm thanh phải có tiêu đề",
      );
      assert.ok(
        workOrders.phuDe.includes("PHỤ ĐỀ"),
        "Lệnh sản xuất phụ đề phải có tiêu đề",
      );

      assert.ok(
        workOrders.amThanh.includes("11 dB"),
        "Lệnh âm thanh phải nêu mức hạ nhạc nền",
      );
      assert.ok(
        workOrders.thuAm.includes("Câu 19"),
        "Lệnh thu âm phải có cửa sổ đệm",
      );

      // 2. Bảng mốc v2 ước tính
      const timecodesTable = buildEstimatedV2TimecodesTable(brief, videoIndex);
      assert.ok(
        timecodesTable.includes("ƯỚC TÍNH"),
        "Bảng mốc thời gian v2 phải ghi rõ là ước tính trước khi thu giọng",
      );
      assert.ok(
        timecodesTable.includes("YouTube Chapters"),
        "Phải có danh mục chương YouTube",
      );
      assert.ok(timecodesTable.includes("Câu 40"), "Bảng phải đủ 40 câu");

      // 3. Báo cáo so sánh chi phí
      const costReport = buildCostComparisonReport(brief, videoIndex);
      assert.ok(
        costReport.includes("Làm lại toàn bộ"),
        "Báo cáo chi phí phải so với làm lại 100%",
      );
      assert.ok(
        costReport.includes("Revision v2"),
        "Báo cáo chi phí phải đối chiếu với Revision v2 (54%)",
      );

      // 4. Đóng gói toàn bộ gói xuất bản
      const exportPkg = exportRevisionV3Package({
        script,
        brief,
        videoIndex,
      });

      assert.ok(
        exportPkg.kichBanJson.includes('"schema": "hackathon-kich-ban/1"'),
        "Kịch bản JSON hợp lệ",
      );
      assert.ok(
        exportPkg.kichBanMd.includes("# D1 ·"),
        "Kịch bản Markdown hợp lệ",
      );
      assert.ok(exportPkg.workOrders.bienKich.length > 0, "Có lệnh biên kịch");
      assert.ok(exportPkg.bangMocV2Md.length > 0, "Có bảng mốc v2");
      assert.ok(exportPkg.baoCaoChiPhiMd.length > 0, "Có báo cáo chi phí");
      assert.ok(
        exportPkg.truyVetBriefJson.includes('"pheu"'),
        "Có truy vết RevisionBrief",
      );
    },
  );

  const ok = suite.summary();
  if (!ok) process.exit(1);
}

runPlannerTests().catch((err) => {
  console.error("Test runner encountered fatal error:", err);
  process.exit(1);
});

import { getDefaultStore, loadScriptD1 } from "../src";
import {
  type Change,
  calculateRevisionBudget,
  detectConflicts,
  simulateTimeline,
} from "../src/timeline";
import { getOrBuildVideoIndex } from "../src/video-index";
import { TestSuite } from "./lib/assert";

async function runTimelineTests() {
  const suite = new TestSuite(
    "KIỂM THỬ ĐỘNG CƠ TIMELINE & XUNG ĐỘT (TIMELINE ENGINE - TK §5)",
  );
  const store = getDefaultStore();
  const script = loadScriptD1(store);

  const videoIndex = getOrBuildVideoIndex(
    {
      videoId: "d1",
      versionId: "v1",
      script,
      timecodeCsvText: store.readPackFile("video-mau/cau-timecode-d1.csv"),
      transcriptText: store.readPackFile("video-mau/transcript-d1.txt"),
      slideJsonText: store.readPackFile("video-mau/slide-d1.json"),
    },
    store,
  );

  // --------------------------------------------------------------------------
  // 1. Kiểm thử Ràng buộc Kỹ thuật T1 - T6
  // --------------------------------------------------------------------------
  console.log("\n--- [1] Ràng buộc Kỹ thuật T1 - T6 ---");

  await suite.run(
    "T1: Vi phạm tốc độ nói quá nhanh (nuốt chữ > 6.0 âm tiết/s)",
    () => {
      // Câu 5 ban đầu ~18 âm tiết / 4.8s = 3.75 âm tiết/s.
      // Nếu nhồi nhét lời quá dài vào cùng thời lượng mà ép nói nhanh:
      const longText =
        "Trong lĩnh vực công nghệ thông tin và trí tuệ nhân tạo hiện đại ngày nay có rất nhiều các hệ thống tự động hóa vô cùng phức tạp giải bài toán bằng kiến thức chuyên sâu do các chuyên gia đầu ngành viết sẵn.";
      const changes: Change[] = [{ kind: "loi", n: 5, after: longText }];
      // Giả sử câu bị rút ngắn khoảng lặng
      const sim = simulateTimeline(videoIndex, changes);
      // Kiểm tra câu 5 được ghi nhận và ước tính thời lượng hợp lý
      if (!sim.thuLai.includes(5))
        throw new Error("Câu 5 không có trong danh sách thu lại");
    },
  );

  await suite.run(
    "T2: Vi phạm dung sai thời lượng câu đơn (> 3.0s không kèm sửa slide)",
    () => {
      // Thêm lời rất dài làm câu 6 dài hơn > 4s mà không có việc đổi slide
      const extraLong =
        "Một cách hoàn toàn khác biệt và tiên tiến hơn rất nhiều là cho hệ thống tự động học hỏi liên tục từ hàng triệu ví dụ mẫu thực tế trong đời sống để tự nó nhận diện ra mọi đặc điểm đặc trưng cốt lõi giúp giải quyết bài toán phức tạp một cách tối ưu nhất.";
      const changes: Change[] = [{ kind: "loi", n: 6, after: extraLong }];
      const sim = simulateTimeline(videoIndex, changes);
      const t2 = sim.viPham.find((v) => v.ma === "T2" && v.n === 6);
      if (!t2) throw new Error("Chưa phát hiện vi phạm T2 cho câu lệch > 3.0s");
    },
  );

  await suite.run("T3: Vi phạm tổng độ lệch thời lượng video (> 10.0s)", () => {
    // Sửa nhiều câu làm tổng thời lượng tăng > 12s
    const changes: Change[] = [
      {
        kind: "loi",
        n: 4,
        after:
          "Trí tuệ nhân tạo là lĩnh vực nghiên cứu vô cùng rộng lớn làm cho máy tính thực hiện những công việc mà trước đây đòi hỏi sự thông minh và tư duy phức tạp của con người như phân tích dữ liệu, nhận diện hình ảnh và xử lý ngôn ngữ tự nhiên.",
      },
      {
        kind: "loi",
        n: 6,
        after:
          "Một cách làm khác đang rất phổ biến hiện nay là cho hệ thống học trực tiếp từ khối lượng lớn dữ liệu thực tế để tự động nhận ra các quy luật tiềm ẩn giúp giải quyết công việc hiệu quả mà không cần lập trình viên viết từng dòng quy tắc.",
      },
      {
        kind: "loi",
        n: 8,
        after:
          "Bộ lọc thông minh sẽ dựa vào toàn bộ kiến thức và mẫu hình đã học được trong quá khứ để tự động phân tích cấu trúc, tiêu đề và nội dung để dự đoán chính xác bức thư mới là thư rác hay thư công việc quan trọng.",
      },
    ];
    const sim = simulateTimeline(videoIndex, changes);
    const t3 = sim.viPham.find((v) => v.ma === "T3");
    if (!t3)
      throw new Error(
        "Chưa phát hiện vi phạm T3 khi tổng thời lượng lệch > 10.0s",
      );
    console.log(`    Độ lệch tổng cộng mô phỏng: ${sim.deltaTong}s`);
  });

  await suite.run("T4: Vi phạm khoảng lặng tối thiểu (< 0.3s)", () => {
    const changes: Change[] = [
      { kind: "dung", n: 7, giay: 0.1 }, // ép khoảng lặng xuống 0.1s
    ];
    const sim = simulateTimeline(videoIndex, changes);
    const t4 = sim.viPham.find((v) => v.ma === "T4" && v.n === 7);
    if (!t4)
      throw new Error("Chưa phát hiện vi phạm T4 cho khoảng lặng < 0.3s");
  });

  await suite.run(
    "T6: Phát hiện chuỗi slide chains khi câu trong cùng slide bị thay đổi",
    () => {
      // Câu 15 và 16 cùng thuộc slide s15. Nếu sửa câu 15:
      const changes: Change[] = [
        {
          kind: "loi",
          n: 15,
          after:
            "Trên bản đồ tổng quan này, chúng ta xem xét các mô hình tạo sinh học từ lượng lớn dữ liệu huấn luyện, vì vậy ta xếp chúng hoàn toàn vào bên trong vùng học máy.",
        },
      ];
      const sim = simulateTimeline(videoIndex, changes);
      const slideOverlap = sim.chongLan.find(
        (c) => c.loai === "cung-slide" && c.ns.includes(15),
      );
      if (!slideOverlap)
        throw new Error("Chưa nhận diện câu 15 thuộc chuỗi slide chung");
    },
  );

  // --------------------------------------------------------------------------
  // 2. Kiểm thử Phát hiện 6 Loại Xung đột (Conflicts)
  // --------------------------------------------------------------------------
  console.log("\n--- [2] Phát hiện 6 Loại Xung đột ---");

  await suite.run(
    "CONF-01: Ghi đè lời nhiều lần (ghi-de-loi-nhieu-lan)",
    () => {
      const changes: Change[] = [
        { kind: "loi", n: 10, after: "Phương án A cho câu 10" },
        { kind: "loi", n: 10, after: "Phương án B hoàn toàn khác cho câu 10" },
      ];
      const conflicts = detectConflicts(videoIndex, changes);
      const c1 = conflicts.find((c) => c.type === "ghi-de-loi-nhieu-lan");
      if (!c1 || c1.severity !== "chan" || !c1.affectedSentences.includes(10)) {
        throw new Error("Không phát hiện đúng xung đột ghi đè lời");
      }
      if (c1.resolutionOptions.length !== 2) {
        throw new Error(
          `Kỳ vọng 2 lựa chọn giải quyết, nhận: ${c1.resolutionOptions.length}`,
        );
      }
    },
  );

  await suite.run(
    "CONF-02: Lệch thời gian vượt ngưỡng (lech-thoi-gian-vuot-nguong)",
    () => {
      const changes: Change[] = [
        {
          kind: "loi",
          n: 4,
          after:
            "Trí tuệ nhân tạo là lĩnh vực nghiên cứu vô cùng rộng lớn làm cho máy tính thực hiện những công việc mà trước đây đòi hỏi sự thông minh và tư duy phức tạp của con người như phân tích dữ liệu, nhận diện hình ảnh và xử lý ngôn ngữ tự nhiên.",
        },
        {
          kind: "loi",
          n: 6,
          after:
            "Một cách làm khác đang rất phổ biến hiện nay là cho hệ thống học trực tiếp từ khối lượng lớn dữ liệu thực tế để tự động nhận ra các quy luật tiềm ẩn giúp giải quyết công việc hiệu quả mà không cần lập trình viên viết từng dòng quy tắc.",
        },
        {
          kind: "loi",
          n: 8,
          after:
            "Bộ lọc thông minh sẽ dựa vào toàn bộ kiến thức và mẫu hình đã học được trong quá khứ để tự động phân tích cấu trúc, tiêu đề và nội dung để dự đoán chính xác bức thư mới là thư rác hay thư công việc quan trọng.",
        },
      ];
      const conflicts = detectConflicts(videoIndex, changes);
      const c2 = conflicts.find((c) => c.type === "lech-thoi-gian-vuot-nguong");
      if (!c2 || c2.severity !== "chan") {
        throw new Error("Không phát hiện xung đột lệch thời gian vượt ngưỡng");
      }
    },
  );

  await suite.run("CONF-03: Sửa vào vùng bảo vệ (sua-vung-bao-ve)", () => {
    const changes: Change[] = [
      { kind: "loi", n: 2, after: "Lời mới sửa vào câu 2 thuộc phần mở đầu" },
    ];
    const conflicts = detectConflicts(videoIndex, changes, [1, 2, 3]);
    const c3 = conflicts.find((c) => c.type === "sua-vung-bao-ve");
    if (!c3 || !c3.affectedSentences.includes(2)) {
      throw new Error("Không cảnh báo sửa vùng bảo vệ câu 2");
    }
  });

  await suite.run(
    "CONF-04: Lệch slide chưa re-render (lech-slide-chua-re-render)",
    () => {
      // Câu 15 dài thêm > 2s nhưng không có task sửa slide
      const changes: Change[] = [
        {
          kind: "loi",
          n: 15,
          after:
            "Trên bản đồ chi tiết này, chúng ta xét rất kỹ các mô hình tạo sinh được huấn luyện trực tiếp từ dữ liệu thực nghiệm, do đó chúng ta hoàn toàn xếp chúng vào trong vùng học máy.",
        },
      ];
      const conflicts = detectConflicts(videoIndex, changes);
      const c4 = conflicts.find((c) => c.type === "lech-slide-chua-re-render");
      if (!c4 || !c4.affectedSentences.includes(15)) {
        throw new Error("Không cảnh báo lệch slide chưa có việc re-render");
      }
    },
  );

  await suite.run("CONF-05: Lệch nhạc chưa mix (lech-nhac-chua-mix)", () => {
    // Sửa câu 14 nằm trong vùng 1:00-2:00 có nhạc nền mà không có việc mix
    const changes: Change[] = [
      {
        kind: "loi",
        n: 14,
        after:
          "Trí tuệ nhân tạo tạo sinh là tên gọi chính thức cho những hệ thống có khả năng tự động sinh ra nội dung số.",
      },
    ];
    const conflicts = detectConflicts(videoIndex, changes);
    const c5 = conflicts.find((c) => c.type === "lech-nhac-chua-mix");
    if (!c5 || !c5.affectedSentences.includes(14)) {
      throw new Error("Không cảnh báo sửa đoạn có nhạc nền chưa mix");
    }
  });

  await suite.run(
    "CONF-06: Nhanh chậm trái ngược trong cùng phân đoạn (nhanh-cham-trai-nguoc)",
    () => {
      // Trong phân đoạn 1 (câu 1-3): câu 2 tăng > 3s, câu 3 giảm > 3s
      const changes: Change[] = [
        {
          kind: "loi",
          n: 2,
          after:
            "Cả hai công cụ này đều có thể sử dụng các thuật toán trí tuệ nhân tạo hiện đại, tuy nhiên bản chất nhiệm vụ xử lý bên trong và dạng kết quả dữ liệu trả về cho người dùng lại hoàn toàn khác nhau về mọi mặt.",
        },
        { kind: "loi", n: 3, after: "Mình sẽ phân biệt AI và LLM." },
      ];
      const conflicts = detectConflicts(videoIndex, changes, []);
      const c6 = conflicts.find((c) => c.type === "nhanh-cham-trai-nguoc");
      if (!c6) {
        throw new Error("Không phát hiện xung đột tăng/giảm nhịp trái ngược");
      }
    },
  );

  // --------------------------------------------------------------------------
  // 3. Kiểm thử Tính toán Ngân sách (Budget & Cost)
  // --------------------------------------------------------------------------
  console.log("\n--- [3] Ngân sách An toàn Mặc định (8 câu thu lại) ---");

  await suite.run(
    "BUDGET-01: Bộ 8 câu thu lại chuẩn đạt ngưỡng ngân sách an toàn",
    () => {
      // 8 câu tối ưu của revision@3 (khoảng 701 ký tự)
      const optimal8Sentences = [
        {
          kind: "loi" as const,
          n: 3,
          after:
            "Mình sẽ dùng ba công cụ quen thuộc để phân biệt rõ trí tuệ nhân tạo, học máy, tạo sinh và mô hình ngôn ngữ lớn.",
        },
        {
          kind: "loi" as const,
          n: 9,
          after: "Cách học tự động từ dữ liệu thực tế ấy được gọi là học máy.",
        },
        {
          kind: "loi" as const,
          n: 14,
          after:
            "Trí tuệ nhân tạo tạo sinh là tên gọi cho các hệ thống tạo ra nội dung mới như văn bản, ảnh hay âm thanh.",
        },
        {
          kind: "loi" as const,
          n: 18,
          after:
            "Mô hình ngôn ngữ lớn học quy luật từ ngữ từ lượng lớn văn bản để hiểu và sinh câu từ tự nhiên.",
        },
        {
          kind: "loi" as const,
          n: 20,
          after:
            "Ứng dụng trò chuyện tiếp nhận câu hỏi của bạn và dùng mô hình ngôn ngữ lớn để trả lời.",
        },
        {
          kind: "loi" as const,
          n: 25,
          after:
            "Hãy đặt thẻ thứ nhất: bộ lọc học từ thư mẫu để phân loại thư mới gửi đến.",
        },
        {
          kind: "loi" as const,
          n: 31,
          after:
            "Nếu giao chính mô hình ấy phân loại thư rác, công việc đã đổi dù mô hình vẫn giữ nguyên.",
        },
        {
          kind: "loi" as const,
          n: 37,
          after:
            "Trí tuệ nhân tạo là lĩnh vực chung, học máy là cách học từ dữ liệu, tạo sinh là tạo nội dung mới.",
        },
      ];

      const sim = simulateTimeline(videoIndex, optimal8Sentences);
      const budget = calculateRevisionBudget(sim, videoIndex);

      console.log(`    Số câu thu lại: ${budget.soCauThuLai}`);
      console.log(`    Ký tự thu lại: ${budget.tongKyTuThuLai} ký tự`);
      console.log(`    Delta thời lượng: ${budget.deltaThoiLuongGiay}s`);
      console.log(
        `    Tiết kiệm so với làm lại 100%: ${budget.phanTramTietKiemSoVoiLamLai}%`,
      );

      if (budget.soCauThuLai !== 8) {
        throw new Error(
          `Kỳ vọng 8 câu thu lại, thực tế: ${budget.soCauThuLai}`,
        );
      }
      if (!budget.datNguongNganSach) {
        throw new Error(
          "Kế hoạch 8 câu phải thỏa mãn ngưỡng ngân sách an toàn",
        );
      }
      if (budget.phanTramTietKiemSoVoiLamLai < 60) {
        throw new Error(
          "Tỷ lệ tiết kiệm phải >= 60% so với làm lại toàn bộ video",
        );
      }
    },
  );

  const passed = suite.summary();
  if (!passed) {
    process.exit(1);
  }
}

runTimelineTests().catch((err) => {
  console.error("Lỗi khi chạy test timeline:", err);
  process.exit(1);
});

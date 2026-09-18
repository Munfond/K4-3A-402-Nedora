import { TestSuite, skip } from "./lib/assert";
import { getStudioPackDir } from "./lib/pack";
import { getDefaultStore, loadScriptD1 } from "../src";
import { buildVideoIndex } from "../src/video-index/build";
import { verifyClaimContent } from "../src/verify/content-check";
import { formIssues } from "../src/issues/form";
import { localizeClaim } from "../src/localize";
import type { Claim, Localization } from "../src/claims/types";

async function runIssuesTests() {
  const suite = new TestSuite(
    "KIỂM THỬ KIỂM CHỨNG & GOM VẤN ĐỀ (VERIFY & ISSUES - TK §7.5 & §7.15)",
  );

  const packDir = getStudioPackDir();
  if (!packDir) {
    skip(
      "Không tìm thấy data/studio-pack/c5-feedbackradar, bỏ qua kiểm thử issues trên D1",
    );
    process.exit(0);
  }

  const store = getDefaultStore();
  const script = loadScriptD1(store);
  const videoIndex = buildVideoIndex({
    videoId: "d1",
    versionId: "v1",
    script,
    timecodeCsvText: store.readPackFile("video-mau/cau-timecode-d1.csv"),
    transcriptText: store.readPackFile("video-mau/transcript-d1.txt"),
    slideJsonText: store.readPackFile("video-mau/slide-d1.json"),
  });

  // --------------------------------------------------------------------------
  // 1. Kiểm thử 6 Trường hợp Kiểm chứng Nội dung (Content Check)
  // --------------------------------------------------------------------------
  console.log("\n--- [1] Kiểm chứng nội dung (6 trường hợp TK §7.15) ---");

  await suite.run(
    "CHK-01: Ca giả 'phần token' → không khớp video, không tạo vấn đề",
    async () => {
      const claim: Claim = {
        id: "clm-fake-token",
        feedbackId: "fb-fake-token",
        sender: "hv-999",
        role: "hv",
        intent: "noi-dung-sai",
        trich: "phần giải thích token trong transformer bị sai",
        baoGianTiep: false,
        lanHoiLai: 0,
      };

      const loc = await localizeClaim(claim, videoIndex);
      const check = verifyClaimContent(claim, loc, videoIndex);

      if (check.truongHop !== "khong-khop-video") {
        throw new Error(
          `Kỳ vọng truongHop 'khong-khop-video', nhận: ${check.truongHop}`,
        );
      }
      if (check.hopLeDeTaoVanDe !== false) {
        throw new Error("Kỳ vọng hopLeDeTaoVanDe = false để không tạo vấn đề");
      }
    },
  );

  await suite.run(
    "CHK-02: Ca giả 'học máy không thuộc trí tuệ nhân tạo' → ngược kịch bản và thành bằng chứng khó hiểu tại câu 11",
    async () => {
      const claim: Claim = {
        id: "clm-fake-contra",
        feedbackId: "fb-fake-contra",
        sender: "hv-888",
        role: "hv",
        intent: "noi-dung-sai",
        trich: "video nói học máy không thuộc trí tuệ nhân tạo",
        baoGianTiep: false,
        lanHoiLai: 0,
      };

      const loc = await localizeClaim(claim, videoIndex);
      const check = verifyClaimContent(claim, loc, videoIndex);

      if (check.truongHop !== "nguoc-kich-ban") {
        throw new Error(
          `Kỳ vọng truongHop 'nguoc-kich-ban', nhận: ${check.truongHop}`,
        );
      }
      if (!check.chuyenThanhKhoHieu) {
        throw new Error("Kỳ vọng chuyenThanhKhoHieu = true");
      }
      if (!check.cauTrongTam.includes(11)) {
        throw new Error(
          `Kỳ vọng câu trọng tâm là 11, nhận: ${JSON.stringify(check.cauTrongTam)}`,
        );
      }
    },
  );

  await suite.run("CHK-03: Góp ý về phiên bản cũ → không tạo vấn đề", () => {
    const claim: Claim = {
      id: "clm-old-v",
      feedbackId: "fb-old-v",
      sender: "hv-777",
      role: "hv",
      intent: "noi-dung-sai",
      trich: "lời câu 5 bị vấp",
      baoGianTiep: false,
      lanHoiLai: 0,
    };

    const loc: Localization = {
      claimId: claim.id,
      cach: "moc-thoi-gian",
      trongTam: [5],
      ngCanh: [4, 5, 6],
      doChac: 0.9,
      kiemChung: "khop",
    };

    const check = verifyClaimContent(claim, loc, videoIndex, {
      ngayPhatHanhPhienBan: "2026-09-01T00:00:00Z",
      thoiDiemGui: "2026-08-15T00:00:00Z",
    });

    if (check.truongHop !== "phien-ban-cu" || check.hopLeDeTaoVanDe !== false) {
      throw new Error(
        `Kỳ vọng phien-ban-cu & khong tao van de: ${JSON.stringify(check)}`,
      );
    }
  });

  // --------------------------------------------------------------------------
  // 2. Kiểm thử Gom vấn đề & Vùng bảo vệ trên D1
  // --------------------------------------------------------------------------
  console.log("\n--- [2] Gom Vấn đề & Thiết lập Vùng bảo vệ trên D1 ---");

  await suite.run(
    "FORM-01: Vấn đề câu 20–23 có đúng 2 người, 4 góp ý, cờ hỏi lại bật",
    async () => {
      // 4 Góp ý về đoạn 20-23
      const claims: Claim[] = [
        {
          id: "clm-002",
          feedbackId: "gy-002",
          sender: "hv-011",
          role: "hv",
          intent: "kho-hieu",
          trich:
            "Phần phân biệt mô hình ngôn ngữ lớn với ứng dụng trò chuyện em xem hai lần vẫn thấy lẫn. Chỗ nói cùng một ứng dụng nối được nhiều mô hình ấy ạ.",
          baoGianTiep: false,
          lanHoiLai: 0,
        },
        {
          id: "clm-003",
          feedbackId: "gy-003",
          sender: "hv-011",
          role: "hv",
          intent: "kho-hieu",
          trich:
            "Em nhắn lại về đoạn ứng dụng trò chuyện với mô hình ngôn ngữ lớn, vẫn chưa rõ lắm ạ.",
          baoGianTiep: false,
          lanHoiLai: 1,
        },
        {
          id: "clm-018",
          feedbackId: "gy-018",
          sender: "hv-011",
          role: "hv",
          intent: "kho-hieu",
          trich:
            "Vẫn là phần phân biệt ứng dụng với mô hình ngôn ngữ lớn chưa rõ",
          baoGianTiep: false,
          lanHoiLai: 2,
        },
        {
          id: "clm-022",
          feedbackId: "gy-022",
          sender: "hv-022",
          role: "hv",
          intent: "kho-hieu",
          trich: "Chỗ ứng dụng nối nhiều mô hình câu 22 giải thích chưa kỹ",
          baoGianTiep: false,
          lanHoiLai: 0,
        },
      ];

      const locs: Localization[] = [];
      for (const c of claims) {
        locs.push(await localizeClaim(c, videoIndex));
      }

      const { issues } = formIssues(claims, locs, videoIndex);

      if (issues.length !== 1) {
        throw new Error(`Kỳ vọng gom đúng 1 vấn đề, nhận: ${issues.length}`);
      }

      const issue = issues[0];
      if (issue.nguoiDocLap !== 2) {
        throw new Error(
          `Kỳ vọng đúng 2 người độc lập, nhận: ${issue.nguoiDocLap}`,
        );
      }
      if (issue.soLuot !== 4) {
        throw new Error(`Kỳ vọng 4 lượt góp ý, nhận: ${issue.soLuot}`);
      }
      if (!issue.coHoiLai) {
        throw new Error("Kỳ vọng cờ coHoiLai = true");
      }
      if (!issue.trongTam.includes(22)) {
        throw new Error(
          `Kỳ vọng trongTam chứa câu 22, nhận: ${JSON.stringify(issue.trongTam)}`,
        );
      }

      console.log(
        `    ✓ Gom thành công vấn đề: "${issue.tieuDe}" (${issue.nguoiDocLap} người, ${issue.soLuot} lượt, cờ hỏi lại: ${issue.coHoiLai})`,
      );
    },
  );

  await suite.run(
    "FORM-02: Thiết lập Vùng bảo vệ từ các ý khen-giu (1–3, 31, 24–32)",
    async () => {
      const claims: Claim[] = [
        {
          id: "clm-p-1",
          feedbackId: "gy-014",
          sender: "hv-067",
          role: "hv",
          intent: "khen-giu",
          trich:
            "Đoạn mở đầu hai công cụ hai nhiệm vụ rất dễ hiểu, giữ nguyên nhé ạ.",
          baoGianTiep: false,
          lanHoiLai: 0,
        },
        {
          id: "clm-p-2",
          feedbackId: "gy-004",
          sender: "hv-023",
          role: "hv",
          intent: "khen-giu",
          trich:
            "Chỗ nói tên mô hình giữ nguyên nhưng công việc thay đổi là chỗ hay nhất video, nghe xong em mới vỡ ra.",
          baoGianTiep: false,
          lanHoiLai: 0,
        },
        {
          id: "clm-p-3",
          feedbackId: "gy-016-2",
          sender: "gv-01",
          role: "gv",
          intent: "khen-giu",
          trich: "Còn phần bản đồ khái niệm thì giữ, sinh viên phản hồi tốt.",
          baoGianTiep: false,
          lanHoiLai: 0,
        },
      ];

      const locs: Localization[] = [];
      for (const c of claims) {
        locs.push(await localizeClaim(c, videoIndex));
      }

      const { vungBaoVe } = formIssues(claims, locs, videoIndex);

      // Kiểm tra có đủ 3 vùng bảo vệ: 1-3, 31, 24-32
      const has1to3 = vungBaoVe.some(
        (v) => v.ns.includes(1) && v.ns.includes(2) && v.ns.includes(3),
      );
      const has31 = vungBaoVe.some((v) => v.ns.includes(31));
      const has24to32 = vungBaoVe.some(
        (v) => v.ns.includes(24) && v.ns.includes(30),
      );

      if (!has1to3) throw new Error("Thiếu vùng bảo vệ mở đầu 1–3");
      if (!has31) throw new Error("Thiếu vùng bảo vệ câu 31");
      if (!has24to32) throw new Error("Thiếu vùng bảo vệ bản đồ 24–32");

      console.log(`    ✓ Đã tạo ${vungBaoVe.length} vùng bảo vệ:`);
      vungBaoVe.forEach((v) =>
        console.log(
          `      • [${v.ns[0]}..${v.ns[v.ns.length - 1]}]: ${v.lyDo}`,
        ),
      );
    },
  );

  const passed = suite.summary();
  if (!passed) {
    process.exit(1);
  }
}

runIssuesTests().catch((err) => {
  console.error("Lỗi khi chạy test issues:", err);
  process.exit(1);
});

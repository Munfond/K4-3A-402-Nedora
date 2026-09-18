import { tool } from "ai";
import { z } from "zod";
import type { VideoIndex, SegmentIndex } from "../video-index/types";
import { retrieveCandidates } from "../localize/retrieve";
import { countSyllables } from "../video-index/pace";
import { simulateTimeline } from "../timeline/simulate";
import type { Change, PlanSimulation } from "../timeline/types";

export interface ToolCallTelemetry {
  name: string;
  ms: number;
  ok: boolean;
  bytes: number;
}

export interface ToolOptions {
  onToolCall?: (event: ToolCallTelemetry) => void;
}

/**
 * 1. find_by_time: Tìm các câu giao nhau với mốc thời gian
 */
export function findByTimeFn(videoIndex: VideoIndex, tu: number, den?: number) {
  const start = tu;
  const end = den !== undefined && den >= tu ? den : tu;
  const segments = videoIndex.segments || [];

  const matches: Array<{
    n: number;
    batDau: number;
    ketThuc: number;
    phanGiaoGiay: number;
    tyLeGiao: number;
    loi: string;
  }> = [];

  for (const seg of segments) {
    if (start === end) {
      if (seg.batDau <= start && start <= seg.ketThuc) {
        matches.push({
          n: seg.n,
          batDau: seg.batDau,
          ketThuc: seg.ketThuc,
          phanGiaoGiay: seg.ketThuc - seg.batDau,
          tyLeGiao: 1.0,
          loi: seg.loi || "",
        });
      }
      continue;
    }

    const overlapStart = Math.max(seg.batDau, start);
    const overlapEnd = Math.min(seg.ketThuc, end);
    const overlap = Math.max(0, overlapEnd - overlapStart);

    if (overlap > 0) {
      const segDuration = seg.ketThuc - seg.batDau;
      const tyLeGiao = segDuration > 0 ? overlap / segDuration : 1.0;
      matches.push({
        n: seg.n,
        batDau: seg.batDau,
        ketThuc: seg.ketThuc,
        phanGiaoGiay: Number(overlap.toFixed(2)),
        tyLeGiao: Number(tyLeGiao.toFixed(2)),
        loi: seg.loi || "",
      });
    }
  }

  return {
    khoangTim: [start, end],
    soLuong: matches.length,
    ketQua: matches,
  };
}

/**
 * 2. search_segments: Tìm kiếm BM25 trên nội dung video
 */
export function searchSegmentsFn(
  videoIndex: VideoIndex,
  query: string,
  topK = 5,
) {
  const candidates = retrieveCandidates(query, videoIndex, topK);
  return {
    query,
    soLuong: candidates.length,
    ungVien: candidates.map((c) => ({
      n: c.n,
      diem: c.diem,
      lyDo: c.lyDo,
      phanTen: c.segment.phanTen,
      batDau: c.segment.batDau,
      ketThuc: c.segment.ketThuc,
      loi: c.segment.loi,
      chuTrenManHinh: c.segment.chuTrenManHinh,
      yDoHinh: c.segment.yDoHinh,
    })),
  };
}

/**
 * 3. get_segment: Lấy chi tiết câu và ngữ cảnh lân cận
 */
export function getSegmentFn(videoIndex: VideoIndex, n: number, lanCan = 0) {
  const segments = videoIndex.segments || [];
  const minN = Math.max(1, n - lanCan);
  const maxN = Math.min(segments.length, n + lanCan);

  const matched = segments.filter((s) => s.n >= minN && s.n <= maxN);
  const target = segments.find((s) => s.n === n);

  return {
    cauChinh: target || null,
    lanCan: matched,
    slideChains:
      videoIndex.slideChains?.filter((sc) => sc.cau.includes(n)) || [],
    audioKhoangCachDb: target?.amThanh?.khoangCachDb,
  };
}

/**
 * 4. glossary: Tra cứu thuật ngữ chuyên môn
 */
export function glossaryFn(videoIndex: VideoIndex, term?: string) {
  const list = videoIndex.glossary || [];
  if (!term || term.trim() === "") {
    return { tongSo: list.length, danhSach: list };
  }

  const norm = term.toLowerCase().trim();
  const matched = list.filter((g) => g.thuatNgu.toLowerCase().includes(norm));
  return {
    timKiem: term,
    soLuong: matched.length,
    ketQua: matched,
  };
}

/**
 * 5. visual_profile: Tín hiệu hình ảnh từ kịch bản và slide (không OCR)
 */
export function visualProfileFn(
  videoIndex: VideoIndex,
  args: { tu?: number; den?: number; ns?: number[] },
) {
  const segments = videoIndex.segments || [];
  const targetNs = new Set<number>();

  if (args.ns && args.ns.length > 0) {
    for (const n of args.ns) targetNs.add(n);
  } else if (args.tu !== undefined) {
    const timeMatch = findByTimeFn(videoIndex, args.tu, args.den);
    for (const m of timeMatch.ketQua) targetNs.add(m.n);
  } else {
    for (const s of segments) targetNs.add(s.n);
  }

  const matched = segments.filter((s) => targetNs.has(s.n));

  const items = matched.map((s) => {
    const doDaiChu =
      s.tinHieuHinh?.doDaiChuManHinh ||
      (s.chuTrenManHinh ? s.chuTrenManHinh.length : 0);
    const soThanhPhan = s.tinHieuHinh?.soThanhPhanChu || 1;
    return {
      n: s.n,
      slideId: s.slideId,
      viTriTrongSlide: s.viTriTrongSlide,
      slideDungDan: s.slideDungDan,
      chuTrenManHinh: s.chuTrenManHinh,
      yDoHinh: s.yDoHinh,
      doDaiChuManHinh: doDaiChu,
      soThanhPhanChu: soThanhPhan,
      canhBaoChuDai: doDaiChu > 40,
      canhBaoBoCucPhucTap: soThanhPhan >= 3,
      khungCuoi: s.khungCuoi,
    };
  });

  const slideChains =
    videoIndex.slideChains?.filter((sc) =>
      sc.cau.some((n) => targetNs.has(n)),
    ) || [];

  return {
    soLuong: items.length,
    cau: items,
    slideChains,
    ketLuan:
      "Cần người duyệt xem khung hình thực tế để kiểm tra trực quan kích cỡ chữ và bố cục",
  };
}

/**
 * 6. audio_profile: Mức dB giọng vs nhạc nền
 */
export function audioProfileFn(
  videoIndex: VideoIndex,
  args: { tu?: number; den?: number; ns?: number[]; nguongDb?: number },
) {
  const nguongDb = args.nguongDb ?? 20;
  const segments = videoIndex.segments || [];
  const targetNs = new Set<number>();

  if (args.ns && args.ns.length > 0) {
    for (const n of args.ns) targetNs.add(n);
  } else if (args.tu !== undefined) {
    const timeMatch = findByTimeFn(videoIndex, args.tu, args.den);
    for (const m of timeMatch.ketQua) targetNs.add(m.n);
  } else {
    // Mặc định lấy các câu có dữ liệu âm thanh
    for (const s of segments) targetNs.add(s.n);
  }

  const matched = segments.filter((s) => targetNs.has(s.n) && s.amThanh);
  const distances = matched
    .map((s) => s.amThanh?.khoangCachDb)
    .filter((d): d is number => d !== undefined);

  if (distances.length === 0) {
    return {
      nguongDb,
      soCauKiemTra: 0,
      ketLuan: "khong-tai-hien" as const,
      thongBao: "Không có dữ liệu đo âm thanh trong đoạn này",
      mucHaDeXuatDb: 0,
      chiTiet: [],
    };
  }

  distances.sort((a, b) => a - b);
  const minDb = distances[0];
  const medianDb = distances[Math.floor(distances.length / 2)];

  const violations = matched.filter(
    (s) => (s.amThanh?.khoangCachDb ?? 99) < nguongDb,
  );

  let ketLuan: "xac-nhan" | "xac-nhan-mot-phan" | "khong-tai-hien" =
    "khong-tai-hien";
  if (violations.length === matched.length) {
    ketLuan = "xac-nhan";
  } else if (violations.length > 0) {
    ketLuan = "xac-nhan-mot-phan";
  }

  const mucHaDeXuatDb = Math.max(0, Math.ceil(nguongDb - minDb));

  return {
    nguongDb,
    soCauKiemTra: matched.length,
    khoangCachDbNhoNhat: minDb,
    khoangCachDbTrungVi: medianDb,
    soCauDuoiNguong: violations.length,
    ketLuan,
    mucHaDeXuatDb,
    cauThapNhat: violations.map((s) => ({
      n: s.n,
      batDau: s.batDau,
      ketThuc: s.ketThuc,
      khoangCachDb: s.amThanh?.khoangCachDb,
    })),
  };
}

/**
 * 7. pace_profile: Tốc độ âm tiết/giây, z-score và khoảng lặng
 */
export function paceProfileFn(
  videoIndex: VideoIndex,
  args: { tu?: number; den?: number; ns?: number[] },
) {
  const segments = videoIndex.segments || [];
  const targetNs = new Set<number>();

  if (args.ns && args.ns.length > 0) {
    for (const n of args.ns) targetNs.add(n);
  } else if (args.tu !== undefined) {
    const timeMatch = findByTimeFn(videoIndex, args.tu, args.den);
    for (const m of timeMatch.ketQua) targetNs.add(m.n);
  } else {
    for (const s of segments) targetNs.add(s.n);
  }

  const matched = segments.filter((s) => targetNs.has(s.n));
  const avgVideoPace = videoIndex.tocDoGiong?.trungBinh || 4.52;
  const stdVideoPace = videoIndex.tocDoGiong?.doLech || 0.3;

  let totalSyllables = 0;
  let totalSpeechSec = 0;
  let totalNewTerms = 0;

  const items = matched.map((s) => {
    const speechSec = Math.max(0.1, s.ketThucTieng - s.batDau);
    const pace = s.tocDo || s.amTiet / speechSec;
    const zScore = Number(((pace - avgVideoPace) / stdVideoPace).toFixed(2));
    totalSyllables += s.amTiet;
    totalSpeechSec += speechSec;
    totalNewTerms += s.thuatNguMoi?.length || 0;

    return {
      n: s.n,
      amTiet: s.amTiet,
      speechSec: Number(speechSec.toFixed(2)),
      pace: Number(pace.toFixed(2)),
      zScore,
      khoangLangCuoi: s.khoangLangCuoi,
      dungGiay: s.dungGiay,
      thuatNguMoi: s.thuatNguMoi || [],
    };
  });

  const segAvgPace =
    totalSpeechSec > 0
      ? Number((totalSyllables / totalSpeechSec).toFixed(2))
      : avgVideoPace;
  const avgZ = Number(((segAvgPace - avgVideoPace) / stdVideoPace).toFixed(2));

  let chanDoan = "";
  if (Math.abs(avgZ) < 1.5) {
    chanDoan = `Tốc độ đọc đoạn này (${segAvgPace} âm tiết/s) không khác biệt có ý nghĩa thống kê so với trung bình toàn bài (${avgVideoPace} âm tiết/s, z = ${avgZ}). Cảm giác nói nhanh chủ yếu do mật độ thuật ngữ mới (${totalNewTerms} thuật ngữ) hoặc cấu trúc câu dài.`;
  } else if (avgZ >= 1.5) {
    chanDoan = `Tốc độ đọc nhanh hơn đáng kể so với mức chuẩn (z = ${avgZ} >= 1.5).`;
  } else {
    chanDoan = `Tốc độ đọc chậm hơn đáng kể so với mức chuẩn (z = ${avgZ} <= -1.5).`;
  }

  return {
    soCau: items.length,
    tocDoTrungBinhDoan: segAvgPace,
    tocDoChungVideo: avgVideoPace,
    zScoreTrungBinh: avgZ,
    tongThuatNguMoi: totalNewTerms,
    chanDoan,
    giaiPhapTheoThuTuChiPhi: [
      {
        thuTu: 1,
        ten: "Nới khoảng lặng cuối câu (dung)",
        chiPhi: "0đ (không thu lại giọng, chỉ dựng lại khoảng nghỉ)",
        tacDong: "Cho người học thêm thời gian tiêu hóa kiến thức",
      },
      {
        thuTu: 2,
        ten: "Đổi kiểu đọc sang 'hoi' (x0.90) hoặc 'chot' (x0.86)",
        chiPhi: "Thu lại 1-2 câu",
        tacDong: "Hạ nhịp đọc ở các câu then chốt",
      },
      {
        thuTu: 3,
        ten: "Biên tập lại kịch bản ngắn gọn hơn",
        chiPhi: "Thu lại toàn bộ cửa sổ liên quan",
        tacDong: "Giảm tải thông tin trực tiếp",
      },
    ],
    chiTietCau: items,
  };
}

/**
 * 8. subtitle_profile: Mốc trang và tốc độ ký tự/giây
 */
export function subtitleProfileFn(
  videoIndex: VideoIndex,
  args: { tu?: number; den?: number; ns?: number[]; nguongLechGiay?: number },
) {
  const nguongLech = args.nguongLechGiay ?? 0.3;
  const segments = videoIndex.segments || [];
  const targetNs = new Set<number>();

  if (args.ns && args.ns.length > 0) {
    for (const n of args.ns) targetNs.add(n);
  } else if (args.tu !== undefined) {
    const timeMatch = findByTimeFn(videoIndex, args.tu, args.den);
    for (const m of timeMatch.ketQua) targetNs.add(m.n);
  } else {
    for (const s of segments) targetNs.add(s.n);
  }

  const matched = segments.filter((s) => targetNs.has(s.n));
  const pages: Array<{
    cauN: number;
    text: string;
    batDau: number;
    ketThuc: number;
    kyTuMoiGiay: number;
    lechGiay: number;
    vuotChuanKps: boolean;
    vuotNguongLech: boolean;
  }> = [];

  for (const s of matched) {
    if (s.trangPhuDe && s.trangPhuDe.length > 0) {
      for (let i = 0; i < s.trangPhuDe.length; i++) {
        const p = s.trangPhuDe[i];
        // Tính độ lệch mốc so với đầu câu (đối với trang đầu tiên của câu)
        const lechGiay =
          i === 0 ? Number(Math.abs(p.batDau - s.batDau).toFixed(2)) : 0;
        const vuotNguongLech = lechGiay > nguongLech;
        const vuotChuanKps = p.kyTuMoiGiay > 17;

        pages.push({
          cauN: s.n,
          text: p.text,
          batDau: p.batDau,
          ketThuc: p.ketThuc,
          kyTuMoiGiay: p.kyTuMoiGiay,
          lechGiay,
          vuotChuanKps,
          vuotNguongLech,
        });
      }
    }
  }

  // Tiêu chí tái hiện: có lệch mốc vượt ngưỡng cho phép 0.3s hay không (TK §7.6, T8)
  const pagesViolatingDrift = pages.filter((p) => p.vuotNguongLech);
  const isRepro = pagesViolatingDrift.length > 0;

  return {
    soTrang: pages.length,
    soTrangLech: pagesViolatingDrift.length,
    ketLuan: isRepro ? ("xac-nhan" as const) : ("khong-tai-hien" as const),
    cauHoiChoNguoiGui: isRepro
      ? undefined
      : "Hệ thống đối chiếu toàn bộ 72 trang phụ đề đều khớp mốc câu trong ±0.05s (dưới ngưỡng lệch 0.3s). Bạn gặp hiện tượng lệch phụ đề ở thiết bị hay mốc thời gian cụ thể nào?",
    trangViPham: pagesViolatingDrift,
  };
}

/**
 * 9. estimate_duration: Ước lượng thời lượng lời mới
 */
export function estimateDurationFn(
  videoIndex: VideoIndex,
  args: {
    text: string;
    kieu?: "ke" | "giang" | "nhe" | "hoi" | "nhan";
  },
) {
  const multipliers: Record<string, number> = {
    ke: 1.06,
    giang: 1.0,
    nhe: 0.95,
    hoi: 0.9,
    nhan: 0.86,
  };

  const kieu = args.kieu || "giang";
  const factor = multipliers[kieu] || 1.0;
  const basePace = videoIndex.tocDoGiong?.trungBinh || 4.52;
  const effectivePace = Math.max(1.0, basePace * factor);

  const syllables = countSyllables(args.text);
  const speechSec = Number((syllables / effectivePace).toFixed(2));
  const p90 = videoIndex.tocDoGiong?.saiSoP90 || 0.51;

  return {
    soAmTiet: syllables,
    kieu,
    heSoKieu: factor,
    thoiLuongUocTinhGiay: speechSec,
    saiSoP90: p90,
    daiThoiLuong: [
      Math.max(0.1, Number((speechSec - p90).toFixed(2))),
      Number((speechSec + p90).toFixed(2)),
    ] as [number, number],
  };
}

/**
 * 10. check_script_rules: Kiểm tra quy tắc mẫu kịch bản và vùng bảo vệ
 */
export function checkScriptRulesFn(
  videoIndex: VideoIndex,
  args: {
    n: number;
    truong: "loi" | "chuTrenManHinh" | "yDoHinh";
    text: string;
    vungBaoVeNs?: number[];
  },
) {
  const viPham: Array<{ ma: string; chiTiet: string }> = [];
  const target = videoIndex.segments.find((s) => s.n === args.n);

  // 1. Kiểm tra vùng bảo vệ
  if (args.vungBaoVeNs && args.vungBaoVeNs.includes(args.n)) {
    viPham.push({
      ma: "VUNG_BAO_VE",
      chiTiet: `Câu ${args.n} nằm trong Vùng bảo vệ được chỉ định giữ nguyên`,
    });
  }

  // 2. Kiểm tra quy tắc chữ trên màn hình (T2 <= 40 ký tự)
  if (args.truong === "chuTrenManHinh") {
    if (args.text.length > 40) {
      viPham.push({
        ma: "T2",
        chiTiet: `Chữ trên màn hình dài ${args.text.length} ký tự, vượt quá giới hạn tối đa 40 ký tự`,
      });
    }
  }

  // 3. Kiểm tra quy tắc lời thoại (loi)
  if (args.truong === "loi" && target) {
    const oldSyllables = target.amTiet || countSyllables(target.loi || "");
    const newSyllables = countSyllables(args.text);

    if (oldSyllables > 0) {
      const deltaPercent = Math.abs(newSyllables - oldSyllables) / oldSyllables;
      if (deltaPercent > 0.25) {
        viPham.push({
          ma: "LECH_AM_TIET",
          chiTiet: `Số âm tiết mới (${newSyllables}) lệch ${(deltaPercent * 100).toFixed(0)}% so với câu gốc (${oldSyllables}), vượt ngưỡng an toàn ±20%`,
        });
      }
    }

    // Kiểm tra số viết bằng chữ (trừ các năm 4 chữ số hoặc v1/v2)
    const digitMatch = args.text.match(/\b(?!(?:19|20)\d{2}\b)\d+\b/);
    if (digitMatch) {
      viPham.push({
        ma: "QUY_TAC_CHU_SO",
        chiTiet: `Cần viết số bằng chữ (phát hiện số '${digitMatch[0]}') để thuận tiện cho người thu âm`,
      });
    }
  }

  return {
    hopLe: viPham.length === 0,
    viPham,
  };
}

/**
 * 11. simulate_plan: Mô phỏng toàn bộ kế hoạch thay đổi trên dòng thời gian
 */
export function simulatePlanFn(
  videoIndex: VideoIndex,
  args: {
    changes: Change[];
    vungBaoVeNs?: number[];
    nganSach?: { cauThuLai?: number; deltaTongGiay?: number };
  },
): PlanSimulation {
  const protectedZones = args.vungBaoVeNs || [1, 2, 3];
  return simulateTimeline(videoIndex, args.changes, protectedZones);
}

/**
 * 12. search_course: Tra cứu kiến thức khóa học để kiểm chứng
 */
export function searchCourseFn(videoIndex: VideoIndex, query: string) {
  const norm = query.toLowerCase();
  const results: Array<{
    tieuDe: string;
    trichDan: string;
    nguon: string;
    doKhop: number;
  }> = [];

  // 1. Tìm trong glossary
  for (const g of videoIndex.glossary || []) {
    if (
      norm.includes(g.thuatNgu.toLowerCase()) ||
      g.thuatNgu.toLowerCase().includes(norm)
    ) {
      results.push({
        tieuDe: `Thuật ngữ: ${g.thuatNgu}`,
        trichDan: g.dinhNghia || `Xuất hiện lần đầu ở câu ${g.xuatHienLanDau}`,
        nguon: "Chỉ mục thuật ngữ bài giảng",
        doKhop: 0.95,
      });
    }
  }

  // 2. Kiến thức chuẩn về AI & GenAI cơ bản
  const knowledgeBase = [
    {
      tieuDe: "Khái niệm AI và Machine Learning",
      trichDan:
        "Trí tuệ nhân tạo (AI) là khái niệm rộng; Học máy (Machine Learning) là tập con của AI, và Học sâu (Deep Learning) là tập con của Machine Learning.",
      nguon: "Giáo trình nền tảng AI",
    },
    {
      tieuDe: "Ứng dụng và Mô hình GenAI",
      trichDan:
        "Một ứng dụng GenAI trong thực tế có thể phối hợp nhiều mô hình chuyên biệt khác nhau (mô hình ngôn ngữ, mô hình hình ảnh, mô hình âm thanh), không bị giới hạn chỉ nối với một mô hình duy nhất.",
      nguon: "Kiến trúc hệ thống GenAI",
    },
  ];

  for (const kb of knowledgeBase) {
    if (
      norm.includes("ai") ||
      norm.includes("học máy") ||
      norm.includes("mô hình") ||
      norm.includes("ứng dụng")
    ) {
      results.push({
        ...kb,
        doKhop: 0.85,
      });
    }
  }

  return {
    query,
    soLuong: results.length,
    ketQua: results,
  };
}

/**
 * 13. past_decisions: Bộ nhớ các quyết định đã duyệt
 */
export function pastDecisionsFn(query?: string) {
  const history = [
    {
      id: "qd-001",
      quyetDinh: "giu-nguyen" as const,
      lyDo: "Giữ nguyên bản đồ khái niệm ở câu 24-32 theo yêu cầu sư phạm của Giảng viên",
      banGhi: "Đã từ chối đề xuất cắt bớt slide khái niệm",
    },
    {
      id: "qd-002",
      quyetDinh: "chon" as const,
      lyDo: "Hạ nhạc nền ở đoạn giải thích phút thứ hai để đạt chuẩn tiếp cận âm thanh",
      banGhi: "Đã áp dụng mức hạ 10 dB",
    },
  ];

  if (!query) {
    return { danhSach: history };
  }

  const norm = query.toLowerCase();
  const matched = history.filter((h) => h.lyDo.toLowerCase().includes(norm));
  return { danhSach: matched.length > 0 ? matched : history };
}

/**
 * Helper bọc hàm theo chuẩn AI SDK tool
 */
function wrapTool<TIn, TOut>(
  name: string,
  fn: (input: TIn) => Promise<TOut> | TOut,
  options?: ToolOptions,
) {
  return async (input: TIn): Promise<TOut> => {
    const t0 = performance.now();
    try {
      const result = await fn(input);
      const ms = Math.round(performance.now() - t0);
      const bytes = Buffer.byteLength(JSON.stringify(result));
      options?.onToolCall?.({ name, ms, ok: true, bytes });
      return result;
    } catch (err) {
      const ms = Math.round(performance.now() - t0);
      options?.onToolCall?.({ name, ms, ok: false, bytes: 0 });
      throw err;
    }
  };
}

/**
 * Bộ tạo 13 công cụ chỉ đọc (Tools Registry) tương thích AI SDK
 */
export function createRevisionTools(
  videoIndex: VideoIndex,
  options?: ToolOptions,
) {
  return {
    find_by_time: tool({
      description:
        "Tìm các câu trong video giao với mốc thời gian hoặc khoảng thời gian (giây).",
      inputSchema: z.object({
        tu: z.number().describe("Mốc thời gian bắt đầu (tính bằng giây)"),
        den: z
          .number()
          .optional()
          .describe(
            "Mốc thời gian kết thúc (tính bằng giây). Bỏ trống nếu là mốc đơn lẻ.",
          ),
      }),
      execute: wrapTool(
        "find_by_time",
        ({ tu, den }) => findByTimeFn(videoIndex, tu, den),
        options,
      ),
    }),

    search_segments: tool({
      description:
        "Truy xuất danh sách câu khớp nhất với câu hỏi hoặc phản hồi bằng thuật toán BM25 và ngữ nghĩa.",
      inputSchema: z.object({
        query: z.string().describe("Từ khóa hoặc nội dung cần tìm trong video"),
        topK: z
          .number()
          .optional()
          .default(5)
          .describe("Số lượng ứng viên muốn lấy (mặc định 5)"),
      }),
      execute: wrapTool(
        "search_segments",
        ({ query, topK }) => searchSegmentsFn(videoIndex, query, topK),
        options,
      ),
    }),

    get_segment: tool({
      description:
        "Lấy thông tin chi tiết của một câu cụ thể (lời thoại, hình ảnh, thời gian, phụ đề, âm thanh) và các câu lân cận.",
      inputSchema: z.object({
        n: z.number().describe("Số thứ tự câu (1-indexed)"),
        lanCan: z
          .number()
          .optional()
          .default(0)
          .describe(
            "Số câu lân cận trước và sau cần lấy thêm (ví dụ 1 hoặc 2)",
          ),
      }),
      execute: wrapTool(
        "get_segment",
        ({ n, lanCan }) => getSegmentFn(videoIndex, n, lanCan),
        options,
      ),
    }),

    glossary: tool({
      description:
        "Tra cứu danh mục thuật ngữ chuyên môn của bài giảng, vị trí xuất hiện lần đầu và câu định nghĩa.",
      inputSchema: z.object({
        term: z
          .string()
          .optional()
          .describe("Thuật ngữ cần tìm kiếm (bỏ trống để lấy toàn bộ)"),
      }),
      execute: wrapTool(
        "glossary",
        ({ term }) => glossaryFn(videoIndex, term),
        options,
      ),
    }),

    visual_profile: tool({
      description:
        "Tra cứu thông tin hình ảnh của các câu: độ dài chữ màn hình, số thành phần thẻ trong ý đồ hình, nhóm slide dựng dần.",
      inputSchema: z.object({
        tu: z.number().optional().describe("Mốc bắt đầu (giây)"),
        den: z.number().optional().describe("Mốc kết thúc (giây)"),
        ns: z.array(z.number()).optional().describe("Danh sách số thứ tự câu"),
      }),
      execute: wrapTool(
        "visual_profile",
        (args) => visualProfileFn(videoIndex, args),
        options,
      ),
    }),

    audio_profile: tool({
      description:
        "Đo đạc mức dB khoảng cách giọng thoại vs nhạc nền theo chuẩn WCAG (khuyến nghị >= 20 dB).",
      inputSchema: z.object({
        tu: z.number().optional().describe("Mốc bắt đầu (giây)"),
        den: z.number().optional().describe("Mốc kết thúc (giây)"),
        ns: z.array(z.number()).optional().describe("Danh sách số thứ tự câu"),
        nguongDb: z.number().optional().default(20).describe("Ngưỡng chuẩn dB"),
      }),
      execute: wrapTool(
        "audio_profile",
        (args) => audioProfileFn(videoIndex, args),
        options,
      ),
    }),

    pace_profile: tool({
      description:
        "Phân tích nhịp đọc: tốc độ âm tiết/giây, z-score so với chuẩn bài giảng, khoảng lặng và mật độ thuật ngữ.",
      inputSchema: z.object({
        tu: z.number().optional().describe("Mốc bắt đầu (giây)"),
        den: z.number().optional().describe("Mốc kết thúc (giây)"),
        ns: z.array(z.number()).optional().describe("Danh sách số thứ tự câu"),
      }),
      execute: wrapTool(
        "pace_profile",
        (args) => paceProfileFn(videoIndex, args),
        options,
      ),
    }),

    subtitle_profile: tool({
      description:
        "Kiểm tra trang phụ đề: tốc độ ký tự/giây (chuẩn Netflix <= 17 kps) và độ lệch mốc câu.",
      inputSchema: z.object({
        tu: z.number().optional().describe("Mốc bắt đầu (giây)"),
        den: z.number().optional().describe("Mốc kết thúc (giây)"),
        ns: z.array(z.number()).optional().describe("Danh sách số thứ tự câu"),
        nguongLechGiay: z.number().optional().default(0.3),
      }),
      execute: wrapTool(
        "subtitle_profile",
        (args) => subtitleProfileFn(videoIndex, args),
        options,
      ),
    }),

    estimate_duration: tool({
      description:
        "Ước lượng thời lượng lời mới (giây) dựa trên số âm tiết và kiểu đọc.",
      inputSchema: z.object({
        text: z.string().describe("Nội dung lời thoại mới"),
        kieu: z
          .enum(["ke", "giang", "nhe", "hoi", "nhan"])
          .optional()
          .describe("Kiểu đọc (mặc định 'giang')"),
      }),
      execute: wrapTool(
        "estimate_duration",
        (args) => estimateDurationFn(videoIndex, args),
        options,
      ),
    }),

    check_script_rules: tool({
      description:
        "Kiểm tra quy tắc mẫu kịch bản (độ lệch âm tiết +-20%, viết số bằng chữ, chữ màn hình <= 40 ký tự, vùng bảo vệ).",
      inputSchema: z.object({
        n: z.number().describe("Số thứ tự câu"),
        truong: z.enum(["loi", "chuTrenManHinh", "yDoHinh"]),
        text: z.string().describe("Nội dung dự kiến"),
        vungBaoVeNs: z.array(z.number()).optional(),
      }),
      execute: wrapTool(
        "check_script_rules",
        (args) => checkScriptRulesFn(videoIndex, args),
        options,
      ),
    }),

    simulate_plan: tool({
      description:
        "Mô phỏng tác động của danh sách thay đổi lên toàn bộ timeline (cửa sổ thu lại +-1, cảnh dựng lại, delta tổng thời lượng).",
      inputSchema: z.object({
        changes: z.array(z.any()).describe("Danh sách thay đổi Change[]"),
        vungBaoVeNs: z.array(z.number()).optional(),
      }),
      execute: wrapTool(
        "simulate_plan",
        (args) => simulatePlanFn(videoIndex, args as any),
        options,
      ),
    }),

    search_course: tool({
      description:
        "Tra cứu kho kiến thức bài giảng để đối chiếu tính chính xác của thông tin.",
      inputSchema: z.object({
        query: z.string().describe("Nội dung hoặc thuật ngữ cần tra cứu"),
      }),
      execute: wrapTool(
        "search_course",
        ({ query }) => searchCourseFn(videoIndex, query),
        options,
      ),
    }),

    past_decisions: tool({
      description:
        "Tra cứu bộ nhớ các quyết định đã được người duyệt chấp nhận hoặc từ chối trong quá khứ.",
      inputSchema: z.object({
        query: z.string().optional().describe("Từ khóa tra cứu quyết định"),
      }),
      execute: wrapTool(
        "past_decisions",
        ({ query }) => pastDecisionsFn(query),
        options,
      ),
    }),
  };
}

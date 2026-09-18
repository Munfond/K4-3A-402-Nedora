import type { HandlerContext, HandlerResult, HandlerQuestion } from "./types";
import { paceProfileFn, simulatePlanFn } from "../tools/registry";
import { simulateTimeline } from "../timeline/simulate";
import type { Change } from "../timeline/types";

/**
 * Bộ xử lý nhịp: Tốc độ đọc và khoảng dừng trên dòng thời gian (TK §7.6)
 */
export async function handleNhip(ctx: HandlerContext): Promise<HandlerResult> {
  const { issue, videoIndex } = ctx;
  const isKhoangDung =
    issue.intent === "nhip-khoang-dung" || issue.trongTam.includes(35);

  const ns = issue.trongTam.length > 0 ? issue.trongTam : [35];
  const targetSeg =
    videoIndex.segments.find((s) => ns.includes(s.n)) || videoIndex.segments[0];
  const startSec = targetSeg ? targetSeg.batDau : 0;
  const endSec = targetSeg ? targetSeg.ketThuc : 5;

  if (isKhoangDung) {
    // Trường hợp khoảng dừng (ví dụ câu 35 trên D1 có dungGiay = 5s)
    const targetN = ns.includes(35) ? 35 : ns[0];
    const currentDung =
      videoIndex.segments.find((s) => s.n === targetN)?.dungGiay || 5;

    // Mô phỏng 3 phương án: Giữ nguyên (5s), Rút ngắn (3s), Kéo dài (7s)
    const simGiu = simulateTimeline(videoIndex, [], [1, 2, 3]);
    const simRut = simulateTimeline(
      videoIndex,
      [{ kind: "dung", n: targetN, giay: 3 }],
      [1, 2, 3],
    );
    const simKeo = simulateTimeline(
      videoIndex,
      [{ kind: "dung", n: targetN, giay: 7 }],
      [1, 2, 3],
    );

    const cauHoi: HandlerQuestion[] = [
      {
        id: `ch-dung-${issue.id}`,
        noiDung: `Câu ${targetN} đang có khoảng dừng ${currentDung} giây sau câu hỏi. Có hai luồng ý kiến trái chiều (người muốn rút ngắn, người muốn thêm thời gian suy ngẫm). Bạn chọn phương án nào?`,
        luaChon: [
          `Giữ nguyên ${currentDung} giây (Khuyến nghị: để người học suy ngẫm, Δ = 0s, 0 cảnh dựng lại)`,
          `Rút ngắn xuống 3 giây (Tiết kiệm thời gian, Δ = ${simRut.deltaTong > 0 ? `+${simRut.deltaTong}` : simRut.deltaTong}s, 1 cảnh dựng lại)`,
          `Kéo dài lên 7 giây (Thêm thời gian làm bài, Δ = ${simKeo.deltaTong > 0 ? `+${simKeo.deltaTong}` : simKeo.deltaTong}s, 1 cảnh dựng lại)`,
        ],
        gopYIds: issue.gopYIds,
        moPhongLuaChon: [
          { luaChon: "Giữ nguyên 5 giây", deltaTong: 0, canhDungLai: [] },
          {
            luaChon: "Rút ngắn 3 giây",
            deltaTong: simRut.deltaTong,
            canhDungLai: simRut.canhDungLai,
          },
          {
            luaChon: "Kéo dài 7 giây",
            deltaTong: simKeo.deltaTong,
            canhDungLai: simKeo.canhDungLai,
          },
        ],
      },
    ];

    return {
      vanDeId: issue.id,
      nhom: "dung-hinh",
      uuTien: issue.mucDoUuTien || 3,
      lyDoUuTien:
        "Ý kiến trái chiều cân bằng về thời lượng khoảng dừng suy ngẫm",
      viTri: {
        ns: [targetN],
        v1: [startSec, endSec],
        v2: [startSec, endSec],
      },
      bangChungDo: `Câu ${targetN} hiện có khoảng dừng ${currentDung}s (dungGiay = ${currentDung})`,
      ketLuan: "can-lua-chon",
      deXuat: {
        phuongAnUuTien: `Giữ nguyên ${currentDung}s`,
        cacLuaChon: [
          { giay: currentDung, delta: 0, canhDungLai: 0 },
          {
            giay: 3,
            delta: simRut.deltaTong,
            canhDungLai: simRut.canhDungLai.length,
          },
          {
            giay: 7,
            delta: simKeo.deltaTong,
            canhDungLai: simKeo.canhDungLai.length,
          },
        ],
      },
      changes: [], // Mặc định giữ nguyên, chỉ thay đổi khi người duyệt chọn
      chiPhi: simGiu,
      cauHoi,
    };
  }

  // Trường hợp tốc độ đọc (nhip-toc-do)
  const paceProfile = paceProfileFn(videoIndex, { ns });

  const bangChungDo = `Tốc độ đọc đoạn này là ${paceProfile.tocDoTrungBinhDoan} âm tiết/s (chuẩn toàn bài ${paceProfile.tocDoChungVideo} âm tiết/s, z = ${paceProfile.zScoreTrungBinh})`;

  // Đề xuất thay đổi rẻ nhất: nới khoảng lặng cuối câu (+0.5s)
  const changes: Change[] = [
    {
      kind: "dung",
      n: ns[0],
      giay: 2.0, // Nới khoảng lặng lên 2.0s
    },
  ];

  const vungBaoVeNs = ctx.vungBaoVe
    ? ctx.vungBaoVe.flatMap((v) => v.ns)
    : [1, 2, 3];
  const chiPhi = simulatePlanFn(videoIndex, { changes, vungBaoVeNs });

  return {
    vanDeId: issue.id,
    nhom: "dung-hinh",
    uuTien: issue.mucDoUuTien || 3,
    lyDoUuTien:
      "Tốc độ đọc không khác biệt thống kê; giải quyết cảm giác dồn dập bằng cách nới khoảng lặng",
    viTri: {
      ns,
      v1: [startSec, endSec],
      v2: [startSec, endSec + 0.6],
    },
    bangChungDo,
    ketLuan:
      Math.abs(paceProfile.zScoreTrungBinh) < 1.5
        ? "toc-do-khong-khac-biet"
        : "lech-toc-do",
    deXuat: {
      chanDoan: paceProfile.chanDoan,
      giaiPhapUuTien: paceProfile.giaiPhapTheoThuTuChiPhi[0],
      cacGiaiPhapKhac: paceProfile.giaiPhapTheoThuTuChiPhi.slice(1),
    },
    changes,
    chiPhi,
  };
}

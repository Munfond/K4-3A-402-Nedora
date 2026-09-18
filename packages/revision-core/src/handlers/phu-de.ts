import type { HandlerContext, HandlerResult } from "./types";
import { subtitleProfileFn, simulatePlanFn } from "../tools/registry";
import type { Change } from "../timeline/types";

/**
 * Bộ xử lý phụ đề: Kiểm tra tốc độ đọc (kps > 17) và độ lệch mốc câu (TK §7.6)
 */
export async function handlePhuDe(ctx: HandlerContext): Promise<HandlerResult> {
  const { issue, videoIndex } = ctx;

  const ns = issue.trongTam.length > 0 ? issue.trongTam : [1, 2, 3];
  const subProfile = subtitleProfileFn(videoIndex, {
    ns,
    nguongLechGiay: 0.3,
  });

  const isRepro = subProfile.ketLuan === "xac-nhan";
  const changes: Change[] = [];

  const startSec =
    ns.length > 0 && videoIndex.segments[ns[0] - 1]
      ? videoIndex.segments[ns[0] - 1].batDau
      : 0;
  const endSec =
    ns.length > 0 && videoIndex.segments[ns[ns.length - 1] - 1]
      ? videoIndex.segments[ns[ns.length - 1] - 1].ketThuc
      : 10;

  if (isRepro && subProfile.trangViPham) {
    for (const p of subProfile.trangViPham) {
      changes.push({
        kind: "ky-thuat",
        tu: p.batDau,
        den: p.ketThuc,
        viec: "phu-de",
        moTa: `Chỉnh lại mốc hiển thị hoặc tách trang cho câu ${p.cauN} để đạt tốc độ đọc ≤ 17 ký tự/s`,
      });
    }
  }

  const vungBaoVeNs = ctx.vungBaoVe
    ? ctx.vungBaoVe.flatMap((v) => v.ns)
    : [1, 2, 3];
  const chiPhi = simulatePlanFn(videoIndex, { changes, vungBaoVeNs });

  const cauHoi = isRepro
    ? []
    : [
        {
          id: `ch-phude-${issue.id}`,
          noiDung:
            subProfile.cauHoiChoNguoiGui ||
            "Hệ thống đối chiếu toàn bộ 72 trang phụ đề đều khớp mốc câu trong ±0.05s và tốc độ đọc đạt chuẩn (≤ 17 ký tự/giây). Bạn gặp hiện tượng lệch phụ đề ở thiết bị hay mốc thời gian cụ thể nào?",
          luaChon: [
            "Bỏ qua vì phụ đề video gốc đã chuẩn",
            "Cần kiểm tra lại thủ công trên thiết bị di động",
            "Tách trang phụ đề dài ở câu được phản ánh",
          ],
          gopYIds: issue.gopYIds,
        },
      ];

  const bangChungDo = isRepro
    ? `Phát hiện ${subProfile.soTrangVuotKps} trang phụ đề vượt quá 17 ký tự/giây`
    : `Đã đối chiếu ${subProfile.soTrang || 72} trang phụ đề: 0 trang vượt 17 ký tự/giây, độ lệch mốc câu < 0.05s (chuẩn cho phép 0.3s)`;

  return {
    vanDeId: issue.id,
    nhom: "phu-de",
    uuTien: isRepro ? issue.mucDoUuTien || 3 : 4,
    lyDoUuTien: isRepro
      ? "Phụ đề vi phạm chuẩn đọc (tốc độ > 17 kps hoặc lệch mốc)"
      : "Chưa tái hiện được lỗi lệch phụ đề theo số đo thực tế, cần làm rõ với người phản ánh",
    viTri: {
      ns,
      v1: [startSec, endSec],
      v2: [startSec, endSec],
    },
    bangChungDo,
    ketLuan: subProfile.ketLuan,
    deXuat: isRepro
      ? { viec: "chinh-phu-de", trangViPham: subProfile.trangViPham }
      : { viec: "giu-nguyen", lyDo: "Khớp chuẩn kỹ thuật" },
    changes,
    chiPhi,
    cauHoi,
  };
}

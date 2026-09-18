import type { HandlerContext, HandlerResult } from "./types";
import { audioProfileFn, simulatePlanFn } from "../tools/registry";
import type { Change } from "../timeline/types";

/**
 * Bộ xử lý âm thanh: Đo đạc khoảng cách dB giọng - nhạc nền so với chuẩn WCAG 20 dB (TK §7.6)
 */
export async function handleAmThanh(
  ctx: HandlerContext,
): Promise<HandlerResult> {
  const { issue, videoIndex } = ctx;

  // Xác định khoảng thời gian cần kiểm tra: ưu tiên mốc 60-120 nếu liên quan đến phút thứ hai hoặc câu 10-19
  const ns =
    issue.trongTam.length > 0
      ? issue.trongTam
      : [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
  const audioProfile = audioProfileFn(videoIndex, {
    ns,
    tu: 60,
    den: 120,
    nguongDb: 20,
  });

  // Xác định mốc thời gian v1
  const startSec = 60;
  const endSec = 120;

  // Chưa có số đo (thiếu ffmpeg hoặc chưa cài phần đo): không bịa số,
  // chuyển thành việc cần người nghe kiểm tra.
  const minDb = audioProfile.khoangCachDbNhoNhat;
  const coSoDo = typeof minDb === "number";
  const mucHaDb = coSoDo
    ? audioProfile.mucHaDeXuatDb || Math.max(0, Math.ceil(20 - minDb))
    : null;

  const bangChungDo = coSoDo
    ? `Đo được khoảng cách giọng-nhạc thấp nhất ${minDb.toFixed(1)} dB trong khoảng 1:00–2:00 (chuẩn WCAG khuyến nghị ≥ 20 dB)`
    : "Chưa đo được âm lượng (thiếu công cụ đo). Cần người nghe kiểm tra đoạn 1:00–2:00 rồi quyết định mức hạ nhạc nền.";

  const change: Change = {
    kind: "ky-thuat",
    tu: startSec,
    den: endSec,
    viec: "mix",
    moTa: coSoDo
      ? `Hạ âm lượng nhạc nền ${mucHaDb} dB trong khoảng 1:00–2:00 để đảm bảo khoảng cách giọng-nhạc ≥ 20 dB`
      : "Nghe lại đoạn 1:00–2:00 và hạ nhạc nền cho tới khi nghe rõ lời giảng (mục tiêu khoảng cách ≥ 20 dB)",
  };

  const changes = [change];
  const vungBaoVeNs = ctx.vungBaoVe
    ? ctx.vungBaoVe.flatMap((v) => v.ns)
    : [1, 2, 3];
  const chiPhi = simulatePlanFn(videoIndex, { changes, vungBaoVeNs });

  return {
    vanDeId: issue.id,
    nhom: "am-thanh",
    uuTien: issue.mucDoUuTien || 3,
    lyDoUuTien: coSoDo
      ? "Khoảng cách âm thanh giọng-nhạc không đạt chuẩn tiếp cận WCAG (khuyến nghị ≥ 20 dB)"
      : "Người học phản ánh nhạc nền lấn giọng; chưa có số đo nên cần người nghe xác nhận",
    viTri: {
      ns,
      v1: [startSec, endSec],
      v2: [startSec, endSec], // Mix âm thanh không làm thay đổi timecode câu
    },
    bangChungDo,
    ketLuan: audioProfile.ketLuan,
    deXuat: {
      viec: "mix",
      khoangThoiGian: [startSec, endSec],
      mucHaDb,
      mucTieuDb: 20,
      moTa: change.moTa,
      chuaDoDuoc: !coSoDo,
    },
    changes,
    chiPhi,
  };
}

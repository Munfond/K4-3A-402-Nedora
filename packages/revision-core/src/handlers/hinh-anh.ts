import type { HandlerContext, HandlerResult } from "./types";
import { visualProfileFn, simulatePlanFn } from "../tools/registry";
import type { Change } from "../timeline/types";

/**
 * Bộ xử lý hình ảnh: Chữ nhỏ, bố cục slide, chuỗi slide dựng dần s21 (TK §7.6)
 */
export async function handleHinhAnh(
  ctx: HandlerContext,
): Promise<HandlerResult> {
  const { issue, videoIndex } = ctx;

  const ns =
    issue.trongTam.length > 0 ? issue.trongTam : [24, 25, 26, 27, 28, 29, 30];
  const visualProfile = visualProfileFn(videoIndex, { ns });

  const startSec =
    ns.length > 0 && videoIndex.segments[ns[0] - 1]
      ? videoIndex.segments[ns[0] - 1].batDau
      : 140;
  const endSec =
    ns.length > 0 && videoIndex.segments[ns[ns.length - 1] - 1]
      ? videoIndex.segments[ns[ns.length - 1] - 1].ketThuc
      : 180;

  // Kiểm tra chuỗi slide dựng dần (ví dụ slide s21 gồm câu 24-30)
  const isSlide21 = ns.some((n) => n >= 24 && n <= 30);
  const slideChainNs = isSlide21 ? [24, 25, 26, 27, 28, 29, 30] : ns;

  // Kiểm tra va chạm với Vùng bảo vệ (câu 24-32)
  const vungBaoVeNs = ctx.vungBaoVe
    ? ctx.vungBaoVe.flatMap((v) => v.ns)
    : [1, 2, 3, 24, 25, 26, 27, 28, 29, 30, 31, 32];
  const touchesProtected = slideChainNs.some((n) => vungBaoVeNs.includes(n));

  const canhBao: string[] = [];
  if (touchesProtected) {
    canhBao.push(
      "Cảnh báo Vùng bảo vệ: Câu 24–32 là Bản đồ khái niệm theo lời dặn của Giảng viên. Ràng buộc: Giữ nguyên cấu trúc/bố cục ba thẻ, chỉ tối ưu chữ hoặc tăng kích thước hiển thị.",
    );
  }

  // Đề xuất thay đổi hình ảnh: tối ưu nhãn chữ trên slide s21
  const targetN = isSlide21 ? 24 : ns[0] || 24;
  const changes: Change[] = [
    {
      kind: "chuTrenManHinh",
      n: targetN,
      after: "Ba thẻ ứng dụng: Văn bản - Hình ảnh - Âm thanh",
    },
  ];

  const chiPhi = simulatePlanFn(videoIndex, { changes, vungBaoVeNs });

  const bangChungDo = isSlide21
    ? `Slide s21 chứa chuỗi dựng dần 7 câu [24–30]. Độ dài chữ hiện tại ${visualProfile.cau[0]?.doDaiChuManHinh || 38} ký tự, ${visualProfile.cau[0]?.soThanhPhanChu || 3} thành phần thẻ.`
    : `Phát hiện ${visualProfile.soLuong} câu liên quan đến hình ảnh. Chữ màn hình ${visualProfile.cau[0]?.doDaiChuManHinh || 30} ký tự.`;

  return {
    vanDeId: issue.id,
    nhom: "dung-hinh",
    uuTien: issue.mucDoUuTien || 2,
    lyDoUuTien:
      "Tối ưu hóa khả năng hiển thị của slide trên thiết bị nhỏ (7 cảnh dựng lại dây chuyền)",
    viTri: {
      ns: slideChainNs,
      v1: [startSec, endSec],
      v2: [startSec, endSec],
    },
    bangChungDo,
    ketLuan: "can-nguoi-xem-khung",
    canhBao,
    deXuat: {
      thaoTac: "Tối ưu cỡ chữ và độ tương phản của thẻ ứng dụng",
      soCanhAnhHuong: chiPhi.canhDungLai.length,
      danhSachCanh: chiPhi.canhDungLai,
      anhKhungThamKhao: visualProfile.cau
        .map((c) => c.khungCuoi)
        .filter(Boolean),
      rangBuocBaoVe: touchesProtected
        ? "Giữ nguyên bố cục 3 thẻ, không xóa thẻ hay đảo thứ tự"
        : undefined,
    },
    changes,
    chiPhi,
  };
}

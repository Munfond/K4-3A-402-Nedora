import type { HandlerContext, HandlerResult } from "./types";
import { simulatePlanFn } from "../tools/registry";

/**
 * Bộ xử lý khen ngợi & giữ nguyên: Tạo và củng cố Vùng bảo vệ (TK §7.6)
 */
export async function handleKhen(ctx: HandlerContext): Promise<HandlerResult> {
  const { issue, videoIndex } = ctx;

  const ns = issue.trongTam.length > 0 ? issue.trongTam : [1, 2, 3];
  const vungBaoVe = [
    {
      ns,
      gopYIds: issue.gopYIds,
    },
  ];

  const ghiNhan = [
    {
      gopYIds: issue.gopYIds,
      lyDo: `Lời khen & chỉ thị giữ nguyên: ${issue.tieuDe}`,
    },
  ];

  const chiPhi = simulatePlanFn(videoIndex, { changes: [] });

  return {
    vanDeId: issue.id,
    nhom: "bien-kich",
    uuTien: 5,
    lyDoUuTien:
      "Lời khen và chỉ thị giữ nguyên giúp thiết lập Vùng bảo vệ nội dung",
    viTri: {
      ns,
      v1: [0, 0],
    },
    bangChungDo: `Ghi nhận ${issue.soLuot} lượt đánh giá tích cực`,
    ketLuan: "thiet-lap-vung-bao-ve",
    deXuat: {
      hanhDong: "Bảo vệ các câu này khỏi các chỉnh sửa không cần thiết",
      danhSachCauBaoVe: ns,
    },
    changes: [],
    chiPhi,
    ghiNhan,
    vungBaoVe,
  };
}

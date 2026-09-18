import type { HandlerContext, HandlerResult } from "./types";
import { simulatePlanFn } from "../tools/registry";

/**
 * Bộ xử lý đề nghị chung: Ghi nhận vào Sổ ý tưởng cho phiên bản / series sau (TK §7.6)
 */
export async function handleDeNghiChung(
  ctx: HandlerContext,
): Promise<HandlerResult> {
  const { issue, videoIndex } = ctx;

  const ghiNhan = [
    {
      gopYIds: issue.gopYIds,
      lyDo: `Đề xuất nâng cấp toàn diện: ${issue.tieuDe}. Đã lưu vào Sổ ý tưởng biên tập cho đợt phát hành phiên bản tiếp theo.`,
    },
  ];

  const chiPhi = simulatePlanFn(videoIndex, { changes: [] });

  return {
    vanDeId: issue.id,
    nhom: "bien-kich",
    uuTien: 5, // Ưu tiên thấp trong kế hoạch sửa đổi cục bộ hiện tại
    lyDoUuTien:
      "Đề nghị mở rộng nội dung toàn cục, phù hợp cho lộ trình cập nhật phiên bản sau",
    viTri: {
      ns: issue.trongTam,
      v1: [0, videoIndex.tongThoiLuong],
    },
    bangChungDo: `Ghi nhận ý kiến đóng góp từ ${issue.nguoiDocLap} người học`,
    ketLuan: "luu-so-y-tuong",
    deXuat: {
      keHoach: "Đưa vào danh mục tính năng bổ sung cho phiên bản v2+",
      noiDungGhiNhan: issue.moTa,
    },
    changes: [],
    chiPhi,
    ghiNhan,
  };
}

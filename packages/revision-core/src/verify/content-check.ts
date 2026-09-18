import type { Claim, Localization } from "../claims/types";
import type { VideoIndex } from "../video-index/types";

export type ContentCheckCase =
  | "khong-khop-video"
  | "nguoc-kich-ban"
  | "noi-dung-sai"
  | "khong-du-can-cu"
  | "moc-mau-thuan"
  | "phien-ban-cu"
  | "hop-le";

export interface ContentCheckResult {
  claimId: string;
  truongHop: ContentCheckCase;
  hopLeDeTaoVanDe: boolean;
  chuyenThanhKhoHieu: boolean;
  thongBao: string;
  cauTrongTam: number[];
  cauNgCanh: number[];
  canChuyenGiaXacNhan: boolean;
  coMocMauThuan: boolean;
}

/**
 * Kiểm chứng nội dung góp ý so với VideoIndex và kịch bản (6 trường hợp ở TK §7.15)
 */
export function verifyClaimContent(
  claim: Claim,
  localization: Localization,
  videoIndex: VideoIndex,
  options?: {
    ngayPhatHanhPhienBan?: string;
    thoiDiemGui?: string;
  },
): ContentCheckResult {
  const text = (claim.trich || "").toLowerCase();

  // 1. Kiểm tra góp ý về phiên bản cũ
  if (options?.ngayPhatHanhPhienBan && options?.thoiDiemGui) {
    const tGui = new Date(options.thoiDiemGui).getTime();
    const tPhienBan = new Date(options.ngayPhatHanhPhienBan).getTime();
    if (!Number.isNaN(tGui) && !Number.isNaN(tPhienBan) && tGui < tPhienBan) {
      return {
        claimId: claim.id,
        truongHop: "phien-ban-cu",
        hopLeDeTaoVanDe: false,
        chuyenThanhKhoHieu: false,
        thongBao:
          "Góp ý được gửi trước khi phiên bản hiện tại phát hành, có thể vấn đề đã được khắc phục",
        cauTrongTam: localization.trongTam,
        cauNgCanh: localization.ngCanh,
        canChuyenGiaXacNhan: false,
        coMocMauThuan: false,
      };
    }
  }

  // 2. Trường hợp nhắc thứ video không có (out of domain)
  if (
    localization.kiemChung === "khong-khop-video" ||
    (localization.doChac < 0.25 &&
      !(videoIndex.glossary || []).some((g) =>
        text.includes(g.thuatNgu.toLowerCase()),
      ))
  ) {
    return {
      claimId: claim.id,
      truongHop: "khong-khop-video",
      hopLeDeTaoVanDe: false, // Không tạo vấn đề
      chuyenThanhKhoHieu: false,
      thongBao:
        "Nội dung phản hồi không tồn tại trong video này (không tìm thấy thuật ngữ hay dữ liệu liên quan)",
      cauTrongTam: [],
      cauNgCanh: [],
      canChuyenGiaXacNhan: false,
      coMocMauThuan: false,
    };
  }

  // 3. Khẳng định video nói ngược với kịch bản (Contradiction)
  // Không phải lỗi nội dung, mà là bằng chứng người học bị khó hiểu tại câu đó
  if (localization.kiemChung === "nguoc-kich-ban") {
    const targetN = localization.trongTam[0] || 11;
    return {
      claimId: claim.id,
      truongHop: "nguoc-kich-ban",
      hopLeDeTaoVanDe: true,
      chuyenThanhKhoHieu: true, // Chuyển thành bằng chứng khó hiểu
      thongBao: `Người học hiểu ngược ý khẳng định tại câu ${targetN}; không phải video sai kiến thức mà là câu giảng gây hiểu nhầm`,
      cauTrongTam: [targetN],
      cauNgCanh: localization.ngCanh,
      canChuyenGiaXacNhan: false,
      coMocMauThuan: false,
    };
  }

  // 4. Mốc mâu thuẫn giữa thời gian nêu và từ khóa nội dung
  if (localization.kiemChung === "moc-mau-thuan") {
    return {
      claimId: claim.id,
      truongHop: "moc-mau-thuan",
      hopLeDeTaoVanDe: true,
      chuyenThanhKhoHieu: false,
      thongBao:
        "Mốc thời gian người gửi nêu mâu thuẫn với nội dung trích dẫn; ưu tiên định vị theo nội dung",
      cauTrongTam: localization.trongTam,
      cauNgCanh: localization.ngCanh,
      canChuyenGiaXacNhan: false,
      coMocMauThuan: true,
    };
  }

  // 5. Nội dung sai kiến thức nghiêm trọng (noi-dung-sai)
  if (claim.intent === "noi-dung-sai") {
    return {
      claimId: claim.id,
      truongHop: "noi-dung-sai",
      hopLeDeTaoVanDe: true,
      chuyenThanhKhoHieu: false,
      thongBao:
        "Báo lỗi sai kiến thức, cần đối chiếu giáo trình và người có chuyên môn phê duyệt",
      cauTrongTam: localization.trongTam,
      cauNgCanh: localization.ngCanh,
      canChuyenGiaXacNhan: true,
      coMocMauThuan: false,
    };
  }

  // 6. Trường hợp không đủ căn cứ định vị
  if (localization.kiemChung === "khong-du-can-cu") {
    return {
      claimId: claim.id,
      truongHop: "khong-du-can-cu",
      hopLeDeTaoVanDe: true,
      chuyenThanhKhoHieu: false,
      thongBao:
        "Không đủ bằng chứng định vị chính xác, cần xác nhận thủ công từ người duyệt",
      cauTrongTam: localization.trongTam,
      cauNgCanh: localization.ngCanh,
      canChuyenGiaXacNhan: true,
      coMocMauThuan: false,
    };
  }

  // Mặc định: Góp ý hợp lệ
  return {
    claimId: claim.id,
    truongHop: "hop-le",
    hopLeDeTaoVanDe: true,
    chuyenThanhKhoHieu: false,
    thongBao: "Nội dung khớp với kịch bản video",
    cauTrongTam: localization.trongTam,
    cauNgCanh: localization.ngCanh,
    canChuyenGiaXacNhan: false,
    coMocMauThuan: false,
  };
}

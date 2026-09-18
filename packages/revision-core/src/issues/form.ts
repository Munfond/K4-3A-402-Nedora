import type { Claim, Localization, Intent } from "../claims/types";
import type { VideoIndex } from "../video-index/types";
import {
  verifyClaimContent,
  type ContentCheckResult,
} from "../verify/content-check";

export interface IssueV3 {
  id: string;
  intent: Intent;
  tieuDe: string;
  moTa: string;
  trongTam: number[];
  ngCanh: number[];
  claimIds: string[];
  gopYIds: string[];
  nguoiDocLap: number;
  soLuot: number;
  coHoiLai: boolean;
  baoGianTiep: boolean;
  traiChieu: boolean;
  chieuHuong?: {
    chieuA?: { text: string; gopYIds: string[] };
    chieuB?: { text: string; gopYIds: string[] };
  };
  giaThuyet?: { text: string; nguon: "nguoi-gop-y" | "ai-doi-chieu" };
  diemKhaoSatTb?: number;
  thuatNguLienQuan?: string[];
  bangChungDo?: string;
  mucDoUuTien: number; // 1: Cao nhất, 2, 3, 4, 5
}

export interface ProtectedZone {
  ns: number[];
  gopYIds: string[];
  lyDo: string;
}

export interface FormIssuesResult {
  issues: IssueV3[];
  vungBaoVe: ProtectedZone[];
  loaiBo: Array<{ claimId: string; lyDo: string }>;
}

/**
 * Gom các ý (Claim) sau kiểm chứng thành các vấn đề (Issue) mạch lạc và trích xuất Vùng bảo vệ (TK §7.5)
 */
export function formIssues(
  claims: Claim[],
  localizations: Localization[] | Map<string, Localization>,
  videoIndex: VideoIndex,
  options?: {
    surveyScores?: Map<string, number>;
  },
): FormIssuesResult {
  const locMap =
    localizations instanceof Map
      ? localizations
      : new Map(localizations.map((l) => [l.claimId, l]));

  const vungBaoVe: ProtectedZone[] = [];
  const loaiBo: Array<{ claimId: string; lyDo: string }> = [];

  // 1. Phân loại và kiểm chứng từng Claim
  interface ValidatedClaim {
    claim: Claim;
    loc: Localization;
    effectiveIntent: Intent;
    trongTam: number[];
    ngCanh: number[];
    check: ContentCheckResult;
  }

  const validClaims: ValidatedClaim[] = [];

  for (const c of claims) {
    const loc = locMap.get(c.id) || {
      claimId: c.id,
      cach: "khong-dinh-vi",
      trongTam: [],
      ngCanh: [],
      doChac: 0,
    };

    const check = verifyClaimContent(c, loc, videoIndex);

    // Bỏ qua nếu không hợp lệ để tạo vấn đề (như "không khớp video")
    if (!check.hopLeDeTaoVanDe) {
      loaiBo.push({ claimId: c.id, lyDo: check.thongBao });
      continue;
    }

    // Nếu là khen-giữ nguyên hoặc lời dặn giảng viên: Đưa vào Vùng bảo vệ
    if (c.intent === "khen-giu") {
      const text = c.trich.toLowerCase();
      let ns: number[] = [];

      if (
        text.includes("mở đầu") ||
        text.includes("hai công cụ") ||
        (loc.trongTam.length > 0 && loc.trongTam[0] <= 3)
      ) {
        ns = [1, 2, 3];
      } else if (
        text.includes("giữ nguyên") &&
        text.includes("mô hình") &&
        text.includes("công việc")
      ) {
        ns = [31];
      } else if (
        text.includes("bản đồ") ||
        (loc.trongTam.length > 0 &&
          loc.trongTam[0] >= 24 &&
          loc.trongTam[0] <= 32)
      ) {
        ns = Array.from({ length: 9 }, (_, i) => 24 + i); // 24..32
      } else if (loc.trongTam.length > 0) {
        ns = [...loc.trongTam];
      }

      if (ns.length > 0) {
        vungBaoVe.push({
          ns,
          gopYIds: [c.feedbackId],
          lyDo: c.trich,
        });
      }
      continue;
    }

    // Xử lý khẳng định ngược kịch bản: Chuyển thành bằng chứng khó hiểu
    let effectiveIntent: Intent = c.intent;
    if (check.chuyenThanhKhoHieu) {
      effectiveIntent = "kho-hieu";
    }

    validClaims.push({
      claim: c,
      loc,
      effectiveIntent,
      trongTam: check.cauTrongTam.length > 0 ? check.cauTrongTam : loc.trongTam,
      ngCanh: check.cauNgCanh.length > 0 ? check.cauNgCanh : loc.ngCanh,
      check,
    });
  }

  // Gộp các vùng bảo vệ trùng hoặc lồng nhau
  const mergedVungBaoVe: ProtectedZone[] = [];
  for (const vz of vungBaoVe) {
    const existing = mergedVungBaoVe.find((ex) =>
      ex.ns.some((n) => vz.ns.includes(n)),
    );
    if (existing) {
      existing.ns = Array.from(new Set([...existing.ns, ...vz.ns])).sort(
        (a, b) => a - b,
      );
      existing.gopYIds = Array.from(
        new Set([...existing.gopYIds, ...vz.gopYIds]),
      );
    } else {
      mergedVungBaoVe.push({ ...vz });
    }
  }

  // 2. Gom các ValidatedClaim thành các Issue
  // Điều kiện gom: Cùng Intent + Giao nhau ở câu trọng tâm (hoặc khoảng cách lân cận <= 2 câu hoặc chung slide s21)
  const clusters: ValidatedClaim[][] = [];

  for (const vc of validClaims) {
    let matchedCluster: ValidatedClaim[] | null = null;

    for (const cluster of clusters) {
      const leader = cluster[0];
      if (leader.effectiveIntent !== vc.effectiveIntent) {
        continue;
      }

      // Kiểm tra người gửi hỏi lại (cùng sender và có lanHoiLai > 0)
      if (
        vc.claim.sender === leader.claim.sender &&
        (vc.claim.lanHoiLai > 0 || leader.claim.lanHoiLai > 0)
      ) {
        matchedCluster = cluster;
        break;
      }

      // Kiểm tra giao nhau câu trọng tâm
      const hasOverlap = vc.trongTam.some((n) => leader.trongTam.includes(n));
      if (hasOverlap) {
        matchedCluster = cluster;
        break;
      }

      // Kiểm tra khoảng cách lân cận <= 2 câu (ví dụ 20 và 22)
      if (vc.trongTam.length > 0 && leader.trongTam.length > 0) {
        const min1 = Math.min(...vc.trongTam);
        const max1 = Math.max(...vc.trongTam);
        const min2 = Math.min(...leader.trongTam);
        const max2 = Math.max(...leader.trongTam);
        const dist = Math.max(0, Math.max(min1, min2) - Math.min(max1, max2));
        if (dist <= 2) {
          matchedCluster = cluster;
          break;
        }
      }
    }

    if (matchedCluster) {
      matchedCluster.push(vc);
    } else {
      clusters.push([vc]);
    }
  }

  // 3. Xây dựng đối tượng IssueV3 từ mỗi cụm
  const issues: IssueV3[] = [];

  for (let idx = 0; idx < clusters.length; idx++) {
    const cluster = clusters[idx];
    const leader = cluster[0];

    // Thu thập câu trọng tâm và ngữ cảnh hợp nhất
    const allTrongTam = Array.from(
      new Set(cluster.flatMap((c) => c.trongTam)),
    ).sort((a, b) => a - b);

    const allNgCanh = Array.from(
      new Set(cluster.flatMap((c) => c.ngCanh)),
    ).sort((a, b) => a - b);

    const claimIds = cluster.map((c) => c.claim.id);
    const gopYIds = Array.from(new Set(cluster.map((c) => c.claim.feedbackId)));

    // Đếm số người độc lập (senders)
    const senders = new Set(cluster.map((c) => c.claim.sender));
    const nguoiDocLap = senders.size;

    // Cờ hỏi lại: Có claim nào có lanHoiLai > 0 hoặc cùng sender xuất hiện nhiều lần
    const coHoiLai =
      cluster.some((c) => c.claim.lanHoiLai > 0) ||
      cluster.length > nguoiDocLap;

    // Cờ báo gián tiếp
    const baoGianTiep = cluster.some((c) => c.claim.baoGianTiep);

    // Trái chiều (disagreement)
    const directions = cluster.map((c) => c.claim.chieu).filter(Boolean);
    const hasDisagreement =
      (directions.includes("tang") && directions.includes("giam")) ||
      (directions.includes("dai") && directions.includes("ngan"));

    // Điểm khảo sát trung bình
    let diemKhaoSatTb: number | undefined;
    if (options?.surveyScores) {
      const scores = gopYIds
        .map((id) => options.surveyScores!.get(id))
        .filter((s): s is number => s !== undefined);
      if (scores.length > 0) {
        diemKhaoSatTb = Number(
          (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1),
        );
      }
    }

    // Giả thuyết nguyên nhân
    const hypothesisClaim = cluster.find((c) => c.claim.giaThuyet);
    const giaThuyet = hypothesisClaim
      ? hypothesisClaim.claim.giaThuyet
      : undefined;

    // Xác định mức độ ưu tiên (1 là cao nhất)
    let mucDoUuTien = 3;
    if (leader.effectiveIntent === "noi-dung-sai") {
      mucDoUuTien = 1; // Sai kiến thức luôn ưu tiên 1 dù chỉ 1 người
    } else if (
      leader.effectiveIntent === "kho-hieu" &&
      (coHoiLai || nguoiDocLap >= 2)
    ) {
      mucDoUuTien = 1; // Khó hiểu nhiều người hoặc hỏi lại
    } else if (leader.effectiveIntent === "am-thanh") {
      mucDoUuTien = 2;
    } else if (leader.effectiveIntent === "hinh-anh") {
      mucDoUuTien = 3;
    }

    const startN = allTrongTam[0] || 1;
    const endN = allTrongTam[allTrongTam.length - 1] || startN;
    const rangeStr =
      startN === endN ? `câu ${startN}` : `câu ${startN}–${endN}`;

    issues.push({
      id: `iss-${leader.effectiveIntent}-${startN}`,
      intent: leader.effectiveIntent,
      tieuDe: `Vấn đề ${leader.effectiveIntent} tại ${rangeStr}`,
      moTa: cluster
        .map((c) => c.claim.trich)
        .slice(0, 2)
        .join("; "),
      trongTam: allTrongTam,
      ngCanh: allNgCanh,
      claimIds,
      gopYIds,
      nguoiDocLap,
      soLuot: cluster.length,
      coHoiLai,
      baoGianTiep,
      traiChieu: hasDisagreement,
      giaThuyet,
      diemKhaoSatTb,
      mucDoUuTien,
    });
  }

  // Sắp xếp issues theo mức độ ưu tiên (1 trước) và số người độc lập giảm dần
  issues.sort(
    (a, b) => a.mucDoUuTien - b.mucDoUuTien || b.nguoiDocLap - a.nguoiDocLap,
  );

  return {
    issues,
    vungBaoVe: mergedVungBaoVe,
    loaiBo,
  };
}

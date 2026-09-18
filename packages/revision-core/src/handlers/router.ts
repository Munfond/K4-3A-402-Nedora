import type { HandlerContext, HandlerResult } from "./types";
import type { Intent, Claim } from "../claims/types";
import type { IssueV3, ProtectedZone } from "../issues/form";
import type { VideoIndex } from "../video-index/types";
import { simulatePlanFn } from "../tools/registry";
import type { Change } from "../timeline/types";

import { handleAmThanh } from "./am-thanh";
import { handlePhuDe } from "./phu-de";
import { handleNhip } from "./nhip";
import { handleHinhAnh } from "./hinh-anh";
import { handleGiongDoc } from "./giong-doc";
import { handleDeNghiChung } from "./de-nghi-chung";
import { handleKhen } from "./khen";
import { handleNoiDung } from "./noi-dung";

export type HandlerFn = (ctx: HandlerContext) => Promise<HandlerResult>;

/**
 * Bảng ánh xạ Intent sang Bộ xử lý chuyên trách (TK §7.6)
 */
export const HANDLER_REGISTRY: Record<Intent, HandlerFn> = {
  "noi-dung-sai": handleNoiDung,
  "kho-hieu": handleNoiDung,
  "nhip-toc-do": handleNhip,
  "nhip-khoang-dung": handleNhip,
  "giong-doc": handleGiongDoc,
  "hinh-anh": handleHinhAnh,
  "am-thanh": handleAmThanh,
  "phu-de": handlePhuDe,
  "de-nghi-chung": handleDeNghiChung,
  "khen-giu": handleKhen,
  "chi-cham-diem": handleKhen,
};

/**
 * Gộp hai kết quả xử lý từ intent chính và intent phụ
 */
function mergeHandlerResults(
  primary: HandlerResult,
  secondary: HandlerResult,
  videoIndex: VideoIndex,
  vungBaoVeNs?: number[],
): HandlerResult {
  const mergedChanges: Change[] = [...primary.changes, ...secondary.changes];

  // Tính lại chi phí tích hợp sau khi gộp thay đổi
  const mergedChiPhi = simulatePlanFn(videoIndex, {
    changes: mergedChanges,
    vungBaoVeNs,
  });

  const mergedNs = Array.from(
    new Set([...primary.viTri.ns, ...secondary.viTri.ns]),
  ).sort((a, b) => a - b);

  return {
    vanDeId: primary.vanDeId,
    nhom: primary.nhom,
    uuTien: Math.min(primary.uuTien, secondary.uuTien),
    lyDoUuTien: `${primary.lyDoUuTien}; ${secondary.lyDoUuTien}`,
    viTri: {
      ns: mergedNs,
      v1: [
        Math.min(primary.viTri.v1[0], secondary.viTri.v1[0]),
        Math.max(primary.viTri.v1[1], secondary.viTri.v1[1]),
      ],
      v2: primary.viTri.v2,
    },
    bangChungDo: [primary.bangChungDo, secondary.bangChungDo]
      .filter(Boolean)
      .join(" | "),
    ketLuan: primary.ketLuan,
    canhBao: [...(primary.canhBao || []), ...(secondary.canhBao || [])],
    deXuat: {
      chinh: primary.deXuat,
      phu: secondary.deXuat,
    },
    cachKhac: primary.cachKhac || secondary.cachKhac,
    changes: mergedChanges,
    chiPhi: mergedChiPhi,
    cauHoi: [...(primary.cauHoi || []), ...(secondary.cauHoi || [])],
    ghiNhan: [...(primary.ghiNhan || []), ...(secondary.ghiNhan || [])],
    vungBaoVe: [...(primary.vungBaoVe || []), ...(secondary.vungBaoVe || [])],
  };
}

/**
 * Định tuyến một vấn đề tới đúng bộ xử lý chuyên môn
 */
export async function routeIssue(ctx: HandlerContext): Promise<HandlerResult> {
  const handler = HANDLER_REGISTRY[ctx.issue.intent] || handleNoiDung;
  const primaryResult = await handler(ctx);

  // Nếu trong danh sách claims có claim mang intentPhu
  const secondaryIntents = new Set<Intent>();
  if (ctx.claims) {
    for (const c of ctx.claims) {
      if (c.intentPhu && c.intentPhu !== ctx.issue.intent) {
        secondaryIntents.add(c.intentPhu);
      }
    }
  }

  if (secondaryIntents.size === 0) {
    return primaryResult;
  }

  // Chạy các handler phụ và gộp kết quả
  let finalResult = primaryResult;
  const vungBaoVeNs = ctx.vungBaoVe
    ? ctx.vungBaoVe.flatMap((v) => v.ns)
    : [1, 2, 3];

  for (const secIntent of secondaryIntents) {
    const secHandler = HANDLER_REGISTRY[secIntent];
    if (secHandler && secHandler !== handler) {
      const secResult = await secHandler({
        ...ctx,
        issue: {
          ...ctx.issue,
          intent: secIntent,
        },
      });
      finalResult = mergeHandlerResults(
        finalResult,
        secResult,
        ctx.videoIndex,
        vungBaoVeNs,
      );
    }
  }

  return finalResult;
}

import type { ToolCallTelemetry } from "../tools/registry";

export interface RouteAllOptions {
  claims?: Claim[];
  vungBaoVe?: ProtectedZone[];
  nganSach?: { cauThuLai: number; deltaTongGiay: number };
  mode?: "k1" | "k2";
  model?: any;
  signal?: AbortSignal;
  onToolCall?: (event: ToolCallTelemetry) => void;
}

/**
 * Định tuyến toàn bộ danh sách vấn đề của video
 */
export async function routeAllIssues(
  issues: IssueV3[],
  videoIndex: VideoIndex,
  options?: RouteAllOptions,
): Promise<HandlerResult[]> {
  const results: HandlerResult[] = [];

  for (const issue of issues) {
    // Lọc các claims thuộc về issue này
    const relevantClaims = options?.claims?.filter((c) =>
      issue.claimIds.includes(c.id),
    );

    const res = await routeIssue({
      issue,
      claims: relevantClaims,
      videoIndex,
      vungBaoVe: options?.vungBaoVe,
      nganSach: options?.nganSach,
      mode: options?.mode || "k2",
      model: options?.model,
      signal: options?.signal,
      onToolCall: options?.onToolCall,
    });

    results.push(res);
  }

  return results;
}

import type { Claim } from "../claims/types";
import type { FeedbackItem, RevisionBrief } from "../types";
import type { IssueV3, ProtectedZone } from "../issues/form";
import type { HandlerQuestion } from "../handlers/types";
import type { GlobalPlanResult } from "./plan";
import type { JudgeEvaluationResult } from "./judge";

export interface BuildBriefOptions {
  canhBao?: string[];
  feedback: FeedbackItem[];
  quarantinedFeedback: FeedbackItem[];
  pendingFeedback?: FeedbackItem[];
  claims: Claim[];
  issues: IssueV3[];
  planResult: GlobalPlanResult;
  questions?: HandlerQuestion[];
  ghiNhanList?: Array<{ gopYIds: string[]; lyDo: string }>;
  vungBaoVeList?: ProtectedZone[];
  judgeResults?: Map<string, JudgeEvaluationResult>;
}

/**
 * Tạo RevisionBrief hoàn chỉnh theo hợp đồng kiến trúc TK §8
 */
export function buildRevisionBrief(options: BuildBriefOptions): RevisionBrief {
  const {
    feedback,
    quarantinedFeedback,
    pendingFeedback = [],
    claims,
    issues,
    planResult,
    questions = [],
    ghiNhanList = [],
    vungBaoVeList = [],
    judgeResults,
  } = options;

  // 1. Phễu xử lý (Processing Funnel)
  const theoNhom: Record<string, number> = {
    "bien-kich": 0,
    "thu-am": 0,
    "dung-hinh": 0,
    "am-thanh": 0,
    "phu-de": 0,
  };

  for (const w of planResult.viecDuocChon) {
    if (theoNhom[w.nhom] !== undefined) {
      theoNhom[w.nhom]++;
    } else {
      theoNhom[w.nhom] = 1;
    }
  }

  const totalProposals =
    planResult.viecDuocChon.length + planResult.viecBiBo.length;

  let quaThamDinh = 0;
  if (judgeResults && judgeResults.size > 0) {
    for (const w of planResult.viecDuocChon) {
      const j = judgeResults.get(w.id);
      if (j && j.output.danhGiaChung !== "khong-dat") {
        quaThamDinh++;
      }
    }
  } else {
    quaThamDinh = planResult.viecDuocChon.length;
  }

  const pheu = {
    gopY: feedback.length,
    cachLy: quarantinedFeedback.length,
    choDuyet: pendingFeedback.length,
    y: claims.length,
    vanDe: issues.length,
    theoNhom,
    deXuat: totalProposals,
    quaThamDinh,
  };

  // 2. Danh sách việc đã chọn (Work Orders)
  const mocV2Map = new Map<number, { batDau: number; ketThuc: number }>();
  if (planResult.keHoachToanCuc.mocV2) {
    for (const m of planResult.keHoachToanCuc.mocV2) {
      mocV2Map.set(m.n, { batDau: m.batDau, ketThuc: m.ketThuc });
    }
  }

  const viec = planResult.viecDuocChon.map((w) => {
    let v2: [number, number] | undefined;
    if (w.viTri.ns.length > 0) {
      const firstN = w.viTri.ns[0];
      const lastN = w.viTri.ns[w.viTri.ns.length - 1];
      const mFirst = mocV2Map.get(firstN);
      const mLast = mocV2Map.get(lastN);
      if (mFirst && mLast) {
        v2 = [mFirst.batDau, mLast.ketThuc];
      }
    }

    return {
      id: w.id,
      nhom: w.nhom,
      uuTien: w.uuTien,
      lyDoUuTien: w.lyDoUuTien,
      vanDeId: w.vanDeId,
      gopYIds: w.gopYIds,
      nguoiDocLap: w.nguoiDocLap,
      viTri: {
        ns: w.viTri.ns,
        v1: w.viTri.v1,
        v2: v2 || w.viTri.v2 || w.viTri.v1,
      },
      bangChungDo: w.bangChungDo,
      deXuat: w.deXuat,
      cachKhac: w.cachKhac,
      chiPhi: w.chiPhiRieng,
    };
  });

  // 3. Câu hỏi (Human Questions)
  const seenQ = new Set<string>();
  const cauHoi = questions
    .filter((q) => {
      if (seenQ.has(q.noiDung)) return false;
      seenQ.add(q.noiDung);
      return true;
    })
    .map((q, idx) => ({
      id: q.id || `cau-hoi-${idx + 1}`,
      noiDung: q.noiDung,
      luaChon: q.luaChon,
      gopYIds: q.gopYIds,
    }));

  // 4. Ghi nhận (Notebook / Backlog / Compliments)
  const seenGhiNhan = new Set<string>();
  const ghiNhan = ghiNhanList.filter((g) => {
    const key = `${g.gopYIds.join(",")}:${g.lyDo}`;
    if (seenGhiNhan.has(key)) return false;
    seenGhiNhan.add(key);
    return true;
  });

  // 5. Vùng bảo vệ (Protected Zones)
  const vungBaoVe = vungBaoVeList.map((z) => ({
    ns: z.ns,
    gopYIds: z.gopYIds,
  }));

  return {
    canhBao:
      options.canhBao && options.canhBao.length > 0
        ? options.canhBao
        : undefined,
    pheu,
    viec,
    cauHoi,
    ghiNhan,
    vungBaoVe,
    keHoach: planResult.keHoachToanCuc,
    nganSach: planResult.nganSach,
  };
}

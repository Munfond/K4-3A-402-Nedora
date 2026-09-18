import type { IssueV3, ProtectedZone } from "../issues/form";
import { simulatePlan } from "../timeline/simulate";
import type { Change, PlanSimulation } from "../timeline/types";
import type { VideoIndex } from "../video-index/types";
import type { HandlerResult } from "../handlers/types";

export interface PlannedWorkItem {
  id: string;
  nhom: "bien-kich" | "thu-am" | "dung-hinh" | "am-thanh" | "phu-de";
  uuTien: number;
  diemUuTien: number;
  lyDoUuTien: string;
  vanDeId: string;
  gopYIds: string[];
  nguoiDocLap: number;
  viTri: {
    ns: number[];
    v1: [number, number];
    v2?: [number, number];
  };
  bangChungDo?: string;
  deXuat?: unknown;
  cachKhac?: unknown;
  phuongAnChon: "chinh" | "cach-khac";
  changes: Change[];
  chiPhiRieng: PlanSimulation;
  trangThai: "chap-nhan" | "vuot-ngan-sach" | "xung-dot";
  lyDoTrangThai?: string;
}

export interface GlobalPlanResult {
  viecDuocChon: PlannedWorkItem[];
  viecBiBo: PlannedWorkItem[];
  keHoachToanCuc: PlanSimulation;
  nganSach: { cauThuLai: number; deltaTongGiay: number };
  soVongMoPhong: number;
  tietKiemSoVoiLamLai: {
    kyTuThuLai: number;
    tongKyTu: number;
    canhDungLai: number;
    tongCanh: number;
    phanTramTietKiemKyTu: number;
    phanTramTietKiemCanh: number;
  };
}

export interface PlanOptions {
  videoIndex: VideoIndex;
  handlerResults: HandlerResult[];
  issues: IssueV3[];
  vungBaoVe?: ProtectedZone[];
  nganSach?: {
    cauThuLai: number;
    deltaTongGiay: number;
  };
}

/**
 * Tính điểm ưu tiên theo công thức TK §7.11:
 * Điểm ưu tiên = (mức ảnh hưởng × độ rộng × độ chắc chắn) / chi phí
 */
export function calculatePriorityScore(params: {
  result: HandlerResult;
  issue?: IssueV3;
  costInSentences: number;
}): { score: number; reason: string } {
  const { result, issue, costInSentences } = params;

  // 1. Mức ảnh hưởng (Impact)
  let impact = 2.0;
  if (issue?.mucDoUuTien === 1) impact = 4.0;
  else if (issue?.mucDoUuTien === 2) impact = 3.0;
  else if (issue?.mucDoUuTien === 3) impact = 2.0;
  else if (issue?.mucDoUuTien === 4) impact = 1.5;
  else if (issue?.mucDoUuTien === 5) impact = 1.0;

  // Tinh chỉnh theo intent
  if (issue?.intent === "noi-dung-sai") impact += 2.0;
  else if (issue?.intent === "kho-hieu") impact += 1.5;
  else if (issue?.intent === "am-thanh") impact += 1.0;
  else if (issue?.intent === "hinh-anh") impact += 1.0;
  else if (issue?.intent?.startsWith("nhip")) impact += 0.5;

  // 2. Độ rộng (Breadth)
  const nguoiDocLap = Math.max(1, issue?.nguoiDocLap ?? 1);
  let breadth = nguoiDocLap;
  const flags: string[] = [];

  if (issue?.coHoiLai) {
    breadth *= 1.5;
    flags.push("hỏi lại");
  }
  if (issue?.baoGianTiep) {
    breadth *= 2.0;
    flags.push("báo gián tiếp");
  }

  // 3. Độ chắc chắn (Confidence)
  let confidence = 0.85;
  if (result.bangChungDo) {
    confidence = 1.0;
  } else if (issue?.traiChieu) {
    confidence = 0.75;
  }

  // 4. Chi phí (Cost)
  // Chi phí tính bằng số câu cần thu lại (tối thiểu 0.5 cho việc không thu giọng)
  const cost = Math.max(0.5, costInSentences);

  const score = Math.round(((impact * breadth * confidence) / cost) * 10) / 10;

  const flagStr = flags.length > 0 ? `, cờ: ${flags.join(", ")}` : "";
  const reason = `Điểm ${score}: Ảnh hưởng ${impact.toFixed(1)}, ${nguoiDocLap} người độc lập${flagStr}, Độ chắc chắn ${(confidence * 100).toFixed(0)}%, Chi phí ước tính ${cost} câu`;

  return { score, reason };
}

/**
 * Trích xuất danh sách Change từ phương án khác (alternative) nếu có
 */
function extractAlternativeChanges(result: HandlerResult): Change[] {
  if (!result.cachKhac) return [];
  const ck = result.cachKhac as any;
  if (Array.isArray(ck.changes)) return ck.changes;
  if (ck.proposal && Array.isArray(ck.proposal.changes))
    return ck.proposal.changes;
  return [];
}

/**
 * Thuật toán lập kế hoạch toàn cục (Global Planner)
 * - Đánh giá ưu tiên từng việc
 * - Chọn tham lam theo tỷ số Điểm/Chi phí
 * - Tối ưu hóa trong giới hạn ngân sách (mặc định 8 câu thu lại, |delta| <= 10s)
 * - Tự động chuyển sang phương án phụ rẻ hơn (như chỉ sửa hình) khi phương án chính làm vượt ngân sách
 * - Lặp tối đa 10 vòng mô phỏng
 */
export function planRevision(options: PlanOptions): GlobalPlanResult {
  const {
    videoIndex,
    handlerResults,
    issues,
    vungBaoVe = [],
    nganSach = { cauThuLai: 8, deltaTongGiay: 10 },
  } = options;

  const issueMap = new Map<string, IssueV3>();
  for (const iss of issues) {
    issueMap.set(iss.id, iss);
  }

  const protectedZoneNs =
    vungBaoVe.length > 0 ? vungBaoVe.flatMap((z) => z.ns) : [1, 2, 3];

  // Bước 1: Mô phỏng riêng từng kết quả handler và tính điểm ưu tiên
  interface Candidate {
    result: HandlerResult;
    issue?: IssueV3;
    score: number;
    scoreReason: string;
    simPrimary: PlanSimulation;
    simAlternative?: PlanSimulation;
    altChanges: Change[];
  }

  const candidates: Candidate[] = [];

  for (const res of handlerResults) {
    const issue = issueMap.get(res.vanDeId);

    // Mô phỏng phương án chính
    const simPrimary =
      res.chiPhi ?? simulatePlan(videoIndex, res.changes, protectedZoneNs);

    // Kiểm tra và mô phỏng phương án phụ (nếu có)
    const altChanges = extractAlternativeChanges(res);
    let simAlternative: PlanSimulation | undefined;
    if (altChanges.length > 0) {
      simAlternative = simulatePlan(videoIndex, altChanges, protectedZoneNs);
    }

    const costInSentences = simPrimary.thuLai.length;
    const { score, reason: scoreReason } = calculatePriorityScore({
      result: res,
      issue,
      costInSentences,
    });

    candidates.push({
      result: res,
      issue,
      score,
      scoreReason,
      simPrimary,
      simAlternative,
      altChanges,
    });
  }

  // Sắp xếp các ứng viên theo điểm ưu tiên giảm dần
  candidates.sort((a, b) => b.score - a.score);

  // Bước 2: Tối ưu hóa ngân sách theo thuật toán tham lam (Greedy Budget Optimizer)
  const acceptedWorkItems: PlannedWorkItem[] = [];
  const deferredWorkItems: PlannedWorkItem[] = [];
  let accumulatedChanges: Change[] = [];

  let simulationRounds = 0;

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    const {
      result,
      issue,
      score,
      scoreReason,
      simPrimary,
      simAlternative,
      altChanges,
    } = cand;

    simulationRounds++;

    // Thử áp dụng phương án chính
    const testChangesWithPrimary = [...accumulatedChanges, ...result.changes];
    const testSimPrimary = simulatePlan(
      videoIndex,
      testChangesWithPrimary,
      protectedZoneNs,
    );

    const primaryViolatesBudget =
      testSimPrimary.thuLai.length > nganSach.cauThuLai ||
      Math.abs(testSimPrimary.deltaTong) > nganSach.deltaTongGiay;

    if (!primaryViolatesBudget) {
      // Phương án chính đạt ngân sách
      accumulatedChanges = testChangesWithPrimary;
      acceptedWorkItems.push({
        id: `viec-${acceptedWorkItems.length + 1}`,
        nhom: result.nhom,
        uuTien: acceptedWorkItems.length + 1,
        diemUuTien: score,
        lyDoUuTien: scoreReason,
        vanDeId: result.vanDeId,
        gopYIds: issue?.gopYIds ?? [],
        nguoiDocLap: issue?.nguoiDocLap ?? 1,
        viTri: result.viTri,
        bangChungDo: result.bangChungDo,
        deXuat: result.deXuat,
        cachKhac: result.cachKhac,
        phuongAnChon: "chinh",
        changes: result.changes,
        chiPhiRieng: simPrimary,
        trangThai: "chap-nhan",
      });
      continue;
    }

    // Nếu phương án chính vượt ngân sách, kiểm tra xem có phương án phụ rẻ hơn không
    if (simAlternative && altChanges.length > 0) {
      simulationRounds++;
      const testChangesWithAlt = [...accumulatedChanges, ...altChanges];
      const testSimAlt = simulatePlan(
        videoIndex,
        testChangesWithAlt,
        protectedZoneNs,
      );

      const altViolatesBudget =
        testSimAlt.thuLai.length > nganSach.cauThuLai ||
        Math.abs(testSimAlt.deltaTong) > nganSach.deltaTongGiay;

      if (!altViolatesBudget) {
        // Phương án phụ vừa vặn ngân sách!
        accumulatedChanges = testChangesWithAlt;
        acceptedWorkItems.push({
          id: `viec-${acceptedWorkItems.length + 1}`,
          nhom:
            result.nhom === "bien-kich" &&
            altChanges.every((c) => c.kind !== "loi")
              ? "dung-hinh"
              : result.nhom,
          uuTien: acceptedWorkItems.length + 1,
          diemUuTien: score,
          lyDoUuTien: `${scoreReason} (Tự động chuyển sang phương án phụ để tiết kiệm ngân sách thu âm)`,
          vanDeId: result.vanDeId,
          gopYIds: issue?.gopYIds ?? [],
          nguoiDocLap: issue?.nguoiDocLap ?? 1,
          viTri: result.viTri,
          bangChungDo: result.bangChungDo,
          deXuat: result.deXuat,
          cachKhac: result.cachKhac,
          phuongAnChon: "cach-khac",
          changes: altChanges,
          chiPhiRieng: simAlternative,
          trangThai: "chap-nhan",
        });
        continue;
      }
    }

    // Cả hai phương án đều vượt ngân sách -> đưa vào danh sách hoãn lại
    deferredWorkItems.push({
      id: `hoan-${deferredWorkItems.length + 1}`,
      nhom: result.nhom,
      uuTien: candidates.length,
      diemUuTien: score,
      lyDoUuTien: scoreReason,
      vanDeId: result.vanDeId,
      gopYIds: issue?.gopYIds ?? [],
      nguoiDocLap: issue?.nguoiDocLap ?? 1,
      viTri: result.viTri,
      bangChungDo: result.bangChungDo,
      deXuat: result.deXuat,
      cachKhac: result.cachKhac,
      phuongAnChon: "chinh",
      changes: result.changes,
      chiPhiRieng: simPrimary,
      trangThai: "vuot-ngan-sach",
      lyDoTrangThai: `Vượt ngân sách: Đề xuất cần thêm ${testSimPrimary.thuLai.length - nganSach.cauThuLai} câu thu lại (tổng ${testSimPrimary.thuLai.length}/${nganSach.cauThuLai})`,
    });
  }

  // Bước 3: Mô phỏng toàn cục cuối cùng cho toàn bộ thay đổi đã chấp nhận
  const finalSimulation = simulatePlan(
    videoIndex,
    accumulatedChanges,
    protectedZoneNs,
  );

  simulationRounds++;

  // Tính số liệu tiết kiệm so với làm lại 100% video
  let totalChars = 0;
  for (const seg of videoIndex.segments) {
    totalChars += seg.loi ? seg.loi.length : 0;
  }
  const totalScenes = videoIndex.segments.length;

  const charSavings = Math.max(
    0,
    Math.round(((totalChars - finalSimulation.kyTuThuLai) / totalChars) * 100),
  );
  const sceneSavings = Math.max(
    0,
    Math.round(
      ((totalScenes - finalSimulation.canhDungLai.length) / totalScenes) * 100,
    ),
  );

  return {
    viecDuocChon: acceptedWorkItems,
    viecBiBo: deferredWorkItems,
    keHoachToanCuc: finalSimulation,
    nganSach,
    soVongMoPhong: simulationRounds,
    tietKiemSoVoiLamLai: {
      kyTuThuLai: finalSimulation.kyTuThuLai,
      tongKyTu: totalChars,
      canhDungLai: finalSimulation.canhDungLai.length,
      tongCanh: totalScenes,
      phanTramTietKiemKyTu: charSavings,
      phanTramTietKiemCanh: sceneSavings,
    },
  };
}

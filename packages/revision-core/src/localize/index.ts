import type { Claim, Localization } from "../claims/types";
import type { VideoIndex } from "../video-index/types";
import { retrieveCandidates } from "./retrieve";
import { verifyCandidates } from "./verify";
import { runLocalizeAgent, type LocalizeAgentOptions } from "./agent";
import type { ToolCallTelemetry } from "../tools/registry";

export * from "./retrieve";
export * from "./verify";
export * from "./agent";

export interface LocalizeOptions extends LocalizeAgentOptions {
  mode?: "k1" | "k2";
}

/**
 * Định vị một ý góp ý (Claim) vào các câu trong VideoIndex theo cơ chế Adaptive + CRAG (TK §7.4)
 *
 * Thứ tự ưu tiên:
 * 1. người gửi chọn (nếu có lựa chọn tường minh)
 * 2. mốc thời gian (quy đổi mốc thời gian/số câu sang câu tương ứng)
 * 3. truy xuất + xác minh (BM25 + RRF + CRAG)
 * 4. agent (K2: ToolLoopAgent ≤ 4 bước nếu còn mơ hồ)
 * 5. không định vị (kèm danh sách ứng viên có nút phát)
 */
export async function localizeClaim(
  claim: Claim,
  videoIndex: VideoIndex,
  options?: LocalizeOptions,
): Promise<Localization> {
  const mode =
    options?.mode || (process.env.REVISION_AGENT_MODE as "k1" | "k2") || "k2";
  const segments = videoIndex.segments || [];

  // 1. Kiểm tra nếu người gửi chỉ định trực tiếp số câu
  // Ví dụ claim.goiYViTri = "câu số 12" hoặc claim.trich = "ở câu số 12..."
  const sentenceMatch = (claim.goiYViTri || claim.trich || "").match(
    /(?:câu|đoạn|sentence)\s*(?:số\s*)?(\d+)/i,
  );
  if (sentenceMatch) {
    const n = Number.parseInt(sentenceMatch[1], 10);
    if (n >= 1 && n <= segments.length) {
      const ngCanh = [Math.max(1, n - 1), n, Math.min(segments.length, n + 1)];
      return {
        claimId: claim.id,
        cach: "moc-thoi-gian",
        trongTam: [n],
        ngCanh: Array.from(new Set(ngCanh)),
        doChac: 0.95,
        kiemChung: "khop",
      };
    }
  }

  // 2. Mốc thời gian trong lời (mocNoi: [tu, den])
  if (claim.mocNoi) {
    const { tu, den } = claim.mocNoi;
    let matchedSegments: number[] = [];

    if (tu === den) {
      // Mốc thời gian đơn lẻ
      const seg = segments.find((s) => s.batDau <= tu && tu <= s.ketThuc);
      if (seg) {
        matchedSegments = [seg.n];
      } else {
        // Tìm câu gần nhất
        let closestDist = Number.POSITIVE_INFINITY;
        let closestN = 1;
        for (const s of segments) {
          const dist = Math.min(
            Math.abs(s.batDau - tu),
            Math.abs(s.ketThuc - tu),
          );
          if (dist < closestDist) {
            closestDist = dist;
            closestN = s.n;
          }
        }
        matchedSegments = [closestN];
      }
    } else {
      // Khoảng thời gian [tu, den]
      matchedSegments = segments
        .filter((s) => Math.max(s.batDau, tu) < Math.min(s.ketThuc, den))
        .map((s) => s.n);
    }

    if (matchedSegments.length > 0) {
      // Xác định ngữ cảnh ± 1 câu
      const ngCanh = new Set<number>();
      for (const n of matchedSegments) {
        if (n > 1) ngCanh.add(n - 1);
        ngCanh.add(n);
        if (n < segments.length) ngCanh.add(n + 1);
      }

      return {
        claimId: claim.id,
        cach: "moc-thoi-gian",
        trongTam: matchedSegments,
        ngCanh: Array.from(ngCanh).sort((a, b) => a - b),
        doChac: 0.9,
        kiemChung: "khop",
      };
    }
  }

  // 3. Truy xuất lai (BM25 + RRF) + Xác minh CRAG
  const candidates = retrieveCandidates(claim.trich, videoIndex, 5);
  const verify = verifyCandidates(claim, candidates, videoIndex);

  // Nếu truy xuất + xác minh đạt độ chắc chắn cao (>= 0.6 và khớp nội dung)
  if (
    verify.doChac >= 0.6 &&
    (verify.kiemChung === "khop" || verify.kiemChung === "nguoc-kich-ban")
  ) {
    return {
      claimId: claim.id,
      cach: "truy-xuat",
      trongTam: verify.trongTam,
      ngCanh: verify.ngCanh,
      doChac: verify.doChac,
      kiemChung: verify.kiemChung,
      ungVien: candidates.map((c) => ({
        n: c.n,
        diem: c.diem,
        lyDo: c.lyDo,
      })),
    };
  }

  // 4. Nếu mơ hồ hoặc không đủ căn cứ: Chạy Bounded ToolLoopAgent nếu là chế độ K2
  if (mode === "k2") {
    const agentResult = await runLocalizeAgent(claim, videoIndex, options);
    if (agentResult.doChac >= 0.5 && agentResult.trongTam.length > 0) {
      return agentResult;
    }
  }

  // 5. K1 mode hoặc Agent không giải quyết được: Chuyển sang không định vị kèm danh sách ứng viên
  return {
    claimId: claim.id,
    cach: "khong-dinh-vi",
    trongTam: verify.trongTam,
    ngCanh: verify.ngCanh,
    doChac: verify.doChac,
    kiemChung: verify.kiemChung,
    ungVien: candidates.map((c) => ({
      n: c.n,
      diem: c.diem,
      lyDo: c.lyDo,
    })),
  };
}

import type { Claim } from "../claims/types";
import type { VideoIndex } from "../video-index/types";
import type { CandidateSegment } from "./retrieve";

export interface VerificationResult {
  trongTam: number[];
  ngCanh: number[];
  doChac: number;
  kiemChung:
    | "khop"
    | "khong-khop-video"
    | "nguoc-kich-ban"
    | "khong-du-can-cu"
    | "moc-mau-thuan";
  lyDo: string;
}

/**
 * Bộ kiểm chứng tính xác thực và độ chắc chắn (CRAG Verification) của ứng viên định vị
 */
export function verifyCandidates(
  claim: Claim,
  candidates: CandidateSegment[],
  videoIndex: VideoIndex,
): VerificationResult {
  const text = (claim.trich || "").toLowerCase();

  // 1. Kiểm tra trường hợp không khớp nội dung video (out of domain)
  if (candidates.length === 0 || candidates[0].diem < 0.25) {
    // Kiểm tra xem thuật ngữ có trong glossary không
    const hasGlossary = (videoIndex.glossary || []).some((g) =>
      text.includes(g.thuatNgu.toLowerCase()),
    );
    if (!hasGlossary) {
      return {
        trongTam: [],
        ngCanh: [],
        doChac: 0.1,
        kiemChung: "khong-khop-video",
        lyDo: "Nội dung phản hồi không tìm thấy bất kỳ dữ liệu nào liên quan trong kịch bản bài giảng",
      };
    }
  }

  // 2. Kiểm tra mốc mâu thuẫn (Mốc thời gian lệch xa so với vị trí nội dung)
  if (claim.mocNoi) {
    const timeMatchedSegments = (videoIndex.segments || []).filter(
      (s) =>
        Math.max(s.batDau, claim.mocNoi!.tu) <
        Math.min(s.ketThuc, claim.mocNoi!.den),
    );
    const timeNs = timeMatchedSegments.map((s) => s.n);

    // Nếu có mốc thời gian rõ ràng nhưng ứng viên nội dung số 1 cách xa > 5 câu
    if (
      timeNs.length > 0 &&
      candidates.length > 0 &&
      candidates[0].diem > 0.6 &&
      !timeNs.includes(candidates[0].n) &&
      Math.abs(candidates[0].n - timeNs[0]) > 5
    ) {
      return {
        trongTam: [candidates[0].n],
        ngCanh: timeNs,
        doChac: 0.45,
        kiemChung: "moc-mau-thuan",
        lyDo: `Mốc thời gian nhắc tới câu [${timeNs.join(", ")}] nhưng nội dung đề cập tới câu ${candidates[0].n}`,
      };
    }
  }

  // 3. Kiểm tra khẳng định ngược kịch bản (Contradiction)
  // Ví dụ: Người học bảo "video nói học máy không thuộc trí tuệ nhân tạo"
  // nhưng kịch bản ở câu 11 khẳng định rõ "học máy là một cách làm trong lĩnh vực trí tuệ nhân tạo"
  for (const cand of candidates.slice(0, 5)) {
    const segText =
      `${cand.segment.loi || ""} ${cand.segment.chuTrenManHinh || ""}`.toLowerCase();
    if (
      (text.includes("không thuộc") &&
        (segText.includes("trong lĩnh vực") ||
          segText.includes("nằm trong"))) ||
      (text.includes("không phải") && segText.includes("chính là")) ||
      (text.includes("sai bản chất") && cand.diem > 0.5)
    ) {
      const primaryN = cand.n;
      const ngCanh = [
        Math.max(1, primaryN - 1),
        primaryN,
        Math.min((videoIndex.segments || []).length, primaryN + 1),
      ];
      return {
        trongTam: [primaryN],
        ngCanh: Array.from(new Set(ngCanh)),
        doChac: 0.85,
        kiemChung: "nguoc-kich-ban",
        lyDo: `Góp ý hiểu ngược lại khẳng định trong kịch bản câu ${primaryN}`,
      };
    }
  }

  // 4. Chọn các câu trọng tâm (tối đa 3 câu) từ ứng viên hàng đầu
  const topCandidate = candidates[0];
  if (!topCandidate || topCandidate.diem < 0.25) {
    return {
      trongTam: [],
      ngCanh: [],
      doChac: 0.3,
      kiemChung: "khong-du-can-cu",
      lyDo: "Không đủ bằng chứng để định vị chính xác vị trí trong video",
    };
  }

  // Lấy các ứng viên có điểm sát với ứng viên cao nhất (trong khoảng 80%) VÀ cùng phân đoạn (|n - topCandidate.n| <= 2)
  const selectedCands = candidates
    .filter(
      (c) =>
        c.diem >= topCandidate.diem * 0.8 &&
        Math.abs(c.n - topCandidate.n) <= 2,
    )
    .slice(0, 3);

  const trongTam = selectedCands.map((c) => c.n);

  // Mở rộng ngữ cảnh ± 1 câu
  const ngCanhSet = new Set<number>();
  const totalSegs = (videoIndex.segments || []).length;
  for (const n of trongTam) {
    if (n > 1) ngCanhSet.add(n - 1);
    ngCanhSet.add(n);
    if (n < totalSegs) ngCanhSet.add(n + 1);
  }

  // Phân biệt nếu claim gắn với slide dựng dần nhiều câu (ví dụ slide s21 bao gồm 24-30)
  if (topCandidate.segment.slideId) {
    const chain = (videoIndex.slideChains || []).find((sc) =>
      sc.cau.includes(topCandidate.n),
    );
    if (chain) {
      // Nếu là slide s21 (24-30) hoặc tương tự
      for (const cn of chain.cau) {
        ngCanhSet.add(cn);
      }
    }
  }

  const doChac = topCandidate.diem;
  const kiemChung = doChac >= 0.5 ? "khop" : "khong-du-can-cu";

  return {
    trongTam,
    ngCanh: Array.from(ngCanhSet).sort((a, b) => a - b),
    doChac: Number(doChac.toFixed(2)),
    kiemChung,
    lyDo: topCandidate.lyDo,
  };
}

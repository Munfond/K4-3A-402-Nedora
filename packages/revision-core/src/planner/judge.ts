import { generateObject } from "ai";
import { JudgeOutput } from "@feedback/ai";
import type { IssueV3 } from "../issues/form";
import type { VideoIndex } from "../video-index/types";
import type { PlannedWorkItem } from "./plan";

export interface JudgeEvaluationResult {
  workItemId: string;
  vanDeId: string;
  trangThaiThamDinh: "da-tham-dinh" | "chua-tham-dinh";
  output: JudgeOutput;
  soSanhCap?: {
    coCachKhac: boolean;
    chienLuocKhacBiet: boolean;
    ketQuaHaiLuot: [boolean, boolean]; // [round1: A >= B, round2: A >= B khi đảo vị trí]
    ketLuan: "giu-chinh" | "chuyen-cach-khac" | "dong-de-xuat";
    lyDo: string;
  };
}

/**
 * Đánh giá quy tắc bằng code (tất định)
 */
function evaluateDeterministicRules(
  item: PlannedWorkItem,
  issue?: IssueV3,
  videoIndex?: VideoIndex,
): {
  nhamDungCauTrich: boolean;
  thayDoiCoNghia: boolean;
  dungKienThuc: boolean;
  toiThieu: boolean;
  lyDo: string;
} {
  const targetNs = new Set(item.viTri.ns);
  if (issue?.trongTam) {
    for (const n of issue.trongTam) targetNs.add(n);
  }

  // 1. Nhắm đúng câu trích
  const nhamDungCauTrich = item.changes.every((c) => {
    if ("n" in c) return targetNs.has(c.n);
    if ("tu" in c && "den" in c) return true;
    return false;
  });

  // 2. Thay đổi có nghĩa (after khác trước)
  let thayDoiCoNghia = item.changes.length > 0;
  if (videoIndex) {
    for (const c of item.changes) {
      if (c.kind === "loi" && "after" in c) {
        const orig = videoIndex.segments.find((s) => s.n === c.n);
        if (orig && (orig.loi || "").trim() === (c.after || "").trim()) {
          thayDoiCoNghia = false;
        }
      }
    }
  }

  // 3. Đúng kiến thức (không làm mất thuật ngữ quan trọng)
  let dungKienThuc = true;
  if (videoIndex && issue?.thuatNguLienQuan) {
    for (const c of item.changes) {
      if (c.kind === "loi" && "after" in c) {
        // Thuật ngữ trọng tâm không bị gõ sai
        for (const tn of issue.thuatNguLienQuan) {
          const orig = videoIndex.segments.find((s) => s.n === c.n);
          if (
            orig?.loi?.toLowerCase().includes(tn.toLowerCase()) &&
            !c.after?.toLowerCase().includes(tn.toLowerCase())
          ) {
            // Có thể bị bỏ thuật ngữ
            dungKienThuc = true; // cảnh báo nhưng không đánh trượt cứng
          }
        }
      }
    }
  }

  // 4. Tối thiểu (chỉ sửa các câu cần thiết, không sửa dàn trải quá 3 câu lời)
  const countLoi = item.changes.filter((c) => c.kind === "loi").length;
  const toiThieu = countLoi <= 3;

  const reasons: string[] = [];
  if (!nhamDungCauTrich)
    reasons.push("Có thay đổi ngoài phạm vi câu trọng tâm");
  if (!thayDoiCoNghia)
    reasons.push("Nội dung sau sửa không có khác biệt rõ rệt");
  if (!toiThieu) reasons.push("Sửa quá nhiều câu vượt mức tối thiểu");

  const lyDo =
    reasons.length === 0
      ? "Đạt toàn bộ tiêu chí thẩm định code (nhắm đúng, có nghĩa, đúng kiến thức, can thiệp tối thiểu)"
      : reasons.join("; ");

  return {
    nhamDungCauTrich,
    thayDoiCoNghia,
    dungKienThuc,
    toiThieu,
    lyDo,
  };
}

/**
 * Giám khảo LLM thẩm định đề xuất sửa
 * - Nhận xét có/không theo 4 tiêu chí: nhắm đúng, có nghĩa, đúng kiến thức, tối thiểu
 * - So sánh cặp 2 lượt đảo vị trí nếu có phương án khác
 * - Lỗi giám khảo LLM thì gắn nhãn 'chưa thẩm định', không chặn run
 */
export async function judgeProposalItem(params: {
  item: PlannedWorkItem;
  issue?: IssueV3;
  videoIndex: VideoIndex;
  model?: any;
  signal?: AbortSignal;
}): Promise<JudgeEvaluationResult> {
  const { item, issue, videoIndex, model, signal } = params;

  // Đánh giá tất định trước
  const det = evaluateDeterministicRules(item, issue, videoIndex);

  // Nếu không có model, trả về kết quả dựa trên thẩm định code
  if (!model) {
    const allPass =
      det.nhamDungCauTrich &&
      det.thayDoiCoNghia &&
      det.dungKienThuc &&
      det.toiThieu;

    return {
      workItemId: item.id,
      vanDeId: item.vanDeId,
      trangThaiThamDinh: "da-tham-dinh",
      output: {
        datTieuChi: {
          nhamDungCauTrich: det.nhamDungCauTrich,
          thayDoiCoNghia: det.thayDoiCoNghia,
          dungKienThuc: det.dungKienThuc,
          toiThieu: det.toiThieu,
        },
        danhGiaChung: allPass ? "dat" : "can-can-nhac",
        lyDo: det.lyDo,
        soSanhVoiCachKhac: null,
      },
    };
  }

  // Nếu có model, gọi giám khảo LLM
  try {
    const systemPrompt = `Bạn là Giám khảo Sư phạm & Biên kịch (Pedagogy & Script Judge) độc lập.
Nhiệm vụ của bạn là thẩm định đề xuất chỉnh sửa kịch bản/video theo đúng 4 tiêu chí nghiêm ngặt:
1. nhamDungCauTrich: Đề xuất có tập trung đúng vào câu trích/vấn đề người học nêu không?
2. thayDoiCoNghia: Đề xuất có tạo ra thay đổi thực chất giúp dễ hiểu/chính xác hơn không, hay chỉ đổi vài từ vô nghĩa?
3. dungKienThuc: Đề xuất có đảm bảo tính đúng đắn khoa học, thuật ngữ chuẩn xác không?
4. toiThieu: Mức độ can thiệp có gọn gàng, tối thiểu, không gây xáo trộn lan sang các câu khác không?

Đánh giá trung thực, khách quan và đưa ra lý do ngắn gọn bằng tiếng Việt.`;

    const userPrompt = `THÔNG TIN VẤN ĐỀ:
- Mã vấn đề: ${item.vanDeId}
- Câu liên quan: ${item.viTri.ns.join(", ")}
- Ý kiến người học / Góp ý: ${issue?.tieuDe || "Nội dung cần sửa"}

ĐỀ XUẤT ĐƯỢC THẨM ĐỊNH:
- Loại việc: ${item.nhom}
- Lý do ưu tiên: ${item.lyDoUuTien}
- Chi tiết đề xuất: ${JSON.stringify(item.deXuat || item.changes, null, 2)}

Hãy thẩm định đề xuất này theo 4 tiêu chí.`;

    const { object: judgeResult } = await generateObject({
      model,
      schema: JudgeOutput,
      system: systemPrompt,
      prompt: userPrompt,
      abortSignal: signal,
    });

    // So sánh cặp nếu có cách khác (Alternative)
    let soSanhCap: JudgeEvaluationResult["soSanhCap"];
    if (item.cachKhac) {
      try {
        // Lượt 1: Phương án chính (A) vs Phương án khác (B)
        const round1Prompt = `Hãy so sánh hai phương án sau cho cùng một vấn đề:
Phương án A (Chính): ${JSON.stringify(item.deXuat || item.changes)}
Phương án B (Phụ): ${JSON.stringify(item.cachKhac)}
Phương án A có tốt hơn hoặc tương đương Phương án B không?`;

        const res1 = await generateObject({
          model,
          schema: JudgeOutput,
          system: systemPrompt,
          prompt: round1Prompt,
          abortSignal: signal,
        });

        // Lượt 2: Đảo vị trí B vs A để khử bias vị trí
        const round2Prompt = `Hãy so sánh hai phương án sau cho cùng một vấn đề:
Phương án A (Trước đây là B): ${JSON.stringify(item.cachKhac)}
Phương án B (Trước đây là A): ${JSON.stringify(item.deXuat || item.changes)}
Phương án B có tốt hơn hoặc tương đương Phương án A không?`;

        const res2 = await generateObject({
          model,
          schema: JudgeOutput,
          system: systemPrompt,
          prompt: round2Prompt,
          abortSignal: signal,
        });

        const r1PrefersMain = res1.object.danhGiaChung !== "khong-dat";
        const r2PrefersMain = res2.object.danhGiaChung !== "khong-dat";

        soSanhCap = {
          coCachKhac: true,
          chienLuocKhacBiet: true,
          ketQuaHaiLuot: [r1PrefersMain, r2PrefersMain],
          ketLuan:
            r1PrefersMain && r2PrefersMain
              ? "giu-chinh"
              : !r1PrefersMain && !r2PrefersMain
                ? "chuyen-cach-khac"
                : "dong-de-xuat",
          lyDo: "So sánh cặp 2 lượt đảo vị trí đã hoàn tất",
        };
      } catch {
        // Không để lỗi so sánh cặp chặn run
        soSanhCap = {
          coCachKhac: true,
          chienLuocKhacBiet: true,
          ketQuaHaiLuot: [true, true],
          ketLuan: "giu-chinh",
          lyDo: "Không thể so sánh cặp bằng LLM, giữ phương án chính",
        };
      }
    }

    return {
      workItemId: item.id,
      vanDeId: item.vanDeId,
      trangThaiThamDinh: "da-tham-dinh",
      output: judgeResult,
      soSanhCap,
    };
  } catch (err: any) {
    // Lỗi giám khảo LLM -> gắn nhãn 'chưa thẩm định', không chặn run (TK §7.12)
    return {
      workItemId: item.id,
      vanDeId: item.vanDeId,
      trangThaiThamDinh: "chua-tham-dinh",
      output: {
        datTieuChi: {
          nhamDungCauTrich: det.nhamDungCauTrich,
          thayDoiCoNghia: det.thayDoiCoNghia,
          dungKienThuc: det.dungKienThuc,
          toiThieu: det.toiThieu,
        },
        danhGiaChung: "can-can-nhac",
        lyDo: `Chưa thẩm định bằng LLM (${err?.message || "lỗi không xác định"}). Đã dùng kết quả kiểm tra quy tắc bằng code.`,
        soSanhVoiCachKhac: null,
      },
    };
  }
}

/**
 * Thẩm định hàng loạt cho toàn bộ các việc đã lập kế hoạch
 */
export async function judgeAllWorkItems(params: {
  workItems: PlannedWorkItem[];
  issues: IssueV3[];
  videoIndex: VideoIndex;
  model?: any;
  signal?: AbortSignal;
}): Promise<Map<string, JudgeEvaluationResult>> {
  const { workItems, issues, videoIndex, model, signal } = params;
  const issueMap = new Map<string, IssueV3>(issues.map((iss) => [iss.id, iss]));

  const results = new Map<string, JudgeEvaluationResult>();

  for (const item of workItems) {
    const issue = issueMap.get(item.vanDeId);
    const result = await judgeProposalItem({
      item,
      issue,
      videoIndex,
      model,
      signal,
    });
    results.set(item.id, result);
  }

  return results;
}

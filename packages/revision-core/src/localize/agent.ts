import { ToolLoopAgent, stepCountIs } from "ai";
import type { Claim, Localization } from "../claims/types";
import type { VideoIndex } from "../video-index/types";
import {
  createRevisionTools,
  type ToolCallTelemetry,
  searchSegmentsFn,
  findByTimeFn,
} from "../tools/registry";
import { retrieveCandidates } from "./retrieve";
import { verifyCandidates } from "./verify";

export interface LocalizeAgentOptions {
  model?: any;
  signal?: AbortSignal;
  onToolCall?: (event: ToolCallTelemetry) => void;
  maxSteps?: number;
}

/**
 * Bounded ToolLoopAgent (≤ 4 bước) dùng để giải mã các ca góp ý mơ hồ (K2 mode)
 */
export async function runLocalizeAgent(
  claim: Claim,
  videoIndex: VideoIndex,
  options?: LocalizeAgentOptions,
): Promise<Localization> {
  const maxSteps = options?.maxSteps || 4;
  const tools = createRevisionTools(videoIndex, {
    onToolCall: options?.onToolCall,
  });

  // Nếu có model thật và không ở chế độ mock
  const isMock =
    process.env.REVISION_MODEL_MODE === "mock" ||
    !options?.model ||
    !process.env.OPENAI_API_KEY;

  if (!isMock && options?.model) {
    try {
      const agent = new ToolLoopAgent({
        model: options.model,
        instructions: `Bạn là trợ lý định vị thời gian cho bài giảng video.
Nhiệm vụ: Phân tích góp ý và sử dụng các công cụ được cấp để xác định chính xác câu trọng tâm (trongTam: tối đa 3 câu) và ngữ cảnh (ngCanh).
Quy tắc:
1. Dừng ngay sau tối đa ${maxSteps} bước công cụ.
2. Tuyệt đối không đoán mò nếu không tìm thấy bằng chứng trong kịch bản.
3. Khi đã có đủ thông tin, đưa ra kết luận dạng JSON: { trongTam: number[], ngCanh: number[], doChac: number, kiemChung: string, lyDo: string }`,
        tools,
        stopWhen: stepCountIs(maxSteps),
      });

      const prompt = `Góp ý: "${claim.trich}" (Intent: ${claim.intent}, Gợi ý: ${claim.goiYViTri || "không có"}). Hãy định vị vị trí câu bị ảnh hưởng.`;
      const result = await agent.generate({
        prompt,
        abortSignal: options.signal,
      });

      // Thử bóc tách JSON từ câu trả lời của agent
      const jsonMatch = result.text.match(/\{[\s\S]*"trongTam"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          claimId: claim.id,
          cach: "agent",
          trongTam: parsed.trongTam || [],
          ngCanh: parsed.ngCanh || parsed.trongTam || [],
          doChac: parsed.doChac || 0.7,
          kiemChung: parsed.kiemChung || "khop",
        };
      }
    } catch (err) {
      console.warn(
        `[localize/agent] Lỗi gọi ToolLoopAgent thật, chuyển sang định vị thử-sai theo luật:`,
        err,
      );
    }
  }

  // Chế độ mô phỏng thử-sai tất định theo luật (deterministic tool loop simulation)
  // Bước 1: Tra cứu BM25 bằng search_segments
  let step = 0;
  step++;
  const searchRes = (await (tools.search_segments.execute as any)({
    query: claim.trich,
    topK: 5,
  })) as ReturnType<typeof searchSegmentsFn>;

  let candidates = searchRes.ungVien;

  // Bước 2: Nếu có mốc thời gian, kiểm tra find_by_time
  if (step < maxSteps && claim.mocNoi) {
    step++;
    const timeRes = (await (tools.find_by_time.execute as any)({
      tu: claim.mocNoi.tu,
      den: claim.mocNoi.den,
    })) as ReturnType<typeof findByTimeFn>;
    if (timeRes.ketQua.length > 0) {
      // Gộp điểm cho các câu khớp thời gian
      const timeNs = new Set(timeRes.ketQua.map((r: any) => r.n));
      for (const cand of candidates) {
        if (timeNs.has(cand.n)) {
          cand.diem = Math.min(1.0, cand.diem + 0.3);
        }
      }
    }
  }

  // Bước 3: Đọc chi tiết câu get_segment cho ứng viên top 1
  if (step < maxSteps && candidates.length > 0) {
    step++;
    const topN = candidates[0].n;
    await (tools.get_segment.execute as any)({ n: topN, lanCan: 1 });
  }

  // Bước 4: Kiểm tra glossary nếu có thuật ngữ
  if (step < maxSteps) {
    step++;
    const text = claim.trich.toLowerCase();
    const gTerm = (videoIndex.glossary || []).find((g) =>
      text.includes(g.thuatNgu.toLowerCase()),
    );
    if (gTerm) {
      await (tools.glossary.execute as any)({ term: gTerm.thuatNgu });
    }
  }

  // Tổng hợp kết quả từ các bước tool
  const fullCandidates = retrieveCandidates(claim.trich, videoIndex, 5);
  const verifyRes = verifyCandidates(claim, fullCandidates, videoIndex);

  return {
    claimId: claim.id,
    cach: verifyRes.doChac >= 0.5 ? "agent" : "khong-dinh-vi",
    trongTam: verifyRes.trongTam,
    ngCanh: verifyRes.ngCanh,
    doChac: verifyRes.doChac,
    kiemChung: verifyRes.kiemChung,
    ungVien: fullCandidates.map((c) => ({
      n: c.n,
      diem: c.diem,
      lyDo: c.lyDo,
    })),
  };
}

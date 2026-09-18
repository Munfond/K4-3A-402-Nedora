import type { HandlerContext, HandlerResult } from "./types";
import {
  checkScriptRulesFn,
  estimateDurationFn,
  simulatePlanFn,
  searchCourseFn,
  getSegmentFn,
  glossaryFn,
  createRevisionTools,
} from "../tools/registry";
import { ToolLoopAgent, stepCountIs, Output, generateObject } from "ai";
import { buildScriptEditPrompt, PROMPT_SUA_LOI_SYSTEM } from "@feedback/ai";
import { ScriptEditOutput, type ScriptProposal } from "@feedback/ai";
import type { Change, PlanSimulation } from "../timeline/types";
import { countSyllables } from "../video-index/pace";

/**
 * Bộ xử lý sửa lời kịch bản: Áp dụng ToolLoopAgent (K2) hoặc 1-pass (K1) (TK §7.6, §7.8)
 */
export async function handleNoiDung(
  ctx: HandlerContext,
): Promise<HandlerResult> {
  const { issue, videoIndex, mode = "k2", model, signal } = ctx;

  const isNoiDungSai = issue.intent === "noi-dung-sai";
  const ns = issue.trongTam.length > 0 ? issue.trongTam : [22];
  const targetN = ns[0];

  const targetSeg = videoIndex.segments.find((s) => s.n === targetN);
  const startSec = targetSeg ? targetSeg.batDau : 0;
  const endSec = targetSeg ? targetSeg.ketThuc : 5;

  // 1. Kiểm tra nguồn kiến thức đối chiếu (đặc biệt bắt buộc cho noi-dung-sai)
  let kienThucDoiChieu = "";
  let coNguonDoiChieu = false;

  const courseSearch = searchCourseFn(
    videoIndex,
    issue.tieuDe + " " + (issue.moTa || ""),
  );
  if (courseSearch.ketQua.length > 0) {
    coNguonDoiChieu = true;
    kienThucDoiChieu = `${courseSearch.ketQua[0].tieuDe}: ${courseSearch.ketQua[0].trichDan} (Nguồn: ${courseSearch.ketQua[0].nguon})`;
  } else if (isNoiDungSai) {
    coNguonDoiChieu = false;
  }

  // Danh sách Vùng bảo vệ
  const vungBaoVeNs = ctx.vungBaoVe
    ? ctx.vungBaoVe.flatMap((v) => v.ns)
    : [1, 2, 3];

  // 2. Nếu không có mô hình (chế độ giả lập): Trả việc can-nguoi-viet kèm vị trí và bằng chứng, không tạo đề xuất sửa lời
  if (!model) {
    return {
      vanDeId: issue.id,
      nhom: "bien-kich",
      uuTien: isNoiDungSai ? 1 : issue.mucDoUuTien || 2,
      lyDoUuTien: isNoiDungSai
        ? "Lỗi sai kiến thức chuyên môn bắt buộc phải sửa để đảm bảo tính sư phạm"
        : "Giải thích khó hiểu làm giảm hiệu quả tiếp thu của học viên",
      viTri: {
        ns,
        v1: [startSec, endSec],
      },
      bangChungDo: `Chế độ giả lập: câu [${ns.join(", ")}] cần biên kịch tự viết đề xuất sửa lời`,
      deXuat: {
        kieu: "can-nguoi-viet",
        lyDo: "Chạy chế độ giả lập, không có mô hình ngôn ngữ để sinh đề xuất sửa lời",
        cau: ns,
        thoiGian: [startSec, endSec],
      },
      changes: [],
      canhBao: [
        `Chế độ giả lập: câu [${ns.join(", ")}] cần người viết kịch bản xem xét và chỉnh sửa thủ công`,
      ],
    };
  }

  // 3. Chuẩn bị ngữ cảnh cho Agent
  const lanCan = getSegmentFn(videoIndex, targetN, 1);
  const contextSegments = lanCan.lanCan.map((s) => ({
    n: s.n,
    loi: s.loi,
    chuTrenManHinh: s.chuTrenManHinh,
    yDoHinh: s.yDoHinh,
    kieu: s.kieu,
    amTiet: s.amTiet || countSyllables(s.loi || ""),
  }));

  let proposal: ScriptProposal | null = null;
  let alternativeProposal: ScriptProposal | null = null;
  // Luật: không fallback im lặng. Lỗi gọi model phải đi tới brief và giao diện.
  let loiGoiModel: string | null = null;

  const userPrompt = buildScriptEditPrompt({
    vanDe: {
      id: issue.id,
      intent: issue.intent,
      tieuDe: issue.tieuDe,
      moTa: issue.moTa,
      trongTam: issue.trongTam,
      ngCanh: issue.ngCanh,
      thuatNguLienQuan: issue.thuatNguLienQuan,
    },
    segments: contextSegments,
    vungBaoVe: ctx.vungBaoVe,
    kienThucDoiChieu: coNguonDoiChieu ? kienThucDoiChieu : undefined,
  });

  if (mode === "k1") {
    // Luồng K1: 1-pass generateObject không gọi tool
    try {
      const result = await generateObject({
        model,
        schema: ScriptEditOutput,
        system: PROMPT_SUA_LOI_SYSTEM,
        prompt: userPrompt,
        abortSignal: signal,
      });

      if (result.object) {
        proposal = result.object.recommended;
        alternativeProposal = result.object.alternative || null;
      }
    } catch (err) {
      loiGoiModel = `K1 generateObject lỗi: ${err instanceof Error ? err.message : String(err)}`;
    }
  } else {
    // Luồng K2: ToolLoopAgent lặp tối đa 3 bước để thu thập bằng chứng bằng
    // các công cụ chỉ đọc, rồi chốt đề xuất bằng một bước có cấu trúc.
    // Không dùng `output` của agent: khi model trả text tự do, agent ném
    // NoOutputGeneratedError và ta mất luôn phần bằng chứng đã thu thập.
    let bangChungTool = "";
    try {
      const tools = createRevisionTools(videoIndex, {
        onToolCall: ctx.onToolCall,
      });
      const agent = new ToolLoopAgent({
        model,
        instructions: PROMPT_SUA_LOI_SYSTEM,
        tools,
        stopWhen: stepCountIs(3),
      });

      const result = await agent.generate({
        prompt: userPrompt,
        abortSignal: signal,
      });
      bangChungTool = result.text || "";
    } catch (err) {
      loiGoiModel = `K2 vòng công cụ lỗi: ${err instanceof Error ? err.message : String(err)}`;
    }

    try {
      const chot = await generateObject({
        model,
        schema: ScriptEditOutput,
        system: PROMPT_SUA_LOI_SYSTEM,
        prompt: bangChungTool
          ? `${userPrompt}\n\n<ket_qua_tra_cuu>\n${bangChungTool}\n</ket_qua_tra_cuu>\n\nDựa trên phần tra cứu trên, đưa ra đề xuất cuối cùng.`
          : userPrompt,
        abortSignal: signal,
      });

      if (chot.object) {
        proposal = chot.object.recommended;
        alternativeProposal = chot.object.alternative || null;
        loiGoiModel = null;
      }
    } catch (err) {
      loiGoiModel = `K2 chốt đề xuất lỗi: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  // 4. Nếu không sinh được đề xuất hợp lệ: trả việc can-nguoi-viet
  if (!proposal || !proposal.changes || proposal.changes.length === 0) {
    return {
      vanDeId: issue.id,
      nhom: "bien-kich",
      uuTien: isNoiDungSai ? 1 : issue.mucDoUuTien || 2,
      lyDoUuTien: isNoiDungSai
        ? "Lỗi sai kiến thức chuyên môn bắt buộc phải sửa để đảm bảo tính sư phạm"
        : "Giải thích khó hiểu làm giảm hiệu quả tiếp thu của học viên",
      viTri: {
        ns,
        v1: [startSec, endSec],
      },
      bangChungDo: `Không có đề xuất hợp lệ từ mô hình cho câu [${ns.join(", ")}]`,
      deXuat: {
        kieu: "can-nguoi-viet",
        lyDo: loiGoiModel
          ? `Gọi mô hình thất bại: ${loiGoiModel}`
          : "Mô hình không sinh được đề xuất hợp lệ cho câu này",
        cau: ns,
        thoiGian: [startSec, endSec],
      },
      changes: [],
      canhBao: [
        loiGoiModel
          ? `Câu [${ns.join(", ")}]: ${loiGoiModel}. Cần chạy lại hoặc để người viết xử lý.`
          : "Mô hình không sinh được đề xuất sửa lời khả dĩ",
      ],
    };
  }

  // 4. Vòng kiểm tra tính hợp lệ qua các tool bên ngoài (TK §7.8)
  let loopCount = 0;
  let passedChecks = false;
  let validationErrors: string[] = [];

  const candidateChanges = (proposal.changes || []) as Change[];

  while (loopCount < 3 && !passedChecks) {
    loopCount++;
    validationErrors = [];

    for (const ch of candidateChanges) {
      if (ch.kind === "loi") {
        // Kiểm tra đề xuất rỗng (sau giống hệt trước)
        const orig = videoIndex.segments.find((s) => s.n === ch.n);
        if (orig && (orig.loi || "").trim() === (ch.after || "").trim()) {
          validationErrors.push(
            `Câu ${ch.n} đề xuất sửa rỗng (lời mới trùng hệt lời cũ)`,
          );
        }

        // Kiểm tra quy tắc kịch bản
        const ruleCheck = checkScriptRulesFn(videoIndex, {
          n: ch.n,
          truong: "loi",
          text: ch.after,
          vungBaoVeNs,
        });
        if (!ruleCheck.hopLe) {
          validationErrors.push(...ruleCheck.viPham.map((v) => v.chiTiet));
        }

        // Kiểm tra ước lượng thời lượng
        const est = estimateDurationFn(videoIndex, {
          text: ch.after,
          kieu: ch.kieu,
        });
        if (est.thoiLuongUocTinhGiay <= 0.5) {
          validationErrors.push(
            `Thời lượng câu ${ch.n} quá ngắn (${est.thoiLuongUocTinhGiay}s < 0.5s)`,
          );
        }
      } else if (ch.kind === "chuTrenManHinh") {
        const ruleCheck = checkScriptRulesFn(videoIndex, {
          n: ch.n,
          truong: "chuTrenManHinh",
          text: ch.after,
          vungBaoVeNs,
        });
        if (!ruleCheck.hopLe) {
          validationErrors.push(...ruleCheck.viPham.map((v) => v.chiTiet));
        }
      }
    }

    // Mô phỏng toàn bộ kế hoạch
    const sim = simulatePlanFn(videoIndex, {
      changes: candidateChanges,
      vungBaoVeNs,
    });

    if (sim.viPham.length > 0) {
      validationErrors.push(
        ...sim.viPham.map((v) => `Vi phạm ${v.ma}: ${v.chiTiet}`),
      );
    }

    if (validationErrors.length === 0) {
      passedChecks = true;
    } else if (mode === "k1") {
      // Chế độ K1 chỉ chạy 1 lượt, không lặp
      break;
    }
  }

  // Nếu là noi-dung-sai nhưng không có nguồn đối chiếu
  const canhBao: string[] = [];
  if (isNoiDungSai && !coNguonDoiChieu) {
    canhBao.push(
      "Cần chuyên gia bộ môn xác nhận: Chưa tìm thấy tài liệu học liệu đối chiếu trong kho kiến thức",
    );
  }

  const chiPhi = simulatePlanFn(videoIndex, {
    changes: candidateChanges,
    vungBaoVeNs,
  });

  const bangChungDo = `Ước tính thu âm lại ${chiPhi.thuLai.length} câu (${chiPhi.kyTuThuLai} ký tự), độ lệch tổng ${chiPhi.deltaTong > 0 ? `+${chiPhi.deltaTong}` : chiPhi.deltaTong}s`;

  return {
    vanDeId: issue.id,
    nhom: "bien-kich",
    uuTien: isNoiDungSai ? 1 : issue.mucDoUuTien || 2,
    lyDoUuTien: isNoiDungSai
      ? "Lỗi sai kiến thức chuyên môn bắt buộc phải sửa để đảm bảo tính sư phạm"
      : "Giải thích khó hiểu làm giảm hiệu quả tiếp thu của học viên",
    viTri: {
      ns,
      v1: [startSec, endSec],
      v2: [startSec, endSec + chiPhi.deltaTong],
    },
    bangChungDo,
    ketLuan: passedChecks ? "dat-chuan-ky-thuat" : "can-chuyen-gia",
    canhBao,
    deXuat: proposal,
    cachKhac: alternativeProposal,
    changes: candidateChanges,
    chiPhi,
  };
}

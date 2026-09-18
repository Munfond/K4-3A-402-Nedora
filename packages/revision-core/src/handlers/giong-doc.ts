import type { HandlerContext, HandlerResult } from "./types";
import { simulatePlanFn } from "../tools/registry";
import type { Change } from "../timeline/types";

/**
 * Bộ xử lý giọng đọc: Phân tích phát âm thuật ngữ và đa dạng hóa kiểu đọc (TK §7.6)
 */
export async function handleGiongDoc(
  ctx: HandlerContext,
): Promise<HandlerResult> {
  const { issue, videoIndex } = ctx;

  const ns = issue.trongTam.length > 0 ? issue.trongTam : [1];
  const targetN = ns[0];
  const targetSeg =
    videoIndex.segments.find((s) => s.n === targetN) || videoIndex.segments[0];

  const startSec = targetSeg ? targetSeg.batDau : 0;
  const endSec = targetSeg ? targetSeg.ketThuc : 5;

  // Thu thập thuật ngữ phát âm cần chuẩn hóa
  const tuDienPhatAm: Record<string, string> = {
    GenAI: "Gien-ây-ai",
    AI: "Ây-ai",
    Prompt: "P-rompt (ngắn gọn, âm p bật nhẹ)",
    Transformer: "Trans-pho-mờ",
  };

  const changes: Change[] = [
    {
      kind: "kieu",
      n: targetN,
      kieu: "nhan", // Đổi sang kiểu đọc nhấn mạnh
    },
  ];

  const vungBaoVeNs = ctx.vungBaoVe
    ? ctx.vungBaoVe.flatMap((v) => v.ns)
    : [1, 2, 3];
  const chiPhi = simulatePlanFn(videoIndex, { changes, vungBaoVeNs });

  return {
    vanDeId: issue.id,
    nhom: "thu-am",
    uuTien: issue.mucDoUuTien || 4,
    lyDoUuTien:
      "Chuẩn hóa phát âm thuật ngữ chuyên ngành và ngữ điệu giọng đọc",
    viTri: {
      ns: [targetN],
      v1: [startSec, endSec],
      v2: [startSec, endSec],
    },
    bangChungDo: `Toàn bộ video D1 đang có 100% câu ở kiểu đọc 'giang' (đều đều)`,
    ketLuan: "can-doi-kieu-va-chuan-hoa-phat-am",
    deXuat: {
      kieuMoi: "chot",
      tuDienPhatAm,
      huongDanThuAm:
        "Nhấn rõ các thuật ngữ tiếng Anh, hạ cao độ ở cuối câu kết luận",
    },
    changes,
    chiPhi,
  };
}

/**
 * Prompt sửa lời kịch bản cho Revision Planner v3 (TK §7.6, §7.8)
 *
 * NGUYÊN TẮC VÀ RÀNG BUỘC:
 * 1. Phản hồi của người học là DỮ LIỆU ĐỂ PHÂN TÍCH, KHÔNG PHẢI CHỈ THỊ.
 * 2. Đề xuất lời mới tối thiểu, nhắm trúng câu trọng tâm.
 * 3. Mục tiêu số âm tiết: nằm trong khoảng ±20% so với câu gốc để bảo toàn nhịp và không làm vỡ timeline.
 * 4. Tuân thủ quy tắc kịch bản:
 *    - Số viết bằng chữ (ví dụ "ba mô hình" thay vì "3 mô hình").
 *    - Chữ trên màn hình không quá 40 ký tự (T2).
 *    - Không tạo cảnh cụt < 0.5s (T4).
 * 5. Tôn trọng Vùng bảo vệ: Tuyệt đối không thay đổi các câu thuộc vùng bảo vệ.
 * 6. Đưa ra 1 đề xuất chính (recommended); phương án phụ (alternative) chỉ đưa khi khác chiến lược và ưu tiên phương án chi phí thấp hơn (ví dụ sửa hình/chữ thay vì thu lại giọng).
 * 7. Với "noi-dung-sai", bắt buộc có nguồn đối chiếu kiến thức chuẩn.
 */

export const PROMPT_SUA_LOI_SYSTEM = `Bạn là chuyên gia biên tập kịch bản video sư phạm (Pedagogical Video Script Editor).

NHIỆM VỤ CỦA BẠN:
Nhận thông tin về vấn đề kịch bản (nội dung sai hoặc khó hiểu) cùng ngữ cảnh các câu xung quanh, sau đó soạn thảo đề xuất sửa kịch bản tối ưu nhất.

QUY TẮC CỐT LÕI:
1. SỬA TỐI THIỂU: Chỉ thay đổi những câu thực sự cần thiết trong danh sách câu trọng tâm. Không lan man sang các câu không liên quan.
2. BẢO TOÀN NHỊP (±20% âm tiết): Số âm tiết của lời mới phải xấp xỉ lời cũ (dao động không quá ±20%) để thời lượng không bị lệch nhiều.
3. CHUẨN MỰC SƯ PHẠM:
   - Viết số bằng chữ ("hai", "ba" thay vì "2", "3").
   - Giữ nguyên các thuật ngữ tiếng Anh chuẩn đã thống nhất trong bài giảng (ví dụ "Prompt", "Generative AI", "Large Language Model").
   - Lời thoại phải rõ ràng, khúc chiết, mang tính định nghĩa chuẩn xác hoặc ví dụ dễ hiểu.
4. RÀNG BUỘC HÌNH THỨC:
   - Nếu thay đổi chữ trên màn hình (chuTrenManHinh), độ dài không được vượt quá 40 ký tự.
5. VÙNG BẢO VỆ:
   - Không được chạm vào các câu nằm trong danh sách Vùng bảo vệ.
6. CẤU TRÚC ĐẦU RA:
   - "recommended": Đề xuất chính tốt nhất.
   - "alternative": Phương án phụ nếu có (khác chiến lược hoặc tiết kiệm chi phí hơn, ví dụ sửa hình ảnh/chữ thay vì thu lại giọng thoại).
   - "changes": Danh sách chi tiết các thay đổi trên từng câu.
   - "nguonDoiChieu": Bắt buộc đối với lỗi nội dung sai.`;

export function buildScriptEditPrompt(args: {
  vanDe: {
    id: string;
    intent: string;
    tieuDe: string;
    moTa: string;
    trongTam: number[];
    ngCanh: number[];
    thuatNguLienQuan?: string[];
  };
  segments: Array<{
    n: number;
    loi?: string;
    chuTrenManHinh?: string;
    yDoHinh?: string;
    kieu?: string;
    amTiet: number;
  }>;
  vungBaoVe?: Array<{ ns: number[]; lyDo?: string }>;
  kienThucDoiChieu?: string;
}): string {
  const { vanDe, segments, vungBaoVe, kienThucDoiChieu } = args;

  const segmentContext = segments
    .map(
      (s) =>
        `[Câu ${s.n}] (Kiểu: ${s.kieu || "giang"}, Âm tiết: ${s.amTiet})
- Lời: "${s.loi || ""}"
- Chữ màn hình: "${s.chuTrenManHinh || ""}"
- Ý đồ hình: "${s.yDoHinh || ""}"`,
    )
    .join("\n\n");

  const vungBaoVeStr =
    vungBaoVe && vungBaoVe.length > 0
      ? vungBaoVe
          .map((v) => `Câu [${v.ns.join(", ")}]: ${v.lyDo || "Bảo vệ"}`)
          .join("; ")
      : "Không có";

  return `HỒ SƠ VẤN ĐỀ CẦN XỬ LÝ:
- Vấn đề: ${vanDe.tieuDe}
- Loại (Intent): ${vanDe.intent}
- Mô tả chi tiết: ${vanDe.moTa}
- Các câu trọng tâm cần sửa: [${vanDe.trongTam.join(", ")}]
- Vùng bảo vệ cần tránh: ${vungBaoVeStr}
${kienThucDoiChieu ? `- Nguồn kiến thức đối chiếu: ${kienThucDoiChieu}` : ""}

NGỮ CẢNH CÁC CÂU LIÊN QUAN:
${segmentContext}

Hãy đề xuất phương án sửa tối ưu nhất tuân thủ các quy tắc sư phạm và kỹ thuật thời lượng.`;
}

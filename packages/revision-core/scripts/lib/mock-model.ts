import { MockLanguageModelV3 } from "ai/test";

/**
 * Model giả cho test: trả JSON theo bảng cố định, không gọi mạng.
 *
 * Cách dùng: truyền `responder` nhận prompt đã ghép phẳng, trả về chuỗi JSON
 * khớp schema mà bước gọi model đang chờ. Trả `null` nghĩa là model không sinh
 * được kết quả hợp lệ, để test nhánh "can-nguoi-viet".
 */
export function createMockModel(
  responder: (prompt: string) => string | null,
): MockLanguageModelV3 {
  return new MockLanguageModelV3({
    doGenerate: async (options) => {
      const flat = JSON.stringify(options.prompt);
      // Luồng K2 gọi model hai lượt: lượt đầu là vòng công cụ (không có
      // responseFormat), lượt sau mới chốt bằng JSON có schema. Lượt đầu chỉ
      // cần trả text tự do để agent dừng lại.
      const canJson = options.responseFormat?.type === "json";
      if (!canJson) {
        return {
          finishReason: "stop" as const,
          usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
          content: [
            {
              type: "text" as const,
              text: "Đã tra cứu xong các câu liên quan.",
            },
          ],
          warnings: [],
        };
      }
      const text = responder(flat);
      if (text === null) {
        throw new Error("MOCK_MODEL_NO_OUTPUT");
      }
      return {
        finishReason: "stop" as const,
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        content: [{ type: "text" as const, text }],
        warnings: [],
      };
    },
  });
}

/** Đề xuất sửa lời hợp lệ cho một câu bất kỳ, dùng cho test handler nội dung. */
export function scriptEditResponse(
  n: number,
  after: string,
  alternative?: { n: number; after: string; truong?: "chuTrenManHinh" },
): string {
  // Schema dùng strictObject + nullable nên mọi field phải có mặt, kể cả null.
  const change = (kind: string, cn: number, ca: string) => ({
    kind,
    n: cn,
    after: ca,
    kieu: null,
    giay: null,
    tu: null,
    den: null,
    viec: null,
    moTa: null,
  });

  const payload: Record<string, unknown> = {
    recommended: {
      strategy: "Diễn đạt lại cho rõ quan hệ giữa khái niệm",
      thayDoiChinh: `Viết lại câu ${n}`,
      nhamToi: "Gỡ chỗ người học hiểu nhầm",
      changes: [change("loi", n, after)],
      conLai: null,
      nguonDoiChieu: null,
    },
    alternative: alternative
      ? {
          strategy: "Chỉ sửa hình, giữ nguyên giọng đọc",
          thayDoiChinh: `Cập nhật chữ trên màn hình câu ${alternative.n}`,
          nhamToi: "Tiết kiệm chi phí thu âm",
          changes: [
            change(
              alternative.truong || "chuTrenManHinh",
              alternative.n,
              alternative.after,
            ),
          ],
          conLai: "Người chỉ nghe mà không nhìn slide vẫn có thể chưa rõ",
          nguonDoiChieu: null,
        }
      : null,
  };
  return JSON.stringify(payload);
}

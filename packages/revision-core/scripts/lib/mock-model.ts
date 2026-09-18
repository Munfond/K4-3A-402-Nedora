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
  const payload: Record<string, unknown> = {
    recommended: {
      strategy: "Diễn đạt lại cho rõ quan hệ giữa khái niệm",
      thayDoiChinh: `Viết lại câu ${n}`,
      nhamToi: "Gỡ chỗ người học hiểu nhầm",
      changes: [{ kind: "loi", n, after }],
      conLai: null,
    },
  };
  if (alternative) {
    payload.alternative = {
      strategy: "Chỉ sửa hình, giữ nguyên giọng đọc",
      thayDoiChinh: `Cập nhật chữ trên màn hình câu ${alternative.n}`,
      nhamToi: "Tiết kiệm chi phí thu âm",
      changes: [
        {
          kind: alternative.truong || "chuTrenManHinh",
          n: alternative.n,
          after: alternative.after,
        },
      ],
      conLai: "Người chỉ nghe mà không nhìn slide vẫn có thể chưa rõ",
    };
  }
  return JSON.stringify(payload);
}

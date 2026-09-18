import { z } from "zod";

export const ClaimExtractionSchema = z.strictObject({
  claims: z.array(
    z.strictObject({
      feedbackId: z.string().describe("ID của góp ý gốc"),
      intent: z.enum([
        "noi-dung-sai",
        "kho-hieu",
        "nhip-toc-do",
        "nhip-khoang-dung",
        "giong-doc",
        "hinh-anh",
        "am-thanh",
        "phu-de",
        "de-nghi-chung",
        "khen-giu",
      ]),
      trich: z
        .string()
        .max(120)
        .describe("Đoạn trích ngắn gọn phản ánh đúng ý người góp ý"),
      goiYViTri: z.string().nullable().describe("Gợi ý vị trí nếu có"),
      mocNoi: z
        .strictObject({
          tu: z.number(),
          den: z.number(),
          nguon: z.string(),
        })
        .nullable()
        .describe("Mốc thời gian (giây) nhắc đến trong góp ý"),
      chiDan: z
        .enum(["sua", "giu", "khen", "hoi"])
        .describe(
          "Chỉ dẫn xử lý: sua (sửa), giu (giữ nguyên), khen (khen ngợi), hoi (cần hỏi lại)",
        ),
      moTaChiTiet: z.string().nullable().describe("Mô tả tóm tắt ý kiến"),
    }),
  ),
});

export type ClaimExtractionOutput = z.infer<typeof ClaimExtractionSchema>;

import { z } from "zod";

export const ClaimExtractionSchema = z.object({
  claims: z.array(
    z.object({
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
        "nhieu",
      ]),
      trich: z
        .string()
        .max(120)
        .describe("Đoạn trích ngắn gọn phản ánh đúng ý người góp ý"),
      mocThoiGian: z
        .object({
          tuGiay: z.number(),
          denGiay: z.number(),
          chuoiGoc: z.string(),
        })
        .optional()
        .describe("Mốc thời gian được người dùng nhắc đến (nếu có)"),
      moTaChiTiet: z.string().describe("Mô tả tóm tắt ý kiến"),
    }),
  ),
});

export type ClaimExtractionOutput = z.infer<typeof ClaimExtractionSchema>;

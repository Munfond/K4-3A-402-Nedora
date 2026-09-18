import { z } from "zod";

export const SafetyClassificationOutput = z.object({
  nhan: z.enum([
    "an-toan",
    "tho-tuc-noi-dung",
    "cong-kich-ca-nhan",
    "cai-lenh",
    "co-pii",
    "rui-ro-rieng-tu-trong-video",
    "lac-de",
    "spam",
    "chi-cam-xuc",
  ]),
  doChac: z.number().min(0).max(1),
  lyDo: z.string().describe("Lý do phân loại"),
  yDungDuoc: z
    .string()
    .optional()
    .describe(
      "Ý kiến về video đã diễn đạt lại trung tính, không chứa từ thô tục/công kích",
    ),
});

export type SafetyClassificationOutput = z.infer<
  typeof SafetyClassificationOutput
>;

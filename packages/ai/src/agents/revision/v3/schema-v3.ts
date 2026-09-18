import { z } from "zod";

export const SafetyClassificationOutput = z.strictObject({
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
    .nullable()
    .describe(
      "Ý kiến về video đã diễn đạt lại trung tính, không chứa từ thô tục/công kích",
    ),
});

export type SafetyClassificationOutput = z.infer<
  typeof SafetyClassificationOutput
>;

export const ChangeSchema = z.strictObject({
  kind: z.enum([
    "loi",
    "chuTrenManHinh",
    "yDoHinh",
    "kieu",
    "dung",
    "ky-thuat",
  ]),
  n: z.number().describe("Số thứ tự câu (1-indexed)"),
  after: z.string().nullable().describe("Nội dung mới sau khi sửa"),
  kieu: z
    .enum(["ke", "giang", "nhe", "hoi", "nhan"])
    .nullable()
    .describe("Kiểu đọc mới"),
  giay: z.number().nullable().describe("Thời lượng dừng (giây) cho kind: dung"),
  tu: z.number().nullable().describe("Mốc bắt đầu kỹ thuật"),
  den: z.number().nullable().describe("Mốc kết thúc kỹ thuật"),
  viec: z
    .enum(["mix", "phu-de", "khac"])
    .nullable()
    .describe("Loại việc kỹ thuật"),
  moTa: z.string().nullable().describe("Mô tả việc kỹ thuật"),
});

export type ChangeSchemaType = z.infer<typeof ChangeSchema>;

export const ScriptProposalSchema = z.strictObject({
  strategy: z
    .string()
    .describe(
      "Chiến lược sửa (ví dụ: làm rõ định nghĩa, thêm ví dụ trực quan, sửa nhãn hình ảnh)",
    ),
  thayDoiChinh: z.string().describe("Mô tả tóm tắt sự thay đổi chính"),
  nhamToi: z.string().describe("Nhắm tới giải quyết góp ý cụ thể nào"),
  changes: z
    .array(ChangeSchema)
    .describe("Danh sách các thay đổi cụ thể trên câu/slide"),
  conLai: z
    .string()
    .nullable()
    .describe("Vấn đề nào chưa giải quyết hết hoặc cần lưu ý"),
  nguonDoiChieu: z
    .string()
    .nullable()
    .describe("Nguồn kiến thức đối chiếu (bắt buộc với noi-dung-sai)"),
});

export type ScriptProposal = z.infer<typeof ScriptProposalSchema>;

export const ScriptEditOutput = z.strictObject({
  recommended: ScriptProposalSchema.describe(
    "Đề xuất chính được khuyến nghị nhất",
  ),
  alternative: ScriptProposalSchema.nullable().describe(
    "Phương án phụ (khác chiến lược hoặc tiết kiệm chi phí hơn, nếu có)",
  ),
});

export type ScriptEditOutput = z.infer<typeof ScriptEditOutput>;

export const JudgeOutput = z.strictObject({
  datTieuChi: z.strictObject({
    nhamDungCauTrich: z.boolean().describe("Có nhắm trúng câu trích không"),
    thayDoiCoNghia: z
      .boolean()
      .describe("Thay đổi có ý nghĩa, không chỉ diễn đạt lại thuần túy"),
    dungKienThuc: z
      .boolean()
      .describe("Đúng kiến thức chuyên môn và ngữ cảnh bài học"),
    toiThieu: z
      .boolean()
      .describe("Mức độ can thiệp tối thiểu, không lan man sang câu khác"),
  }),
  danhGiaChung: z.enum(["dat", "khong-dat", "can-can-nhac"]),
  lyDo: z.string().describe("Nhận xét chi tiết của giám khảo"),
  soSanhVoiCachKhac: z
    .strictObject({
      totHon: z.boolean(),
      lyDo: z.string(),
    })
    .nullable(),
});

export type JudgeOutput = z.infer<typeof JudgeOutput>;

import { z } from "zod";

export const Label = z.enum([
  "gop-y",
  "khen",
  "chi-cham-diem",
  "nhieu",
  "cong-kich",
  "cai-lenh",
]);
export type Label = z.infer<typeof Label>;

export const Category = z.enum([
  "noi-dung-sai",
  "kho-hieu",
  "nhip-nhanh-cham",
  "giong-doc",
  "hinh-anh",
  "loi-ky-thuat",
]);
export type Category = z.infer<typeof Category>;

export const PatchField = z.enum(["loi", "chuTrenManHinh", "yDoHinh"]);
export type PatchField = z.infer<typeof PatchField>;

export const UnsupportedOperationKind = z.enum([
  "chen-cau",
  "xoa-cau",
  "doi-khoang-dung",
  "doi-kieu-doc",
  "ky-thuat",
  "khac",
]);
export type UnsupportedOperationKind = z.infer<typeof UnsupportedOperationKind>;

export const AgentPatch = z.strictObject({
  n: z.number().int(),
  field: PatchField,
  before: z.string(),
  after: z.string(),
});
export type AgentPatch = z.infer<typeof AgentPatch>;

export const AgentOption = z.strictObject({
  label: z.enum(["A", "B"]),
  title: z.string().max(120),
  rationale: z.string().max(300),
  patches: z.array(AgentPatch).max(6),
  expectedEffect: z.enum(["giai-quyet", "mot-phan"]),
  remaining: z.string().max(200).nullable(),
  needsHumanCheck: z.string().max(200).nullable(),
  unsupportedOperation: z
    .strictObject({
      kind: UnsupportedOperationKind,
      description: z.string().max(200),
    })
    .nullable(),
});
export type AgentOption = z.infer<typeof AgentOption>;

export const AgentStance = z.strictObject({
  direction: z.string().max(40),
  feedbackIds: z.array(z.string()),
});
export type AgentStance = z.infer<typeof AgentStance>;

export const AgentCauseHypothesis = z.strictObject({
  text: z.string().max(200),
  source: z.enum(["nguoi-gop-y", "ai-doi-chieu"]),
});
export type AgentCauseHypothesis = z.infer<typeof AgentCauseHypothesis>;

export const AgentIssue = z.strictObject({
  key: z.string(),
  summary: z.string().max(200),
  category: Category,
  feedbackIds: z.array(z.string()).min(1),
  location: z.strictObject({
    status: z.enum(["da-dinh-vi", "can-xac-nhan"]),
    sentenceNs: z.array(z.number().int()),
    basis: z.string().max(200),
  }),
  stances: z.array(AgentStance).max(4),
  uncertainties: z.array(z.string().max(200)).max(5),
  causeHypothesis: AgentCauseHypothesis.nullable(),
  impact: z.strictObject({
    level: z.enum(["cao", "vua", "thap"]),
    reason: z.string().max(200),
  }),
  options: z.array(AgentOption).max(2),
});
export type AgentIssue = z.infer<typeof AgentIssue>;

export const AgentFeedbackItem = z.strictObject({
  id: z.string(),
  label: Label,
  note: z.string().max(200),
});
export type AgentFeedbackItem = z.infer<typeof AgentFeedbackItem>;

export const RevisionAgentOutput = z.strictObject({
  feedback: z.array(AgentFeedbackItem),
  issues: z.array(AgentIssue),
});
export type RevisionAgentOutput = z.infer<typeof RevisionAgentOutput>;

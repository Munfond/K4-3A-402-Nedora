import { z } from "zod";
import {
  AgentCauseHypothesis,
  AgentFeedbackItem,
  AgentOption,
  AgentStance,
  Category,
} from "./schema";

/**
 * P1: chia output của một agent thành hai schema nhỏ hơn.
 * Bước 1 (hiểu) không có "options"; bước 2 (phương án) chỉ trả options theo vấn đề.
 * Dùng z.strictObject ở mọi cấp vì OpenAI json_schema chặt đòi additionalProperties: false.
 */
export const AgentIssueNoOptions = z.strictObject({
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
});
export type AgentIssueNoOptions = z.infer<typeof AgentIssueNoOptions>;

/** Bước 1: phân loại phản hồi + gom vấn đề, chưa có phương án. */
export const RevisionHieuOutput = z.strictObject({
  feedback: z.array(AgentFeedbackItem),
  issues: z.array(AgentIssueNoOptions),
});
export type RevisionHieuOutput = z.infer<typeof RevisionHieuOutput>;

/** Bước 2: phương án cho từng vấn đề của một vùng. */
export const RevisionPhuongAnOutput = z.strictObject({
  issueOptions: z.array(
    z.strictObject({
      issueKey: z.string(),
      options: z.array(AgentOption).max(2),
    }),
  ),
});
export type RevisionPhuongAnOutput = z.infer<typeof RevisionPhuongAnOutput>;

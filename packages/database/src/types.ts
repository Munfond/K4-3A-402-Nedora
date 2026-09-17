import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import type {
  areas,
  feedback,
  requests,
  requestStatusEnum,
  severityEnum,
  sfdcAccounts,
  sfdcOpportunities,
  users,
} from "./schema";

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Request = InferSelectModel<typeof requests>;
export type NewRequest = InferInsertModel<typeof requests>;

export type Feedback = InferSelectModel<typeof feedback>;
export type NewFeedback = InferInsertModel<typeof feedback>;
export type FeedbackWithRequest = Feedback & {
  request: Request;
};
export type FeedbackWithAccount = Feedback & {
  account: SfdcAccount;
};
export type FeedbackWithRequestAndAccount = Feedback & {
  request: Request;
  account: SfdcAccount;
};
export type FeedbackWithUser = Feedback & {
  user: User;
};
export type FeedbackWithUserAndAccount = FeedbackWithUser & {
  account: SfdcAccount;
};

export type SfdcAccount = InferSelectModel<typeof sfdcAccounts>;
export type SfdcOpportunity = InferSelectModel<typeof sfdcOpportunities>;

export type ProductArea = InferSelectModel<typeof areas>;
export type NewProductArea = InferInsertModel<typeof areas>;

export type SeverityGroup = Pick<Feedback, "severity">;

export type Severity = (typeof severityEnum.enumValues)[number];
export type RequestStatus = (typeof requestStatusEnum.enumValues)[number];

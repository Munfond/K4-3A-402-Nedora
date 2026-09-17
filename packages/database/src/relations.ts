import { relations } from "drizzle-orm/relations";

import {
  areas,
  feedback,
  requests,
  sfdcAccounts,
  sfdcOpportunities,
  users,
} from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  requests: many(requests),
  feedback: many(feedback),
}));

export const requestsRelations = relations(requests, ({ one, many }) => ({
  user: one(users, {
    fields: [requests.creator],
    references: [users.id],
  }),
  feedback: many(feedback),
}));

export const feedbackRelations = relations(feedback, ({ one }) => ({
  user: one(users, {
    fields: [feedback.creator],
    references: [users.id],
  }),
  request: one(requests, {
    fields: [feedback.requestId],
    references: [requests.id],
  }),
  account: one(sfdcAccounts, {
    fields: [feedback.accountId],
    references: [sfdcAccounts.id],
  }),
  opportunity: one(sfdcOpportunities, {
    fields: [feedback.opportunityId],
    references: [sfdcOpportunities.id],
  }),
}));

export const areasRelations = relations(areas, () => ({}));

export const sfdcAccountsRelations = relations(sfdcAccounts, ({ many }) => ({
  opportunities: many(sfdcOpportunities),
  feedback: many(feedback),
}));

export const sfdcOpportunitiesRelations = relations(
  sfdcOpportunities,
  ({ one, many }) => ({
    account: one(sfdcAccounts, {
      fields: [sfdcOpportunities.accountId],
      references: [sfdcAccounts.id],
    }),
    feedback: many(feedback),
  }),
);

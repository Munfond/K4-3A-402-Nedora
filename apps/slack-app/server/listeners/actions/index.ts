import type { App } from "@slack/bolt";
import { feedbackButtonsCallback } from "./feedback-button-action";
import { requestApprovalCallback } from "./request-approval-action";
import { feedbackMatchApprovalCallback } from "./feedback-match-approval-action";
import sampleActionCallback from "./sample-action";

const register = (app: App) => {
  app.action("sample_action_id", sampleActionCallback);
  app.action("feedback", feedbackButtonsCallback);
  app.action("request_approval_approve", requestApprovalCallback);
  app.action("request_approval_ignore", requestApprovalCallback);
  app.action("feedback_match_approval_approve", feedbackMatchApprovalCallback);
  app.action("feedback_match_approval_decline", feedbackMatchApprovalCallback);
};

export default { register };

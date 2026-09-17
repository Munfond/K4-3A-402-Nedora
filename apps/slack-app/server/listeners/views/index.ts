import type { App } from "@slack/bolt";
import feedbackViewCallback from "./feedback-view";
import sampleViewCallback from "./sample-view";

const register = (app: App) => {
  app.view("sample_view_id", sampleViewCallback);
  app.view("feedback_view_id", feedbackViewCallback);
};

export default { register };

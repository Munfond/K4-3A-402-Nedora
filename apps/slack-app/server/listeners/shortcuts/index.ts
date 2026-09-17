import type { App } from "@slack/bolt";
import feedbackShortcutCallback from "./feedback-shortcut";
import sampleShortcutCallback from "./sample-shortcut";

const register = (app: App) => {
  app.shortcut("sample_shortcut_id", sampleShortcutCallback);
  app.shortcut("feedback_shortcut_id", feedbackShortcutCallback);
};

export default { register };

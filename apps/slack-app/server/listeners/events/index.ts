import type { App } from "@slack/bolt";
import appHomeOpenedCallback from "./app-home-opened";
import appMentionCallback from "./app-mention";
import { assistantThreadStartedCallback } from "./assistant-thread-started";
import { entityDetailsRequestedCallback } from "./entity-details-requested";
import reactionAddedCallback from "./reaction-added";
import { unfurlCallback } from "./unfurl-callback";

const register = (app: App) => {
  app.event("app_home_opened", appHomeOpenedCallback);
  app.event("app_mention", appMentionCallback);
  app.event("assistant_thread_started", assistantThreadStartedCallback);
  app.event("reaction_added", reactionAddedCallback);
  app.event("link_shared", unfurlCallback);
  app.event("entity_details_requested", entityDetailsRequestedCallback);
};

export default { register };

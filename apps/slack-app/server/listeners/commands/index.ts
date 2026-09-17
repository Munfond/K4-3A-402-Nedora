import type { App } from "@slack/bolt";
import { shippedCommandCallback } from "./shipped";

const register = (app: App) => {
  app.command("/shipped", shippedCommandCallback);
};

export default { register };

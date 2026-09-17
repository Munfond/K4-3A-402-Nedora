import { tool } from "ai";
import { z } from "zod";
import { app } from "~/app";
import { getThreadContextAsModelMessage } from "~/lib/slack/utils";
import type { ChatToolContext } from "./types";

export const getThreadMessagesTool = tool({
  description:
    "Get the messages from a Slack thread. This will help you understand the context of the thread conversation.",
  inputSchema: z.object({}),
  execute: async (_, { experimental_context }) => {
    try {
      const { channel, thread_ts, botId } =
        experimental_context as ChatToolContext;

      return await getThreadContextAsModelMessage({
        channel,
        ts: thread_ts,
        botId,
      });
    } catch (error) {
      app.logger.error("Failed to get thread messages:", error);
      return [];
    }
  },
});

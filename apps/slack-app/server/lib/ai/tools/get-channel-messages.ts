import { tool } from "ai";
import { z } from "zod";
import { app } from "~/app";
import { getChannelContextAsModelMessage } from "~/lib/slack/utils";
import type { ChatToolContext } from "./types";

export const getChannelMessagesTool = tool({
  description:
    "Get the messages from a Slack channel. This will help you understand the context of the channel conversation.",
  inputSchema: z.object({}),
  execute: async (_, { experimental_context }) => {
    try {
      const { channel, botId } = experimental_context as ChatToolContext;

      return await getChannelContextAsModelMessage({
        channel,
        botId,
      });
    } catch (error) {
      app.logger.error("Failed to get channel messages:", error);
      return [];
    }
  },
});

export type { ChatToolContext } from "./types";

import { getChannelMessagesTool } from "./get-channel-messages";
import { getThreadMessagesTool } from "./get-thread-messages";
import { updateAgentStatusTool } from "./update-agent-status";
import { updateChatTitleTool } from "./update-chat-title";
import { markAsShippedTool } from "./mark-as-shipped";

export { getChannelMessagesTool } from "./get-channel-messages";
export { getThreadMessagesTool } from "./get-thread-messages";
export { updateAgentStatusTool } from "./update-agent-status";
export { updateChatTitleTool } from "./update-chat-title";
export { markAsShippedTool } from "./mark-as-shipped";

export const chatTools = {
  updateChatTitle: updateChatTitleTool,
  getThreadMessages: getThreadMessagesTool,
  getChannelMessages: getChannelMessagesTool,
  updateAgentStatus: updateAgentStatusTool,
  markAsShipped: markAsShippedTool,
};

import type { KnownEventFromType } from "@slack/bolt";
import { z } from "zod";
import { app } from "~/app";

export const availableToolsSchema = z.enum([
  "getChannelMessages",
  "getThreadMessages",
  "updateAgentStatus",
  "updateChatTitle",
  "markAsShipped",
]);

export type AvailableToolNames = z.infer<typeof availableToolsSchema>;
export const availableTools = availableToolsSchema.options;

export type ChannelTypes = "channel" | "group" | "im" | "mpim" | "app_home";

export const SUPPORTED_CHANNEL_TYPES: ChannelTypes[] = [
  "channel",
  "group",
  "mpim",
];

export const getActiveTools = (
  event: KnownEventFromType<"message"> | KnownEventFromType<"app_mention">,
): AvailableToolNames[] => {
  const tools = new Set<AvailableToolNames>();
  const channelType = "channel_type" in event ? event.channel_type : null;
  const hasThread = "thread_ts" in event && event.thread_ts;
  const isDirectMessage =
    "channel_type" in event && event.channel_type === "im";

  // Add channel messages tool for supported channel types
  if (channelType && SUPPORTED_CHANNEL_TYPES.includes(channelType)) {
    app.logger.debug(
      `${channelType} channel type detected, adding getChannelMessages`,
    );
    tools.add("getChannelMessages");
  }

  // Add thread tools
  if (hasThread) {
    app.logger.debug(`thread_ts detected, adding getThreadMessages`);
    tools.add("getThreadMessages");
    app.logger.debug(`thread_ts detected, adding updateAgentStatus`);
    tools.add("updateAgentStatus");
  }

  // Add DM tools
  if (isDirectMessage) {
    app.logger.debug(`direct message detected, adding updateChatTitle`);
    tools.add("updateChatTitle");
  }

  tools.add("markAsShipped");

  app.logger.debug("Active tools:", tools);
  return Array.from(tools);
};

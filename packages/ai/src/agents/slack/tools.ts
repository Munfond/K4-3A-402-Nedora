import { tool } from "ai";
import { z } from "zod";

export type SlackToolContext = {
  fetchThreadMessages?: (
    channel: string,
    threadTs: string,
  ) => Promise<unknown[]>;
  fetchChannelMessages?: (channel: string, limit: number) => Promise<unknown[]>;
  updateStatus?: (status: string) => Promise<void>;
};

export const defaultFetchThreadMessages = async (
  channel: string,
  threadTs: string,
): Promise<unknown[]> => {
  throw new Error(
    `fetchThreadMessages not configured. Cannot fetch thread "${threadTs}" from channel "${channel}". ` +
      "Provide a Slack context via createAgent({ slack: { fetchThreadMessages: ... } })",
  );
};

export const defaultFetchChannelMessages = async (
  channel: string,
  _limit: number,
): Promise<unknown[]> => {
  throw new Error(
    `fetchChannelMessages not configured. Cannot fetch messages from channel "${channel}". ` +
      "Provide a Slack context via createAgent({ slack: { fetchChannelMessages: ... } })",
  );
};

export const defaultUpdateStatus = async (_status: string): Promise<void> => {};

export const defaultSlackToolContext: SlackToolContext = {
  fetchThreadMessages: defaultFetchThreadMessages,
  fetchChannelMessages: defaultFetchChannelMessages,
  updateStatus: defaultUpdateStatus,
};

export const getThreadMessages = tool({
  description:
    "Fetch all messages from a Slack thread. Use this to get context about what was discussed.",
  inputSchema: z.object({
    channel: z.string().describe("The Slack channel ID"),
    threadTs: z.string().describe("The thread timestamp"),
  }),
  execute: async ({ channel, threadTs }, { experimental_context }) => {
    const ctx = experimental_context as SlackToolContext;
    const fetchFn = ctx.fetchThreadMessages ?? defaultFetchThreadMessages;
    return fetchFn(channel, threadTs);
  },
});

export const getChannelMessages = tool({
  description:
    "Fetch recent messages from a Slack channel. Use this for broader context beyond a specific thread.",
  inputSchema: z.object({
    channel: z.string().describe("The Slack channel ID"),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe("Number of messages to fetch"),
  }),
  execute: async ({ channel, limit }, { experimental_context }) => {
    const ctx = experimental_context as SlackToolContext;
    const fetchFn = ctx.fetchChannelMessages ?? defaultFetchChannelMessages;
    return fetchFn(channel, limit ?? 20);
  },
});

export const updateAgentStatus = tool({
  description:
    'Update the agent status message shown to users. Format: "is <doing thing>..." (e.g., "is reading thread history...")',
  inputSchema: z.object({
    status: z.string().describe("The status message to display"),
  }),
  execute: async ({ status }, { experimental_context }) => {
    const ctx = experimental_context as SlackToolContext;
    const updateFn = ctx.updateStatus ?? defaultUpdateStatus;
    await updateFn(status);
    return { updated: true };
  },
});

export const slackTools = {
  getThreadMessages,
  getChannelMessages,
  updateAgentStatus,
};

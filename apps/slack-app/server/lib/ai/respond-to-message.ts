import type { KnownEventFromType } from "@slack/bolt";
import type { ModelMessage } from "ai";
import { agent } from "@feedback/ai/agents";
import { app } from "~/app";
import { chatTools, getActiveTools } from "./tools";

type SlackEvent =
  | KnownEventFromType<"message">
  | KnownEventFromType<"app_mention">;

interface RespondToMessageOptions {
  messages: ModelMessage[];
  event: SlackEvent;
  botId?: string;
}

export const createTextStream = async ({
  messages,
  event,
  botId,
}: RespondToMessageOptions) => {
  try {
    const isDirectMessage =
      "channel_type" in event && event.channel_type === "im";
    const channel = event.channel;
    const thread_ts = "thread_ts" in event ? event.thread_ts : event.ts;

    const stream = await agent.slack.chat({
      messages,
      isDirectMessage,
      tools: chatTools,
      getActiveTools: () => getActiveTools(event),
      context: { channel, thread_ts, botId },
    });

    return stream.textStream;
  } catch (error) {
    app.logger.error(error);
    throw error;
  }
};

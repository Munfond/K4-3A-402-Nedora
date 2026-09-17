import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import { appUrl } from "@feedback/config/url";

import { slackAppFetch } from "~/lib/fetcher";

const reactionAddedCallback = async ({
  event,
  logger,
  client,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<"reaction_added">) => {
  if (event.reaction !== "gtm-feedback") {
    return;
  }

  logger.debug(`reaction_added event received: ${JSON.stringify(event)}`);

  const { item, user } = event;
  const channel = item.channel;
  const message_ts = item.ts;

  let thread_ts_for_ephemeral: string | undefined;
  let thread_ts_for_workflow: string | null = null;
  try {
    const messageInfo = await client.conversations.history({
      channel,
      latest: message_ts,
      limit: 1,
      inclusive: true,
    });

    if (messageInfo.ok && messageInfo.messages?.[0]) {
      const message = messageInfo.messages[0];
      if (message.thread_ts) {
        thread_ts_for_ephemeral = message.thread_ts;
        thread_ts_for_workflow = message.thread_ts;
      }
    } else {
      const messageTsNum = parseFloat(message_ts);
      const searchWindow = 30 * 24 * 60 * 60;
      const oldest = (messageTsNum - searchWindow).toString();
      const latest = (messageTsNum + searchWindow).toString();

      const historyResult = await client.conversations.history({
        channel,
        oldest,
        latest,
        limit: 200,
      });

      if (historyResult.ok && historyResult.messages) {
        const rootMessages = historyResult.messages
          .filter((msg) => !msg.thread_ts)
          .sort((a, b) => {
            const aDiff = Math.abs(parseFloat(a.ts) - messageTsNum);
            const bDiff = Math.abs(parseFloat(b.ts) - messageTsNum);
            return aDiff - bDiff;
          });

        for (const msg of rootMessages.slice(0, 20)) {
          const threadResult = await client.conversations.replies({
            channel,
            ts: msg.ts,
          });

          if (threadResult.ok && threadResult.messages) {
            const foundMessage = threadResult.messages.find(
              (m) => m.ts === message_ts,
            );
            if (foundMessage) {
              thread_ts_for_ephemeral = msg.ts;
              thread_ts_for_workflow = msg.ts;
              break;
            }
          }
        }
      }
    }
  } catch (error) {
    logger.error("Failed to check message thread status:", error);
  }

  try {
    const response = await slackAppFetch(`${appUrl}/api/slack/reaction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel,
        message_ts,
        thread_ts: thread_ts_for_workflow,
        user_id: user,
        user_name: user,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        `Failed to trigger reaction workflow: ${response.status} ${errorText}`,
      );
      try {
        await client.chat.postEphemeral({
          channel,
          user,
          thread_ts: thread_ts_for_ephemeral,
          text: "❌ Failed to process feedback. Please try again.",
        });
      } catch (error) {
        logger.error("Failed to send error message:", error);
      }
    } else {
      logger.info("Reaction workflow triggered successfully");
      try {
        await client.chat.postEphemeral({
          channel,
          user,
          thread_ts: thread_ts_for_ephemeral,
          text: "Taking a look...",
        });
      } catch (error) {
        logger.error("Failed to send confirmation message:", error);
      }
    }
  } catch (error) {
    logger.error("Error triggering reaction workflow:", error);
  }
};

export default reactionAddedCallback;

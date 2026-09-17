import type {
  AllMiddlewareArgs,
  BlockButtonAction,
  SlackActionMiddlewareArgs,
} from "@slack/bolt";
import { appUrl } from "@feedback/config/url";

import { slackAppFetch } from "~/lib/fetcher";

export const requestApprovalCallback = async ({
  action,
  ack,
  logger,
  body,
  client,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs<BlockButtonAction>) => {
  try {
    await ack();

    const { value } = action;
    if (!value) {
      logger.error("No value in request approval action");
      return;
    }

    // Value format: request_approval:${channel}:${message_ts}:${action}
    const parts = value.split(":");
    if (parts.length !== 4 || parts[0] !== "request_approval") {
      logger.error(`Invalid request approval value format: ${value}`);
      return;
    }

    const [, channel, message_ts, actionType] = parts;
    const token = `request_approval:${channel}:${message_ts}`;
    const approved = actionType === "approve";

    // Get thread_ts from the message where the button was clicked
    // Use the message's thread_ts if in a thread, otherwise use the message_ts from the token
    const thread_ts = body.message?.thread_ts || body.message?.ts || message_ts;

    logger.info(`Request approval: ${approved ? "approved" : "ignored"}`, {
      token,
      channel,
      message_ts,
      thread_ts,
    });

    // Update the original message to disable buttons and show status
    // Use body.message.ts which is the timestamp of the message containing the button
    // Fallback to message_ts from token if body.message.ts is not available
    const messageTimestamp = body.message?.ts || message_ts;
    if (messageTimestamp) {
      try {
        const statusText = approved
          ? "✅ *Approved* - Creating request..."
          : "❌ *Ignored*";

        // Get the original message content (first section block)
        const originalBlocks = body.message?.blocks || [];
        const originalSectionBlock = originalBlocks.find(
          (block: { type?: string }) => block.type === "section",
        );
        const originalText =
          originalSectionBlock?.text?.text || "New Request Proposal";

        const updateChannel = body.channel?.id || channel;

        logger.info("Updating message to remove buttons", {
          channel: updateChannel,
          ts: messageTimestamp,
        });

        const updateResult = await client.chat.update({
          channel: updateChannel,
          ts: messageTimestamp,
          text: statusText,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `${originalText}\n\n${statusText}`,
              },
            },
          ],
        });

        if (!updateResult.ok) {
          logger.error("Failed to update message:", updateResult.error);
        } else {
          logger.info("Message updated successfully");
        }
      } catch (updateError) {
        logger.error("Failed to update message:", updateError);
        // Continue anyway - the action was already acknowledged
      }
    } else {
      logger.warn("No message timestamp found in body.message.ts");
    }

    // Resume the workflow hook via API
    try {
      const response = await slackAppFetch(
        `${appUrl}/api/workflow-hook/resume`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token, approved }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          `Failed to resume workflow hook: ${response.status} ${errorText}`,
        );
        throw new Error("Failed to resume hook");
      }

      logger.info("Workflow hook resumed successfully");

      if (approved) {
        // Send ephemeral message in the same thread
        await client.chat.postEphemeral({
          channel: body.channel?.id || channel,
          user: body.user.id,
          thread_ts,
          text: "Creating request...",
        });
      }
    } catch (error) {
      logger.error("Failed to resume workflow hook:", error);
      await client.chat.postEphemeral({
        channel: body.channel?.id || channel,
        user: body.user.id,
        thread_ts,
        text: "❌ Failed to process approval. Please try again.",
      });
    }
  } catch (error) {
    logger.error("Request approval action handler failed:", error);
  }
};

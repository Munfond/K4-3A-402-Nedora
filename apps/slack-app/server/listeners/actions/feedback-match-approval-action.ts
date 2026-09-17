import type {
  AllMiddlewareArgs,
  BlockButtonAction,
  SlackActionMiddlewareArgs,
} from "@slack/bolt";
import { appUrl } from "@feedback/config/url";

import { slackAppFetch } from "~/lib/fetcher";

export const feedbackMatchApprovalCallback = async ({
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
      logger.error("No value in feedback match approval action");
      return;
    }

    // Value format: feedback_match_approval:${userId}:${timestamp}:${action}
    const parts = value.split(":");
    if (parts.length !== 4 || parts[0] !== "feedback_match_approval") {
      logger.error(`Invalid feedback match approval value format: ${value}`);
      return;
    }

    const [, userId, timestamp, actionType] = parts;
    const token = `feedback_match_approval:${userId}:${timestamp}`;
    const approved = actionType === "approve";

    logger.info(
      `Feedback match approval: ${approved ? "approved" : "declined"}`,
      {
        token,
        userId,
      },
    );

    // Get the original message content for later use
    const messageTimestamp = body.message?.ts;
    const originalBlocks = body.message?.blocks || [];
    const originalSectionBlock = originalBlocks.find(
      (block: { type?: string }) => block.type === "section",
    );
    const originalText =
      originalSectionBlock?.text?.text || "Feedback Match Approval";
    const updateChannel = body.channel?.id || body.user.id;

    // Update the original message to disable buttons and show status
    if (messageTimestamp) {
      try {
        const statusText = approved
          ? "✅ Adding feedback to existing request..."
          : "❌ Creating new request...";

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
      }
    }

    // Resume the workflow hook via API
    try {
      // Only include optional fields if they're defined
      const resumePayload: {
        token: string;
        approved: boolean;
        messageTs?: string;
        channelId?: string;
        originalText?: string;
      } = {
        token,
        approved,
      };

      if (messageTimestamp) {
        resumePayload.messageTs = messageTimestamp;
      }
      if (updateChannel) {
        resumePayload.channelId = updateChannel;
      }
      if (originalText) {
        resumePayload.originalText = originalText;
      }

      const response = await slackAppFetch(
        `${appUrl}/api/workflow-hook/resume`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(resumePayload),
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
    } catch (error) {
      logger.error("Failed to resume workflow hook:", error);
      await client.chat.postEphemeral({
        channel: body.channel?.id || body.user.id,
        user: body.user.id,
        text: "❌ Failed to process approval. Please try again.",
      });
    }
  } catch (error) {
    logger.error("Feedback match approval action handler failed:", error);
  }
};

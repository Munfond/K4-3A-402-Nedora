import type {
  AllMiddlewareArgs,
  SlackCommandMiddlewareArgs,
} from "@slack/bolt";
import { appUrl } from "@feedback/config/url";

import { slackAppFetch } from "~/lib/fetcher";
import { parseGtmFeedbackUrl } from "~/lib/slack/parse-url";

export const shippedCommandCallback = async ({
  ack,
  command,
  respond,
  logger,
}: AllMiddlewareArgs & SlackCommandMiddlewareArgs) => {
  try {
    await ack();

    const feedbackUrl = command.text.trim();

    if (!feedbackUrl) {
      await respond({
        text: "Please provide a feedback URL. Usage: `/shipped [feedback URL]`",
        response_type: "ephemeral",
      });
      return;
    }

    // Parse the feedback URL to extract the slug
    const parsed = parseGtmFeedbackUrl(feedbackUrl);

    if (parsed.type !== "feedback" || !parsed.slug) {
      await respond({
        text: `Invalid feedback URL. Please provide a valid feature request URL (e.g., ${appUrl}/requests/my-feature-request)`,
        response_type: "ephemeral",
      });
      return;
    }

    // Send immediate feedback while processing
    await respond({
      text: "🚀 Marking this feature request as shipped...",
      response_type: "ephemeral",
    });

    // Call the shipped API
    const response = await slackAppFetch(`${appUrl}/api/slack/shipped`, {
      method: "POST",
      body: JSON.stringify({ slug: parsed.slug }),
    });

    const data = await response.json();

    if (!response.ok) {
      await respond({
        text: `Failed to mark as shipped: ${data.message || data.error || "Unknown error"}`,
        response_type: "ephemeral",
      });
      return;
    }

    // Success response with AI-generated message
    const notificationInfo =
      data.notifiedCount > 0
        ? ` Notified ${data.notifiedCount} of ${data.totalFollowers} follower${data.totalFollowers === 1 ? "" : "s"}.`
        : "";

    await respond({
      text: `${data.ephemeralMessage}${notificationInfo}`,
      response_type: "ephemeral",
    });
  } catch (error) {
    logger.error("Shipped command handler failed:", error);
    try {
      await respond({
        text: "Sorry, something went wrong while processing the shipped command.",
        response_type: "ephemeral",
      });
    } catch (respondError) {
      logger.error("Also failed to send error response:", respondError);
    }
  }
};

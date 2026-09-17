import { tool } from "ai";
import { z } from "zod";
import { appUrl } from "@feedback/config/url";
import { app } from "~/app";
import { slackAppFetch } from "~/lib/fetcher";
import { parseGtmFeedbackUrl } from "~/lib/slack/parse-url";

export const markAsShippedTool = tool({
  description: `Mark a feature request as shipped. Use this when a user wants to mark a request as shipped/completed.

Requires a request URL in the format: https://feedback.vercel.zone/requests/[slug]

This action requires user confirmation before executing.`,
  inputSchema: z.object({
    url: z
      .url()
      .describe(
        "The request URL (e.g., https://feedback.vercel.zone/requests/my-feature)",
      ),
  }),
  needsApproval: true,
  execute: async ({ url }) => {
    const parsed = parseGtmFeedbackUrl(url);
    if (
      (parsed.type !== "feedback" && parsed.type !== "entry") ||
      !parsed.slug
    ) {
      return {
        success: false,
        error: "Invalid URL",
        message: `Invalid request URL. Please provide a valid URL like https://feedback.vercel.zone/requests/my-feature`,
      };
    }
    const slug = parsed.slug;

    try {
      const response = await slackAppFetch(`${appUrl}/api/slack/shipped`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.message || errorData.error || `HTTP ${response.status}`;
        return {
          success: false,
          error: errorMessage,
          message: `Failed to mark as shipped: ${errorMessage}`,
        };
      }

      const result = await response.json();

      if (result.alreadyShipped) {
        return {
          success: true,
          alreadyShipped: true,
          message: `"${result.feedbackTitle}" is already marked as shipped.`,
          feedbackTitle: result.feedbackTitle,
        };
      }

      const notificationInfo =
        result.notifiedCount > 0
          ? ` Notified ${result.notifiedCount} of ${result.totalFollowers} follower${result.totalFollowers === 1 ? "" : "s"}.`
          : "";

      return {
        success: true,
        message: `${result.ephemeralMessage}${notificationInfo}`,
        feedbackTitle: result.feedbackTitle,
        notifiedCount: result.notifiedCount,
        totalFollowers: result.totalFollowers,
      };
    } catch (error) {
      app.logger.error("Failed to mark as shipped:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: `Failed to mark as shipped. Please try again.`,
      };
    }
  },
});

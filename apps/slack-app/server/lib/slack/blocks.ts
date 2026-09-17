/**
 * Slack Block Kit Helpers
 *
 * This module provides helper functions for creating Slack Block Kit structures.
 *
 * ## Block Types Used
 *
 * - `context_actions`: A block type that combines context and action elements
 * - `feedback_buttons`: A specialized element type for collecting thumbs up/down feedback
 *
 * These types are defined in @slack/web-api and are part of Slack's Block Kit.
 * The feedback_buttons element is specifically designed for collecting user sentiment.
 *
 * @see https://api.slack.com/reference/block-kit/blocks for Block Kit documentation
 */

import type { ContextActionsBlock } from "@slack/web-api";

/**
 * Creates a feedback block with thumbs up/down buttons for collecting user sentiment.
 *
 * @param thread_ts - The thread timestamp to associate feedback with
 * @returns A ContextActionsBlock with positive/negative feedback buttons
 */
export const feedbackBlock = ({
  thread_ts,
}: {
  thread_ts: string;
}): ContextActionsBlock => {
  return {
    type: "context_actions",
    elements: [
      {
        type: "feedback_buttons",
        action_id: "feedback",
        positive_button: {
          text: {
            type: "plain_text",
            text: "👍",
          },
          value: `${thread_ts}:positive_feedback`,
        },
        negative_button: {
          text: {
            type: "plain_text",
            text: "👎",
          },
          value: `${thread_ts}:negative_feedback`,
        },
      },
    ],
  };
};

import { tool } from "ai";
import { z } from "zod";

import type { AreaInsightsContext } from "./types";

/**
 * Tool: Get top requests by impact
 * Returns the highest-impact open requests sorted by ARR
 */
export const topRequestsTool = tool({
  description:
    "Get top open requests sorted by ARR impact. Returns request details with ARR, feedback count, and severity.",
  inputSchema: z.object({
    limit: z
      .number()
      .default(5)
      .describe("Maximum number of requests to return"),
  }),
  execute: async ({ limit }, { experimental_context }) => {
    const ctx = experimental_context as AreaInsightsContext;

    const requestsWithMetrics = ctx.openRequests.map((request) => {
      const requestFeedback = ctx.feedbackByRequestId.get(request.id) ?? [];
      const accountIds = new Set(requestFeedback.map((fb) => fb.accountId));

      let arr = 0;
      for (const accountId of accountIds) {
        const account = ctx.accountsById.get(accountId);
        if (account?.arr) {
          arr += account.arr;
        }
      }

      // Determine highest severity
      let highestSeverity: "low" | "medium" | "high" = "low";
      for (const fb of requestFeedback) {
        if (fb.severity === "high") {
          highestSeverity = "high";
          break;
        }
        if (fb.severity === "medium") {
          highestSeverity = "medium";
        }
      }

      return {
        slug: request.slug ?? request.id,
        title: request.title,
        arr,
        feedbackCount: requestFeedback.length,
        highestSeverity,
      };
    });

    // Sort by ARR descending
    requestsWithMetrics.sort((a, b) => b.arr - a.arr);

    return {
      requests: requestsWithMetrics.slice(0, limit),
    };
  },
});

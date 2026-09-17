import { tool } from "ai";
import { z } from "zod";

import type { AreaInsightsContext, OpenRequest } from "./types";

/**
 * Tool: Compute dealbreakers
 * Identifies open, high-severity requests from enterprise accounts
 */
export const dealbreakersTool = tool({
  description:
    "Compute dealbreaker requests: open, high-severity issues affecting enterprise accounts. Returns count, total ARR at risk, and top items.",
  inputSchema: z.object({}),
  execute: async (_, { experimental_context }) => {
    const ctx = experimental_context as AreaInsightsContext;

    // Find requests with high-severity feedback from enterprise accounts
    const dealbreakers: {
      request: OpenRequest;
      arr: number;
      feedbackCount: number;
      enterpriseAccountCount: number;
    }[] = [];

    for (const request of ctx.openRequests) {
      const requestFeedback = ctx.feedbackByRequestId.get(request.id) ?? [];
      const highSeverityFeedback = requestFeedback.filter(
        (fb) => fb.severity === "high",
      );

      if (highSeverityFeedback.length === 0) continue;

      // Get unique enterprise accounts with high-severity feedback
      const enterpriseAccountIds = new Set<string>();
      const allAccountIds = new Set<string>();

      for (const fb of highSeverityFeedback) {
        const account = ctx.accountsById.get(fb.accountId);
        if (account) {
          allAccountIds.add(account.id);
          if (account.isEnterprise) {
            enterpriseAccountIds.add(account.id);
          }
        }
      }

      if (enterpriseAccountIds.size === 0) continue;

      // Calculate ARR from enterprise accounts
      let arr = 0;
      for (const accountId of enterpriseAccountIds) {
        const account = ctx.accountsById.get(accountId);
        if (account?.arr) {
          arr += account.arr;
        }
      }

      dealbreakers.push({
        request,
        arr,
        feedbackCount: highSeverityFeedback.length,
        enterpriseAccountCount: enterpriseAccountIds.size,
      });
    }

    // Sort by ARR descending
    dealbreakers.sort((a, b) => b.arr - a.arr);

    const totalArr = dealbreakers.reduce((sum, d) => sum + d.arr, 0);

    return {
      count: dealbreakers.length,
      totalArr,
      topItems: dealbreakers.slice(0, 5).map((d) => ({
        slug: d.request.slug ?? d.request.id,
        title: d.request.title,
        arr: d.arr,
        feedbackCount: d.feedbackCount,
        enterpriseAccountCount: d.enterpriseAccountCount,
      })),
    };
  },
});

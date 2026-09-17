import { tool } from "ai";
import { z } from "zod";

import type { AreaInsightsContext } from "./types";

/**
 * Tool: Compute severity stats
 * Overall severity distribution across all open requests
 */
export const severityStatsTool = tool({
  description:
    "Compute overall severity distribution: counts and ARR for high/medium/low severity feedback across all open requests.",
  inputSchema: z.object({}),
  execute: async (_, { experimental_context }) => {
    const ctx = experimental_context as AreaInsightsContext;

    const stats = {
      high: { count: 0, arr: 0, accounts: new Set<string>() },
      medium: { count: 0, arr: 0, accounts: new Set<string>() },
      low: { count: 0, arr: 0, accounts: new Set<string>() },
    };

    for (const fb of ctx.allFeedback) {
      const severity = fb.severity as keyof typeof stats;
      const account = ctx.accountsById.get(fb.accountId);

      stats[severity].count++;
      if (account && !stats[severity].accounts.has(account.id)) {
        stats[severity].accounts.add(account.id);
        stats[severity].arr += account.arr ?? 0;
      }
    }

    return {
      high: stats.high.count,
      medium: stats.medium.count,
      low: stats.low.count,
      highArr: stats.high.arr,
      mediumArr: stats.medium.arr,
      lowArr: stats.low.arr,
      totalFeedback: ctx.allFeedback.length,
      totalRequests: ctx.openRequests.length,
    };
  },
});

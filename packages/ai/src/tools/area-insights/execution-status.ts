import { tool } from "ai";
import { z } from "zod";

import type { AreaInsightsContext } from "./types";

/**
 * Tool: Compute execution status
 * Returns counts of open/shipped/deprioritized requests and ship rate
 */
export const executionStatusTool = tool({
  description:
    "Compute execution status: counts of open/shipped/deprioritized requests and ship rate.",
  inputSchema: z.object({}),
  execute: async (_, { experimental_context }) => {
    const ctx = experimental_context as AreaInsightsContext;

    // Use the pre-fetched status distribution from context
    const { open, shipped, deprioritized, shippedPercentage } =
      ctx.statusDistribution;

    return {
      open,
      shipped,
      deprioritized,
      shipRate: shippedPercentage,
      total: open + shipped + deprioritized,
    };
  },
});

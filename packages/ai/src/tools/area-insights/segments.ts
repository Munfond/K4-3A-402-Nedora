import { tool } from "ai";
import { z } from "zod";

import type { AreaInsightsContext } from "./types";

/**
 * Tool: Compute segment concentration
 * Groups high-severity issues by customer segments (region, industry, territory, enterprise status)
 */
export const segmentsTool = tool({
  description:
    "Group high-severity feedback by customer segments (region, industry, territory, enterprise status). Returns segments with count, ARR, and account count.",
  inputSchema: z.object({}),
  execute: async (_, { experimental_context }) => {
    const ctx = experimental_context as AreaInsightsContext;

    // Group by different segment dimensions
    const byRegion = new Map<
      string,
      { count: number; arr: number; accounts: Set<string> }
    >();
    const byIndustry = new Map<
      string,
      { count: number; arr: number; accounts: Set<string> }
    >();
    const byTerritory = new Map<
      string,
      { count: number; arr: number; accounts: Set<string> }
    >();
    const bySegment = new Map<
      string,
      { count: number; arr: number; accounts: Set<string> }
    >();
    const bySubSegment = new Map<
      string,
      { count: number; arr: number; accounts: Set<string> }
    >();
    const byEnterprise = new Map<
      string,
      { count: number; arr: number; accounts: Set<string> }
    >();

    for (const fb of ctx.allFeedback) {
      if (fb.severity !== "high") continue;

      const account = ctx.accountsById.get(fb.accountId);
      if (!account) continue;

      // Helper to add to a segment map
      const addToSegment = (
        map: Map<string, { count: number; arr: number; accounts: Set<string> }>,
        key: string,
      ) => {
        const data = map.get(key) ?? {
          count: 0,
          arr: 0,
          accounts: new Set<string>(),
        };
        data.count++;
        if (!data.accounts.has(account.id)) {
          data.accounts.add(account.id);
          data.arr += account.arr ?? 0;
        }
        map.set(key, data);
      };

      // By region (prefer region override, fallback to regionName)
      const region = account.region || account.regionName || "Unknown";
      addToSegment(byRegion, region);

      // By industry
      if (account.industry) {
        addToSegment(byIndustry, account.industry);
      }

      // By territory
      if (account.territory) {
        addToSegment(byTerritory, account.territory);
      }

      // By segment
      if (account.segment) {
        addToSegment(bySegment, account.segment);
      }

      // By sub-segment
      if (account.subSegment) {
        addToSegment(bySubSegment, account.subSegment);
      }

      // By enterprise status
      const entKey = account.isEnterprise ? "Enterprise" : "Non-Enterprise";
      addToSegment(byEnterprise, entKey);
    }

    // Convert maps to sorted arrays
    const mapToSegments = (
      map: Map<string, { count: number; arr: number; accounts: Set<string> }>,
      prefix: string = "",
    ) =>
      Array.from(map.entries())
        .map(([name, data]) => ({
          name: prefix ? `${prefix}: ${name}` : name,
          highSeverityCount: data.count,
          arr: data.arr,
          accountCount: data.accounts.size,
        }))
        .sort((a, b) => b.arr - a.arr);

    const enterpriseSegments = mapToSegments(byEnterprise);
    const regionSegments = mapToSegments(byRegion, "Region");
    const industrySegments = mapToSegments(byIndustry, "Industry");
    const territorySegments = mapToSegments(byTerritory, "Territory");
    const segmentSegments = mapToSegments(bySegment, "Segment");
    const subSegmentSegments = mapToSegments(bySubSegment, "Sub-Segment");

    // Combine all segments, prioritizing enterprise and top items from each category
    return {
      segments: [
        ...enterpriseSegments,
        ...regionSegments.slice(0, 3),
        ...industrySegments.slice(0, 3),
        ...territorySegments.slice(0, 3),
        ...segmentSegments.slice(0, 3),
        ...subSegmentSegments.slice(0, 3),
      ],
    };
  },
});

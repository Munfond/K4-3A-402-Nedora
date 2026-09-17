import { tool } from "ai";
import { z } from "zod";
import { db } from "@feedback/db";

export { areaInsightTools } from "../../tools/area-insights";
export type { AreaInsightsContext } from "../../tools/area-insights";

export type AnalyticsToolContext = {
  getOpenRequests?: (areaSlug: string) => Promise<unknown[]>;
  getFeedbackForRequests?: (requestIds: string[]) => Promise<unknown[]>;
  getAccountsByIds?: (accountIds: string[]) => Promise<unknown[]>;
  getOpportunitiesByIds?: (opportunityIds: string[]) => Promise<unknown[]>;
  getStatusDistribution?: (areaSlug: string) => Promise<unknown>;
};

export const defaultGetOpenRequests = async (
  areaSlug: string,
): Promise<unknown[]> => {
  const area = await db.query.areas.findFirst({
    where: (areas, { eq }) => eq(areas.slug, areaSlug),
    columns: { id: true, name: true, slug: true },
  });

  if (!area) return [];

  const requests = await db.query.requests.findMany({
    where: (requests, { eq }) => eq(requests.status, "open"),
    columns: {
      id: true,
      slug: true,
      title: true,
      description: true,
      status: true,
      areaIds: true,
      createdAt: true,
      updatedAt: true,
    },
    limit: 200,
  });

  return requests.filter((r) => r.areaIds.includes(area.id));
};

export const defaultGetFeedbackForRequests = async (
  requestIds: string[],
): Promise<unknown[]> => {
  if (requestIds.length === 0) return [];

  return db.query.feedback.findMany({
    where: (feedback, { inArray }) => inArray(feedback.requestId, requestIds),
    columns: {
      id: true,
      requestId: true,
      accountId: true,
      severity: true,
      createdAt: true,
      opportunityId: true,
    },
  });
};

export const defaultGetAccountsByIds = async (
  accountIds: string[],
): Promise<unknown[]> => {
  if (accountIds.length === 0) return [];

  return db.query.sfdcAccounts.findMany({
    where: (accounts, { inArray }) => inArray(accounts.id, accountIds),
    columns: {
      id: true,
      name: true,
      arr: true,
      isEnterprise: true,
      regionName: true,
      type: true,
    },
  });
};

export const defaultGetOpportunitiesByIds = async (
  opportunityIds: string[],
): Promise<unknown[]> => {
  if (opportunityIds.length === 0) return [];

  return db.query.sfdcOpportunities.findMany({
    where: (opportunities, { inArray }) =>
      inArray(opportunities.id, opportunityIds),
    columns: {
      id: true,
      accountId: true,
      name: true,
      arr: true,
      stage: true,
      closeDate: true,
    },
  });
};

export const defaultGetStatusDistribution = async (
  areaSlug: string,
): Promise<unknown> => {
  const area = await db.query.areas.findFirst({
    where: (areas, { eq }) => eq(areas.slug, areaSlug),
    columns: { id: true },
  });

  if (!area) {
    return { open: 0, shipped: 0, deprioritized: 0, shippedPercentage: 0 };
  }

  const allRequests = await db.query.requests.findMany({
    columns: { status: true, areaIds: true },
  });

  const areaRequests = allRequests.filter((r) => r.areaIds.includes(area.id));
  const openCount = areaRequests.filter((r) => r.status === "open").length;
  const shippedCount = areaRequests.filter(
    (r) => r.status === "shipped",
  ).length;
  const deprioritizedCount = areaRequests.filter(
    (r) => r.status === "deprioritized",
  ).length;
  const relevantTotal = openCount + shippedCount;

  return {
    open: openCount,
    shipped: shippedCount,
    deprioritized: deprioritizedCount,
    shippedPercentage:
      relevantTotal > 0 ? Math.round((shippedCount / relevantTotal) * 100) : 0,
  };
};

export const defaultAnalyticsToolContext: AnalyticsToolContext = {
  getOpenRequests: defaultGetOpenRequests,
  getFeedbackForRequests: defaultGetFeedbackForRequests,
  getAccountsByIds: defaultGetAccountsByIds,
  getOpportunitiesByIds: defaultGetOpportunitiesByIds,
  getStatusDistribution: defaultGetStatusDistribution,
};

export const getOpenRequests = tool({
  description:
    "Get all open feature requests for a product area. Returns request details including title, description, and ID.",
  inputSchema: z.object({
    areaSlug: z.string().describe("The slug of the product area"),
  }),
  execute: async ({ areaSlug }, { experimental_context }) => {
    const ctx = experimental_context as AnalyticsToolContext;
    const fn = ctx.getOpenRequests ?? defaultGetOpenRequests;
    return fn(areaSlug);
  },
});

export const getFeedbackForRequests = tool({
  description:
    "Get customer feedback (pain points) for specific feature requests. Each feedback item includes severity, account, and timing.",
  inputSchema: z.object({
    requestIds: z
      .array(z.string())
      .describe("Array of request IDs to get feedback for"),
  }),
  execute: async ({ requestIds }, { experimental_context }) => {
    const ctx = experimental_context as AnalyticsToolContext;
    const fn = ctx.getFeedbackForRequests ?? defaultGetFeedbackForRequests;
    return fn(requestIds);
  },
});

export const getAccountDetails = tool({
  description:
    "Get account details including ARR, enterprise status, and region. Use to calculate revenue impact.",
  inputSchema: z.object({
    accountIds: z.array(z.string()).describe("Array of account IDs to fetch"),
  }),
  execute: async ({ accountIds }, { experimental_context }) => {
    const ctx = experimental_context as AnalyticsToolContext;
    const fn = ctx.getAccountsByIds ?? defaultGetAccountsByIds;
    return fn(accountIds);
  },
});

export const getOpportunityDetails = tool({
  description:
    "Get sales opportunity details including ARR, stage, and close date. Use to assess pipeline impact.",
  inputSchema: z.object({
    opportunityIds: z
      .array(z.string())
      .describe("Array of opportunity IDs to fetch"),
  }),
  execute: async ({ opportunityIds }, { experimental_context }) => {
    const ctx = experimental_context as AnalyticsToolContext;
    const fn = ctx.getOpportunitiesByIds ?? defaultGetOpportunitiesByIds;
    return fn(opportunityIds);
  },
});

export const getExecutionStatus = tool({
  description:
    "Get execution status for a product area showing open/shipped/deprioritized counts and ship rate percentage.",
  inputSchema: z.object({
    areaSlug: z.string().describe("The slug of the product area"),
  }),
  execute: async ({ areaSlug }, { experimental_context }) => {
    const ctx = experimental_context as AnalyticsToolContext;
    const fn = ctx.getStatusDistribution ?? defaultGetStatusDistribution;
    return fn(areaSlug);
  },
});

export const calculateArrImpact = tool({
  description:
    "Calculate total ARR impact from a set of accounts. Pass accounts data retrieved from getAccountDetails.",
  inputSchema: z.object({
    accounts: z
      .array(
        z.object({
          id: z.string(),
          arr: z.number().nullable(),
          isEnterprise: z.boolean().nullable(),
        }),
      )
      .describe("Array of account objects with arr field"),
    enterpriseOnly: z
      .boolean()
      .optional()
      .describe("Only count enterprise accounts"),
  }),
  execute: async ({ accounts, enterpriseOnly }) => {
    const filtered = enterpriseOnly
      ? accounts.filter((a) => a.isEnterprise)
      : accounts;

    const totalArr = filtered.reduce((sum, a) => sum + (a.arr ?? 0), 0);
    const enterpriseArr = accounts
      .filter((a) => a.isEnterprise)
      .reduce((sum, a) => sum + (a.arr ?? 0), 0);

    return {
      totalArr,
      enterpriseArr,
      accountCount: filtered.length,
      enterpriseCount: accounts.filter((a) => a.isEnterprise).length,
    };
  },
});

export const identifyDealbreakers = tool({
  description:
    "Identify dealbreaker requests: high-severity issues from enterprise accounts with significant ARR at risk. " +
    "Pass feedback and accounts data from previous tool calls.",
  inputSchema: z.object({
    feedback: z
      .array(
        z.object({
          requestId: z.string(),
          accountId: z.string(),
          severity: z.enum(["low", "medium", "high"]),
        }),
      )
      .describe("Feedback to analyze"),
    accounts: z
      .array(
        z.object({
          id: z.string(),
          arr: z.number().nullable(),
          isEnterprise: z.boolean().nullable(),
        }),
      )
      .describe("Account details"),
    requests: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          slug: z.string().nullable(),
        }),
      )
      .describe("Request details"),
  }),
  execute: async ({ feedback, accounts, requests }) => {
    const accountsById = new Map(accounts.map((a) => [a.id, a]));
    const requestsById = new Map(requests.map((r) => [r.id, r]));

    const requestMetrics = new Map<
      string,
      { arr: number; feedbackCount: number; enterpriseCount: number }
    >();

    for (const item of feedback) {
      if (item.severity !== "high") continue;

      const account = accountsById.get(item.accountId);
      if (!account?.isEnterprise) continue;

      const current = requestMetrics.get(item.requestId) ?? {
        arr: 0,
        feedbackCount: 0,
        enterpriseCount: 0,
      };

      current.arr += account.arr ?? 0;
      current.feedbackCount += 1;
      current.enterpriseCount += 1;

      requestMetrics.set(item.requestId, current);
    }

    const dealbreakers = [...requestMetrics.entries()]
      .map(([requestId, metrics]) => {
        const request = requestsById.get(requestId);
        return {
          requestId,
          title: request?.title ?? "Unknown",
          slug: request?.slug ?? requestId,
          ...metrics,
        };
      })
      .sort((a, b) => b.arr - a.arr);

    const totalArr = dealbreakers.reduce((sum, d) => sum + d.arr, 0);

    return {
      count: dealbreakers.length,
      totalArr,
      topItems: dealbreakers.slice(0, 10),
    };
  },
});

export const analyticsTools = {
  getOpenRequests,
  getFeedbackForRequests,
  getAccountDetails,
  getOpportunityDetails,
  getExecutionStatus,
  calculateArrImpact,
  identifyDealbreakers,
};

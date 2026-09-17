// Types for the context snapshot (mirrored from www/lib/area-insights/context.ts)
export interface OpenRequest {
  id: string;
  slug: string | null;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackData {
  id: string;
  requestId: string;
  accountId: string;
  severity: "low" | "medium" | "high";
  createdAt: string;
  opportunityId: string | null;
}

export interface AccountData {
  id: string;
  name: string;
  arr: number | null;
  isEnterprise: boolean | null;
  regionName: string | null;
  type: string | null;
  // Salesforce segment fields (from Snowflake via Verceforce)
  industry: string | null;
  territory: string | null;
  segment: string | null;
  subSegment: string | null;
  region: string | null; // Snowflake-derived region (override > base)
  salesType: string | null;
}

export interface StatusDistribution {
  open: number;
  shipped: number;
  deprioritized: number;
  shippedPercentage: number;
}

export interface OpportunityData {
  id: string;
  accountId: string;
  name: string;
  arr: number | null;
  stage: string | null;
  closeDate: Date | null;
}

export interface AreaInsightsContext {
  areaId: string;
  areaSlug: string;
  areaName: string;
  openRequests: OpenRequest[];
  allFeedback: FeedbackData[];
  accountsById: Map<string, AccountData>;
  opportunitiesById: Map<string, OpportunityData>;
  feedbackByRequestId: Map<string, FeedbackData[]>;
  requestById: Map<string, OpenRequest>;
  // Execution status (includes shipped/deprioritized)
  statusDistribution: StatusDistribution;
}

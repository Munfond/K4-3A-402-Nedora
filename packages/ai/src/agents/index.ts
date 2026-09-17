/**
 * Agent - The AI Agent for GTM Feedback
 *
 * Usage:
 * ```ts
 * import { agent } from "@feedback/ai/agents";
 *
 * const match = await agent.request.generate({
 *   customerPain: "Users can't export data to CSV",
 * });
 *
 * // Or create a custom instance with overrides
 * import { createAgent } from "@feedback/ai/agents";
 *
 * const myAgent = createAgent({
 *   slack: {
 *     fetchThreadMessages: async (channel, ts) => slackClient.getThread(channel, ts),
 *   },
 * });
 * ```
 */

import { createSlackAgent } from "./slack";
import { createRequestAgent } from "./requests";
import { createSearchAgent } from "./search";
import { createAnalyticsAgent } from "./analytics";
import { createIdentityAgent } from "./identity";

import { type SlackToolContext, defaultSlackToolContext } from "./slack/tools";
import {
  type RequestToolContext,
  defaultRequestToolContext,
} from "./requests/tools";
import {
  type SearchToolContext,
  defaultSearchToolContext,
} from "./search/tools";
import {
  type AnalyticsToolContext,
  defaultAnalyticsToolContext,
} from "./analytics/tools";

import type { Agent as AgentType } from "./types";

export interface AgentContext {
  slack?: Partial<SlackToolContext>;
  request?: Partial<RequestToolContext>;
  search?: Partial<SearchToolContext>;
  analytics?: Partial<AnalyticsToolContext>;
}

export function createAgent(overrides: AgentContext = {}): AgentType {
  const slackContext: SlackToolContext = {
    ...defaultSlackToolContext,
    ...overrides.slack,
  };

  const requestContext: RequestToolContext = {
    ...defaultRequestToolContext,
    ...overrides.request,
  };

  const searchContext: SearchToolContext = {
    ...defaultSearchToolContext,
    ...overrides.search,
  };

  const analyticsContext: AnalyticsToolContext = {
    ...defaultAnalyticsToolContext,
    ...overrides.analytics,
  };

  return {
    slack: createSlackAgent(slackContext),
    request: createRequestAgent(requestContext),
    search: createSearchAgent(searchContext),
    analytics: createAnalyticsAgent(analyticsContext),
    identity: createIdentityAgent(),
  };
}

export const agent = createAgent();

// Types
export type {
  Agent,
  AgentResult,
  AgentSlack,
  SlackMode,
  SlackGenerateInput,
  SlackChatInput,
  SlackGenerateOutput,
  SlackChatOutput,
  SlackExtractionOutput,
  SlackComposeOutput,
  SlackRef,
  AgentRequest,
  RequestGenerateInput,
  RequestGenerateOutput,
  RequestMatchOutput,
  RequestCreateOutput,
  RequestMatchOrCreateOutput,
  RequestRelatedOutput,
  AgentSearch,
  SearchGenerateInput,
  SearchGenerateOutput,
  SearchMatch,
  AgentAnalytics,
  AnalyticsGenerateInput,
  AnalyticsGenerateOutput,
  AnalyticsSection,
  AnalyticsScope,
  AgentIdentity,
  IdentityGenerateInput,
  IdentityGenerateOutput,
} from "./types";

export type { SlackToolContext } from "./slack/tools";
export type { RequestToolContext } from "./requests/tools";
export type { SearchToolContext } from "./search/tools";
export type { AnalyticsToolContext } from "./analytics/tools";

export { defaultSlackToolContext } from "./slack/tools";
export { defaultRequestToolContext } from "./requests/tools";
export { defaultSearchToolContext } from "./search/tools";
export { defaultAnalyticsToolContext } from "./analytics/tools";

export { createSlackAgent } from "./slack";
export { createRequestAgent } from "./requests";
export { createSearchAgent } from "./search";
export { createAnalyticsAgent } from "./analytics";
export { createIdentityAgent } from "./identity";

export { slackTools } from "./slack/tools";
export { requestTools } from "./requests/tools";
export { searchTools } from "./search/tools";
export { analyticsTools } from "./analytics/tools";
export { identityTools } from "./identity/tools";

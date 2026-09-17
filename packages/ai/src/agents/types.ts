import type { ModelMessage, StreamTextResult } from "ai";

export interface AgentResult<T> {
  output: T;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  steps?: number;
}

export type SlackRef =
  | { channel: string; threadTs: string }
  | { channel: string; ts: string };

export type AnalyticsScope =
  | { type: "area"; slug: string }
  | { type: "request"; id: string };

// Slack types

export type SlackMode = "extract" | "chat" | "compose";

export interface SlackGenerateInput {
  mode?: SlackMode;
  ref?: SlackRef;
  messages?: unknown[];
  composeType?:
    | "match_notification"
    | "proposal"
    | "created_confirmation"
    | "dm_notification"
    | "shipped_notification"
    | "shipped_ephemeral"
    | "approval_request"
    | "approval_followup"
    | "high_confidence_match";
  composeContext?: {
    requestUrl?: string;
    requestTitle?: string;
    summary?: string;
    matched?: boolean;
    customerPain?: string;
  };
}

export interface SlackChatInput {
  messages: ModelMessage[];
  isDirectMessage?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: Record<string, any>;
  getActiveTools?: () => string[];
  /** Context passed to tools via experimental_context */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context?: Record<string, any>;
}

export interface SlackExtractionOutput {
  type: "extraction";
  summary?: string;
  painDescription: string;
  isCustomerSpecific: boolean;
  source: "message" | "thread" | "messages";
}

export interface SlackComposeOutput {
  type: "compose";
  message: string;
}

export type SlackGenerateOutput = SlackExtractionOutput | SlackComposeOutput;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SlackChatOutput = StreamTextResult<any, any>;

// Request types

export interface RequestGenerateInput {
  customerPain?: string;
  candidates?: Array<{
    id: string;
    title: string;
    description: string;
    areaIds?: string[];
  }>;
  productAreas?: Array<{ id: string; name: string }>;
  requestId?: string;
  mode?: "match" | "create" | "match_or_create" | "find_related";
}

export interface RequestMatchOutput {
  type: "match";
  requestId: string | null;
  confidence: number;
  reason?: string;
}

export interface RequestCreateOutput {
  type: "create";
  title: string;
  description: string;
  areaIds: string[];
}

export interface RequestMatchOrCreateOutput {
  type: "match_or_create";
  decision: "matched" | "created";
  requestId?: string | null;
  confidence?: number;
  title?: string;
  description?: string;
  areaIds?: string[];
  reason?: string;
}

export interface RequestRelatedOutput {
  type: "find_related";
  relatedRequestId: string | null;
  confidence: number;
  reason?: string;
}

export type RequestGenerateOutput =
  | RequestMatchOutput
  | RequestCreateOutput
  | RequestMatchOrCreateOutput
  | RequestRelatedOutput;

// Search types

export interface SearchGenerateInput {
  query: string;
  candidates?: Array<{
    id: string;
    title: string;
    description: string;
    areaIds?: string[];
  }>;
  context?: string;
  scope?: {
    areaIds?: string[];
  };
}

export interface SearchMatch {
  requestId: string;
  title: string;
  description: string;
  confidence: number;
  reason?: string;
}

export interface SearchGenerateOutput {
  matches: SearchMatch[];
}

// Identity types

export interface IdentityGenerateInput {
  email: string;
}

export interface IdentityGenerateOutput {
  userId: string | null;
  confidence: number;
  reason?: string;
}

// Analytics types

export interface AnalyticsGenerateInput {
  scope: AnalyticsScope;
}

export interface AnalyticsSection {
  id: string;
  title: string;
  summary: string;
  importance: "info" | "warning" | "critical";
  visuals: Array<{
    kind: string;
    props: Record<string, unknown>;
  }>;
}

export interface AnalyticsGenerateOutput {
  generatedAt: string;
  sections: AnalyticsSection[];
}

// Agent interfaces

export interface AgentSlack {
  generate(
    input: SlackGenerateInput,
  ): Promise<AgentResult<SlackGenerateOutput>>;
  chat(input: SlackChatInput): Promise<SlackChatOutput>;
}

export interface AgentRequest {
  generate(
    input: RequestGenerateInput,
  ): Promise<AgentResult<RequestGenerateOutput>>;
}

export interface AgentSearch {
  generate(
    input: SearchGenerateInput,
  ): Promise<AgentResult<SearchGenerateOutput>>;
}

export interface AgentAnalytics {
  generate(
    input: AnalyticsGenerateInput,
  ): Promise<AgentResult<AnalyticsGenerateOutput>>;
}

export interface AgentIdentity {
  generate(
    input: IdentityGenerateInput,
  ): Promise<AgentResult<IdentityGenerateOutput>>;
}

export interface Agent {
  slack: AgentSlack;
  request: AgentRequest;
  search: AgentSearch;
  analytics: AgentAnalytics;
  identity: AgentIdentity;
}

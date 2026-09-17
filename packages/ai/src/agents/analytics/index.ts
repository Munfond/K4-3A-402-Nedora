import { Output, ToolLoopAgent } from "ai";
import { z } from "zod";
import { claudeSonnet } from "../../models";
import {
  analyticsTools,
  defaultAnalyticsToolContext,
  type AnalyticsToolContext,
} from "./tools";
import { ANALYTICS_INSTRUCTIONS } from "./prompts";
import type {
  AnalyticsGenerateInput,
  AnalyticsGenerateOutput,
  AnalyticsScope,
  AgentAnalytics,
  AgentResult,
} from "../types";

const insightVisualKindSchema = z.enum([
  "dealbreakers-metric",
  "segment-breakdown",
  "themes-list",
  "status-metric",
  "severity-distribution",
  "top-requests-list",
]);

const insightVisualSchema = z.object({
  kind: insightVisualKindSchema,
  props: z
    .record(z.string(), z.unknown())
    .describe("Props to pass to the visual component"),
});

const insightImportanceSchema = z.enum(["info", "warning", "critical"]);

const insightSectionSchema = z.object({
  id: z.string().describe("Machine name for this section"),
  title: z.string().describe("Human-friendly title"),
  summary: z.string().describe("1-2 sentence summary, concise and actionable"),
  importance: insightImportanceSchema.describe(
    "How urgent/important this section is",
  ),
  visuals: z.array(insightVisualSchema).describe("Visual components to render"),
});

const analyticsOutputSchema = z.object({
  generatedAt: z
    .string()
    .describe("ISO timestamp when this report was generated"),
  sections: z
    .array(insightSectionSchema)
    .max(4)
    .describe("Up to 4 insight sections"),
});

function createAgent(context: AnalyticsToolContext) {
  return new ToolLoopAgent({
    model: claudeSonnet,
    tools: analyticsTools,
    instructions: ANALYTICS_INSTRUCTIONS,
    experimental_context: context,
    output: Output.object({ schema: analyticsOutputSchema }),
  });
}

function buildPrompt(scope: AnalyticsScope, generatedAt: string): string {
  if (scope.type === "area") {
    return `Generate an analytics report for product area: "${scope.slug}"

Start by calling getOpenRequests("${scope.slug}") to get open feature requests.
Then gather entries, accounts, and calculate metrics using the available tools.
Finally, use identifyDealbreakers and getExecutionStatus to build the report.

Use generatedAt: "${generatedAt}"`;
  }

  return `Generate an analytics report for feature request: "${scope.id}"

Gather entries and account data for this request using the available tools.
Focus on ARR impact and customer segments affected.

Use generatedAt: "${generatedAt}"`;
}

export function createAnalyticsAgent(
  overrides: AnalyticsToolContext = {},
): AgentAnalytics {
  const context: AnalyticsToolContext = {
    ...defaultAnalyticsToolContext,
    ...overrides,
  };

  return {
    async generate(
      input: AnalyticsGenerateInput,
    ): Promise<AgentResult<AnalyticsGenerateOutput>> {
      const generatedAt = new Date().toISOString();
      const agent = createAgent(context);
      const prompt = buildPrompt(input.scope, generatedAt);

      const result = await agent.generate({ prompt });

      return {
        output: result.output,
        usage: {
          inputTokens: result.usage?.inputTokens ?? 0,
          outputTokens: result.usage?.outputTokens ?? 0,
        },
        steps: result.steps.length,
      };
    },
  };
}

export { analyticsTools, type AnalyticsToolContext } from "./tools";

import { ToolLoopAgent, Output } from "ai";
import { z } from "zod";
import { claudeSonnet } from "../models";
import { areaInsightTools } from "../tools/area-insights";
import type { AreaInsightsContext } from "../tools/area-insights/types";

// Schema for the Area Insights report structure
const insightVisualKindSchema = z.enum(
  [
    "dealbreakers-metric",
    "segment-breakdown",
    "themes-list",
    "status-metric",
    "severity-distribution",
    "top-requests-list",
  ],
  { message: "Invalid visual kind" },
);

const insightVisualSchema = z.object({
  kind: insightVisualKindSchema,
  props: z
    .record(z.string(), z.unknown())
    .describe("Props to pass to the visual component"),
});

const insightImportanceSchema = z.enum(["info", "warning", "critical"], {
  message: "Invalid importance level",
});

const insightSectionIdSchema = z.enum(
  ["dealbreakers", "segments", "themes", "execution"],
  { message: "Invalid section id" },
);

const insightSectionSchema = z.object({
  id: insightSectionIdSchema.describe("Machine name for this section"),
  title: z
    .string()
    .describe("Human-friendly title, e.g. 'Critical Dealbreakers'"),
  summary: z.string().describe("1-2 sentence summary, concise and actionable"),
  importance: insightImportanceSchema.describe(
    "How urgent/important this section is",
  ),
  visuals: z.array(insightVisualSchema).describe("Visual components to render"),
});

export const areaInsightsReportSchema = z.object({
  areaId: z.string().describe("The UUID of the product area"),
  slug: z.string().describe("The slug of the product area"),
  generatedAt: z
    .string()
    .describe("ISO timestamp when this report was generated"),
  sections: z
    .array(insightSectionSchema)
    .max(4)
    .describe("Up to 4 insight sections for this area"),
});

const AREA_INSIGHTS_INSTRUCTIONS = `You are a product analytics strategist analyzing OPEN feature requests for a single product area.

Your job is to produce a concise AreaInsightsReport with up to 4 sections that help Product Managers understand and prioritize their work.

Available sections (use the section id as shown):
1. "dealbreakers" - Critical issues blocking revenue. Use when there are high-severity requests from enterprise accounts.
   - Title examples: "Critical Dealbreakers", "Revenue at Risk"
   - Use visual kind: "dealbreakers-metric"
   - Props MUST include exactly these keys: count (number), totalArr (number), topItems (array with slug, title, arr, entryCount)

2. "segments" - Which customer segments feel the most pain. Use when there's meaningful segment data.
   - Title examples: "Who's Feeling the Pain", "Impact by Segment"
   - Use visual kind: "segment-breakdown"
   - Props MUST include exactly these keys: segments (array with name, highSeverityCount, arr, accountCount)

3. "themes" - Recurring patterns of confusion or friction. Use when you can identify patterns across requests.
   - Title examples: "Common Themes", "Recurring Friction Points"
   - Use visual kind: "themes-list"
   - Props MUST include exactly these keys: themes (array with name, count, exampleRequests)
   - IMPORTANT: exampleRequests must be an array of objects with { slug, title } - use the EXACT slugs from the data provided, never make up slugs

4. "execution" - How well this area is executing (status mix, velocity).
   - Title examples: "Execution Status", "Delivery Snapshot"
   - Use visual kind: "status-metric"
   - Props MUST include exactly these keys: open (number), shipped (number), deprioritized (number), shipRate (number)

Guidelines:
- Analyze the data provided in the prompt to identify key insights
- Be opinionated: highlight what matters most, don't just dump data
- Keep summaries to 1-2 sentences max, no fluff or hedging
- Set importance to "critical" only for dealbreakers with significant ARR (>$500k)
- Set importance to "warning" for concerning patterns that need attention
- Set importance to "info" for general status updates
- If a section has no meaningful data (e.g., no dealbreakers), skip it entirely
- Order sections by importance (critical first, then warning, then info)
- The areaId, slug, and generatedAt will be provided - use them exactly in the output

CRITICAL REQUIREMENT FOR SLUGS:
- When referencing requests (in topItems, exampleRequests, etc.), you MUST use the EXACT slugs provided in the data
- The slugs are provided in the format [slug: xxx] - extract and use these exact values
- NEVER invent or guess slugs - only use slugs that appear in the data
- Each request in the data has a unique slug - match the slug to its corresponding title exactly`;

/**
 * Creates an Area Insights Agent configured with the provided context.
 *
 * Analyzes OPEN feature requests for a product area and produces
 * a structured insights report with up to 4 sections.
 *
 * The agent has access to tools that operate on a pre-fetched context
 * containing all open requests, entries, and account data.
 */
export function createAreaInsightsAgent(context: AreaInsightsContext) {
  return new ToolLoopAgent({
    model: claudeSonnet,
    tools: areaInsightTools,
    instructions: AREA_INSIGHTS_INSTRUCTIONS,
    experimental_context: context,
    output: Output.object({
      schema: areaInsightsReportSchema,
    }),
  });
}

// Re-export types for consumers
export type AreaInsightsReport = z.infer<typeof areaInsightsReportSchema>;
export type InsightSection = z.infer<typeof insightSectionSchema>;
export type InsightVisual = z.infer<typeof insightVisualSchema>;

import { Output, ToolLoopAgent } from "ai";
import { z } from "zod";
import { claudeHaiku } from "../../models";
import { searchTools, type SearchToolContext } from "./tools";
import { SEARCH_INSTRUCTIONS } from "./prompts";
import type {
  AgentResult,
  AgentSearch,
  SearchGenerateInput,
  SearchGenerateOutput,
} from "../types";

const searchOutputSchema = z.object({
  matches: z
    .array(
      z.object({
        requestId: z.string().describe("The matching request ID"),
        title: z.string().describe("The request title"),
        description: z.string().describe("The request description"),
        confidence: z
          .number()
          .min(0)
          .max(1)
          .describe("Confidence score from 0.0 to 1.0"),
        reason: z
          .string()
          .optional()
          .describe("Brief explanation of why this matches"),
      }),
    )
    .describe("Matches ordered by highest confidence first"),
});

function createInternalSearchAgent(
  context: SearchToolContext,
  hasTools: boolean,
) {
  return new ToolLoopAgent({
    model: claudeHaiku,
    tools: hasTools ? searchTools : undefined,
    instructions: SEARCH_INSTRUCTIONS,
    experimental_context: context,
    output: Output.object({ schema: searchOutputSchema }),
  });
}

function formatCandidates(
  candidates: NonNullable<SearchGenerateInput["candidates"]>,
): string {
  return candidates
    .map(
      (c) =>
        `- ID: ${c.id}\n  Title: ${c.title}\n  Description: ${c.description}`,
    )
    .join("\n\n");
}

export function createSearchAgent(
  context: SearchToolContext = {},
): AgentSearch {
  return {
    async generate(
      input: SearchGenerateInput,
    ): Promise<AgentResult<SearchGenerateOutput>> {
      const hasTools = !input.candidates;
      const agent = createInternalSearchAgent(context, hasTools);

      let prompt = `Search Query:\n${input.query}`;

      if (input.context) {
        prompt += `\n\nContext: ${input.context}`;
      }

      if (input.candidates) {
        prompt += `\n\nAvailable Requests:\n${formatCandidates(input.candidates)}`;
      } else {
        prompt += `\n\nUse searchRequests tool to find matching requests.`;
      }

      if (input.scope?.areaIds?.length) {
        prompt += `\n\nFilter to these product areas: ${input.scope.areaIds.join(", ")}`;
      }

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

export { searchTools, type SearchToolContext } from "./tools";

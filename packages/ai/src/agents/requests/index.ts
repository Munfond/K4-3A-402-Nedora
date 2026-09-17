import { Output, ToolLoopAgent } from "ai";
import { z } from "zod";
import { claudeHaiku } from "../../models";
import { requestTools, type RequestToolContext } from "./tools";
import {
  MATCH_INSTRUCTIONS,
  CREATE_INSTRUCTIONS,
  MATCH_OR_CREATE_INSTRUCTIONS,
  RELATED_INSTRUCTIONS,
} from "./prompts";
import type {
  RequestGenerateInput,
  RequestGenerateOutput,
  AgentRequest,
  AgentResult,
} from "../types";

const matchOutputSchema = z.object({
  requestId: z
    .string()
    .nullable()
    .describe("The ID of the matching request, or null if no match"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence score from 0.0 to 1.0"),
  reason: z.string().optional().describe("Explanation for the match decision"),
});

const createOutputSchema = z.object({
  title: z.string().min(5).max(200).describe("Feature request title"),
  description: z
    .string()
    .min(10)
    .max(1000)
    .describe("Feature request description"),
  areaIds: z
    .array(z.string())
    .min(1)
    .describe("Product area IDs this relates to"),
});

const matchOrCreateOutputSchema = z.object({
  decision: z.enum(["matched", "created"]).describe("What action was taken"),
  requestId: z
    .string()
    .nullable()
    .optional()
    .describe("Matched request ID (if matched)"),
  confidence: z.number().optional().describe("Match confidence (if matched)"),
  title: z.string().optional().describe("New title (if created)"),
  description: z.string().optional().describe("New description (if created)"),
  areaIds: z.array(z.string()).optional().describe("Area IDs (if created)"),
  reason: z.string().optional().describe("Explanation for the decision"),
});

const relatedOutputSchema = z.object({
  relatedRequestId: z
    .string()
    .nullable()
    .describe("ID of related request, or null if none found"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence score for the relation"),
  reason: z.string().optional().describe("Why this request is related"),
});

function createMatchAgent(context: RequestToolContext, hasTools: boolean) {
  return new ToolLoopAgent({
    model: claudeHaiku,
    tools: hasTools ? requestTools : undefined,
    instructions: MATCH_INSTRUCTIONS,
    experimental_context: context,
    output: Output.object({ schema: matchOutputSchema }),
  });
}

function createCreateRequestAgent(
  context: RequestToolContext,
  hasTools: boolean,
) {
  return new ToolLoopAgent({
    model: claudeHaiku,
    tools: hasTools ? requestTools : undefined,
    instructions: CREATE_INSTRUCTIONS,
    experimental_context: context,
    output: Output.object({ schema: createOutputSchema }),
  });
}

function createMatchOrCreateRequestAgent(
  context: RequestToolContext,
  hasTools: boolean,
) {
  return new ToolLoopAgent({
    model: claudeHaiku,
    tools: hasTools ? requestTools : undefined,
    instructions: MATCH_OR_CREATE_INSTRUCTIONS,
    experimental_context: context,
    output: Output.object({ schema: matchOrCreateOutputSchema }),
  });
}

function createRelatedRequestAgent(
  context: RequestToolContext,
  hasTools: boolean,
) {
  return new ToolLoopAgent({
    model: claudeHaiku,
    tools: hasTools ? requestTools : undefined,
    instructions: RELATED_INSTRUCTIONS,
    experimental_context: context,
    output: Output.object({ schema: relatedOutputSchema }),
  });
}

function inferMode(
  input: RequestGenerateInput,
): "match" | "create" | "match_or_create" | "find_related" {
  if (input.mode) return input.mode;
  if (input.requestId) return "find_related";
  if (input.candidates && input.customerPain) return "match";
  if (input.productAreas && input.customerPain && !input.candidates)
    return "create";
  if (input.customerPain) return "match_or_create";
  throw new Error(
    "Cannot infer mode: provide mode, requestId, or customerPain",
  );
}

function formatCandidates(
  candidates: NonNullable<RequestGenerateInput["candidates"]>,
): string {
  return candidates
    .map(
      (c) =>
        `- ID: ${c.id}\n  Title: ${c.title}\n  Description: ${c.description}`,
    )
    .join("\n\n");
}

function formatProductAreas(
  areas: NonNullable<RequestGenerateInput["productAreas"]>,
): string {
  return areas.map((a) => `- ID: ${a.id}\n  Name: ${a.name}`).join("\n\n");
}

export function createRequestAgent(
  context: RequestToolContext = {},
): AgentRequest {
  return {
    async generate(
      input: RequestGenerateInput,
    ): Promise<AgentResult<RequestGenerateOutput>> {
      const mode = inferMode(input);
      let hasTools: boolean;

      if (mode === "match") {
        hasTools = !input.candidates;
      } else if (mode === "create") {
        hasTools = !input.productAreas;
      } else if (mode === "match_or_create") {
        hasTools = !input.candidates || !input.productAreas;
      } else {
        // find_related
        hasTools = !!input.requestId;
      }

      if (mode === "match") {
        const agent = createMatchAgent(context, hasTools);

        let prompt = `Customer Pain Description:\n${input.customerPain}`;
        if (input.candidates) {
          prompt += `\n\nAvailable Requests:\n${formatCandidates(input.candidates)}`;
        } else {
          prompt += `\n\nUse getCandidateRequests to find potential matches.`;
        }

        const result = await agent.generate({ prompt });

        return {
          output: { type: "match", ...result.output },
          usage: {
            inputTokens: result.usage?.inputTokens ?? 0,
            outputTokens: result.usage?.outputTokens ?? 0,
          },
          steps: result.steps.length,
        };
      }

      if (mode === "create") {
        const agent = createCreateRequestAgent(context, hasTools);

        let prompt = `Customer Pain: ${input.customerPain}`;
        if (input.productAreas) {
          prompt += `\n\nAvailable Product Areas:\n${formatProductAreas(input.productAreas)}`;
        } else {
          prompt += `\n\nUse getProductAreas to fetch available areas.`;
        }

        const result = await agent.generate({ prompt });

        return {
          output: { type: "create", ...result.output },
          usage: {
            inputTokens: result.usage?.inputTokens ?? 0,
            outputTokens: result.usage?.outputTokens ?? 0,
          },
          steps: result.steps.length,
        };
      }

      if (mode === "match_or_create") {
        const agent = createMatchOrCreateRequestAgent(context, hasTools);

        let prompt = `Customer Pain: ${input.customerPain}`;
        if (input.candidates) {
          prompt += `\n\nAvailable Requests:\n${formatCandidates(input.candidates)}`;
        }
        if (input.productAreas) {
          prompt += `\n\nAvailable Product Areas:\n${formatProductAreas(input.productAreas)}`;
        }
        if (!input.candidates || !input.productAreas) {
          prompt += `\n\nUse tools to fetch any missing data.`;
        }

        const result = await agent.generate({ prompt });

        return {
          output: { type: "match_or_create", ...result.output },
          usage: {
            inputTokens: result.usage?.inputTokens ?? 0,
            outputTokens: result.usage?.outputTokens ?? 0,
          },
          steps: result.steps.length,
        };
      }

      if (mode === "find_related") {
        const agent = createRelatedRequestAgent(context, hasTools);

        let prompt = `Find related requests for request ID: ${input.requestId}`;
        if (input.candidates) {
          prompt += `\n\nCandidate Related Requests:\n${formatCandidates(input.candidates)}`;
        } else {
          prompt += `\n\nUse getRequestById to get the request details, then getCandidateRequests to find candidates.`;
        }

        const result = await agent.generate({ prompt });

        return {
          output: { type: "find_related", ...result.output },
          usage: {
            inputTokens: result.usage?.inputTokens ?? 0,
            outputTokens: result.usage?.outputTokens ?? 0,
          },
          steps: result.steps.length,
        };
      }

      throw new Error(`Unknown mode: ${mode}`);
    },
  };
}

export { requestTools, type RequestToolContext } from "./tools";

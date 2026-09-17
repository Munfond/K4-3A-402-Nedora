import { Output, ToolLoopAgent, stepCountIs } from "ai";
import { z } from "zod";
import { gpt4oMini } from "../../models";
import { slackTools, type SlackToolContext } from "./tools";
import {
  EXTRACTION_INSTRUCTIONS,
  COMPOSE_INSTRUCTIONS,
  CHAT_INSTRUCTIONS,
} from "./prompts";
import type {
  AgentResult,
  AgentSlack,
  SlackGenerateInput,
  SlackGenerateOutput,
  SlackChatOutput,
  SlackChatInput,
  SlackRef,
} from "../types";

const extractionOutputSchema = z.object({
  summary: z
    .string()
    .optional()
    .describe("Summary of the thread (for multi-message threads)"),
  painDescription: z
    .string()
    .describe("The extracted pain point or feature request"),
  isCustomerSpecific: z
    .boolean()
    .describe("Whether this is tied to a specific customer"),
});

const composeOutputSchema = z.object({
  message: z.string().describe("The generated Slack message"),
});

function createExtractionAgent(context: SlackToolContext, hasTools: boolean) {
  return new ToolLoopAgent({
    model: gpt4oMini,
    tools: hasTools ? slackTools : undefined,
    instructions: EXTRACTION_INSTRUCTIONS,
    experimental_context: context,
    output: Output.object({ schema: extractionOutputSchema }),
  });
}

function createComposeAgent() {
  return new ToolLoopAgent({
    model: gpt4oMini,
    instructions: COMPOSE_INSTRUCTIONS,
    output: Output.object({ schema: composeOutputSchema }),
  });
}

function createChatAgent(input: SlackChatInput) {
  const instructions = input.isDirectMessage
    ? CHAT_INSTRUCTIONS
    : CHAT_INSTRUCTIONS.replace(
        /In direct messages only:[\s\S]*?don't mention it\./,
        "",
      );

  return new ToolLoopAgent({
    model: gpt4oMini,
    tools: input.tools,
    instructions,
    experimental_context: input.context,
    stopWhen: stepCountIs(5),
    prepareStep: () => ({
      activeTools: input.getActiveTools?.(),
    }),
  });
}

function inferMode(input: SlackGenerateInput): "extract" | "chat" | "compose" {
  if (input.mode) return input.mode;
  if (input.composeType) return "compose";
  if (input.messages) return "chat";
  if (input.ref) return "extract";
  throw new Error(
    "Cannot infer mode: provide mode, ref, messages, or composeType",
  );
}

function formatSlackRef(ref: SlackRef): string {
  if ("threadTs" in ref) {
    return `Thread in channel ${ref.channel} at ${ref.threadTs}`;
  }
  return `Message in channel ${ref.channel} at ${ref.ts}`;
}

function getComposePrompt(input: SlackGenerateInput): string {
  const ctx = input.composeContext || {};

  switch (input.composeType) {
    case "match_notification":
      return `Generate a natural Slack message letting someone know their thread matches an existing feature request.
Feature Request Title: ${ctx.requestTitle || "Unknown"}
Feature Request URL: ${ctx.requestUrl || ""}
Thread Summary: ${ctx.summary || ""}

Include the link as: <${ctx.requestUrl}|${ctx.requestTitle}>
Encourage them to add their feedback.`;

    case "proposal":
      return `Generate a friendly message explaining that no existing feedback was found and you can create a new feature request.
Thread Summary: ${ctx.summary || ""}

Do NOT include the title or description - those will be shown separately below your message.
Do NOT include any buttons or links - those will be added separately.`;

    case "created_confirmation":
      return `Generate a celebratory message that a feature request was created successfully.
Feature Request Title: ${ctx.requestTitle || ""}
Feature Request URL: ${ctx.requestUrl || ""}

Include the link as: <${ctx.requestUrl}|${ctx.requestTitle}>
Keep it to 1 sentence.`;

    case "dm_notification":
      return `Generate a friendly DM message about feedback being processed.
${ctx.matched ? "The user's feedback was matched to an existing feature request." : "A new feature request was created from the user's submission."}
Feature Request Title: ${ctx.requestTitle || ""}
Feature Request URL: ${ctx.requestUrl || ""}

Always mention that their feedback was added/created!
Include the link as: <${ctx.requestUrl}|View feature request>`;

    case "shipped_notification":
      return `Generate a celebratory DM message that a feature the user was following has shipped! 🎉
Feature Request Title: ${ctx.requestTitle || ""}
Feature Request URL: ${ctx.requestUrl || ""}

Thank them for their feedback and patience.
Include the link as: <${ctx.requestUrl}|View feature request>`;

    case "shipped_ephemeral":
      return `Generate a brief confirmation message for the person who just marked a feature request as shipped.
Feature Request Title: ${ctx.requestTitle || ""}

Keep it concise and celebratory (1-2 sentences max).`;

    case "approval_request":
      return `Generate a friendly, action-oriented message asking if the user wants to add their feedback to this existing feature request.
Customer Pain: ${ctx.customerPain || ""}
Feature Request Title: ${ctx.requestTitle || ""}
Feature Request URL: ${ctx.requestUrl || ""}

The message should:
- Be direct and action-oriented (focus on the action: "add your feedback to this feature request")
- NOT reiterate that you "found a match" - assume they already know this is a potential match
- Ask clearly: "Would you like to add your feedback to this existing feature request?"
- Be conversational and friendly
- Include the feature request title as a clickable link: <${ctx.requestUrl}|${ctx.requestTitle}>
- Be concise (1-2 sentences max)`;

    case "high_confidence_match":
      return `Generate a friendly, celebratory message that we found an existing feature request that matches the user's feedback with high confidence.
Feature Request Title: ${ctx.requestTitle || ""}
Feature Request URL: ${ctx.requestUrl || ""}

The system found an existing feature request that matches the user's customer pain with high confidence (>= 0.9), and automatically added their feedback to it.

Generate a message that:
- Celebrates that we were able to find this feature request
- Mentions that their feedback was automatically added
- Is casual and friendly (e.g., "Hey, we were able to find this feature request. Cool!")
- Encourages them to view the feature request
- Includes the link as: <${ctx.requestUrl}|View feature request>

Keep it concise and natural.`;

    default:
      throw new Error(`Unknown composeType: ${input.composeType}`);
  }
}

export function createSlackAgent(context: SlackToolContext = {}): AgentSlack {
  return {
    async chat(input: SlackChatInput): Promise<SlackChatOutput> {
      const agent = createChatAgent(input);

      return agent.stream({
        messages: input.messages,
      });
    },

    async generate(
      input: SlackGenerateInput,
    ): Promise<AgentResult<SlackGenerateOutput>> {
      const mode = inferMode(input);

      if (mode === "extract") {
        // If messages are provided directly, don't use tools
        if (input.messages && input.messages.length > 0) {
          const agent = createExtractionAgent(context, false);

          const formattedMessages = input.messages
            .map((msg, idx) => {
              const m = msg as { text?: string; user?: string };
              const text = m.text || "";
              const user = m.user ? `<@${m.user}>` : "Unknown";
              return `Message ${idx + 1} (${user}): ${text}`;
            })
            .join("\n\n");

          const result = await agent.generate({
            prompt: `Slack Messages:\n${formattedMessages}`,
          });

          return {
            output: {
              type: "extraction",
              ...result.output,
              source: input.messages.length > 1 ? "thread" : "message",
            },
            usage: {
              inputTokens: result.usage?.inputTokens ?? 0,
              outputTokens: result.usage?.outputTokens ?? 0,
            },
            steps: result.steps.length,
          };
        }

        if (!input.ref) {
          throw new Error("ref or messages is required for extract mode");
        }

        const agent = createExtractionAgent(context, true);
        const refDesc = formatSlackRef(input.ref);
        const ref = input.ref;
        const isThread = "threadTs" in ref;

        let fetchInstruction: string;
        if (isThread) {
          const threadRef = ref as { channel: string; threadTs: string };
          fetchInstruction = `Use getThreadMessages to fetch the thread messages from channel "${threadRef.channel}" with threadTs "${threadRef.threadTs}".`;
        } else {
          const msgRef = ref as { channel: string; ts: string };
          fetchInstruction = `This is a single message. Fetch it using the channel "${msgRef.channel}" and ts "${msgRef.ts}".`;
        }

        const result = await agent.generate({
          prompt: `Extract feedback from: ${refDesc}

${fetchInstruction}

After fetching, analyze and extract the pain point or feature request.`,
        });

        return {
          output: {
            type: "extraction",
            ...result.output,
            source: isThread ? "thread" : "message",
          },
          usage: {
            inputTokens: result.usage?.inputTokens ?? 0,
            outputTokens: result.usage?.outputTokens ?? 0,
          },
          steps: result.steps.length,
        };
      }

      if (mode === "compose") {
        if (!input.composeType) {
          throw new Error("composeType is required for compose mode");
        }

        const agent = createComposeAgent();
        const prompt = getComposePrompt(input);

        const result = await agent.generate({ prompt });

        return {
          output: { type: "compose", ...result.output },
          usage: {
            inputTokens: result.usage?.inputTokens ?? 0,
            outputTokens: result.usage?.outputTokens ?? 0,
          },
          steps: result.steps.length,
        };
      }

      if (mode === "chat") {
        throw new Error(
          "Chat mode uses streaming - use agent.slack.chat() instead",
        );
      }

      throw new Error(`Unknown Agent Slack mode: ${mode}`);
    },
  };
}

export { slackTools, type SlackToolContext } from "./tools";

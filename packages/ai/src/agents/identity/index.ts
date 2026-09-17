import { Output, ToolLoopAgent } from "ai";

import { claudeHaiku } from "../../models";
import type {
  AgentIdentity,
  AgentResult,
  IdentityGenerateInput,
  IdentityGenerateOutput,
} from "../types";

import { IDENTITY_MATCH_INSTRUCTIONS } from "./prompts";
import { identityTools, identityOutputSchema } from "./tools";

const identityAgent = new ToolLoopAgent({
  model: claudeHaiku,
  tools: identityTools,
  instructions: IDENTITY_MATCH_INSTRUCTIONS,
  output: Output.object({ schema: identityOutputSchema }),
});

export function createIdentityAgent(): AgentIdentity {
  return {
    async generate(
      input: IdentityGenerateInput,
    ): Promise<AgentResult<IdentityGenerateOutput>> {
      const { email } = input;

      const result = await identityAgent.generate({
        prompt: `Target email to match: ${email}`,
      });

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

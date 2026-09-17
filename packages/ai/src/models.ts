import { gateway, wrapLanguageModel } from "ai";
import { devToolsMiddleware } from "@ai-sdk/devtools";

const isDev = process.env.NODE_ENV === "development";

/**
 * Wrapped language models with DevTools middleware (dev only).
 * Use these instead of raw model strings to enable DevTools visibility.
 */

export const claudeSonnet = wrapLanguageModel({
  model: gateway("anthropic/claude-sonnet-4-20250514"),
  middleware: isDev ? [devToolsMiddleware()] : [],
});

export const claudeHaiku = wrapLanguageModel({
  model: gateway("anthropic/claude-haiku-4.5"),
  middleware: isDev ? [devToolsMiddleware()] : [],
});

export const gpt4oMini = wrapLanguageModel({
  model: gateway("openai/gpt-4o-mini"),
  middleware: isDev ? [devToolsMiddleware()] : [],
});

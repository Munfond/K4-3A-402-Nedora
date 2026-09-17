/**
 * Internal Slack-to-Web App Communication
 *
 * This module provides a fetch wrapper that authenticates requests from the
 * Slack app to the web app's internal API endpoints.
 *
 * ## Security Model
 *
 * The Slack app and web app share a secret token (SLACK_APP_VERIFICATION) that
 * is used to verify that requests to internal API endpoints originate from the
 * trusted Slack app rather than external sources.
 *
 * - Sender (this file): Attaches `x-slack-app-verification` header to all requests
 * - Receiver (apps/www/src/lib/api/handlers/slack.ts): Validates the header value
 *
 * ## Environment Variables
 *
 * - SLACK_APP_VERIFICATION: Shared secret token (must match in both apps)
 *
 * @see apps/www/src/lib/api/handlers/slack.ts for the verification handler
 */
export async function slackAppFetch(
  url: string,
  options?: Omit<RequestInit, "headers"> & {
    headers?: HeadersInit;
  },
): Promise<Response> {
  const verificationToken = process.env.SLACK_APP_VERIFICATION;

  if (!verificationToken) {
    throw new Error("SLACK_APP_VERIFICATION environment variable is not set");
  }

  const headers = new Headers(options?.headers);
  headers.set("x-slack-app-verification", verificationToken);

  return fetch(url, {
    ...options,
    headers,
  });
}

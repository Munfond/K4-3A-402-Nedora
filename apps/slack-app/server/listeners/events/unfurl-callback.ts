import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import type { EntityMetadata } from "@slack/web-api";
import { appUrl } from "@feedback/config/url";

import { slackAppFetch } from "~/lib/fetcher";
import { parseGtmFeedbackUrl } from "~/lib/slack/parse-url";
import {
  createAccountEntityMetadata,
  createAreaEntityMetadata,
  createEntryEntityMetadata,
  createFeedbackEntityMetadata,
  createPrivateEntityMetadata,
} from "~/lib/slack/ui/work-objects";

const possibleTypes = ["feedback", "entry", "area", "account"] as const;

export const unfurlCallback = async ({
  event,
  logger,
  context,
  client,
  body,
  next,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<"link_shared">) => {
  logger.info("link_shared", { urls: event.links.map((l) => l.url) });

  const isExternalChannel = body?.is_ext_shared_channel ?? false;
  const metadata: EntityMetadata[] = [];

  for (const link of event.links) {
    try {
      const parsed = parseGtmFeedbackUrl(link.url);
      logger.info("parsed", { parsed });

      if (!parsed.type || !possibleTypes.includes(parsed.type)) {
        continue;
      }

      const queryParams = new URLSearchParams();
      queryParams.set("type", parsed.type);

      if (parsed.type === "feedback" && parsed.slug) {
        queryParams.set("slug", parsed.slug);
      } else if (parsed.type === "entry" && parsed.slug && parsed.entryId) {
        queryParams.set("type", "feedback");
        queryParams.set("slug", parsed.slug);
        queryParams.set("entryId", parsed.entryId);
      } else if (parsed.type === "area" && parsed.slug) {
        queryParams.set("slug", parsed.slug);
      } else if (parsed.type === "account" && parsed.id) {
        queryParams.set("id", parsed.id);
      } else {
        continue;
      }

      const originalSlug = parsed.slug;
      const apiUrl = `${appUrl}/api/slack/object?${queryParams.toString()}`;
      logger.info("calling API", { apiUrl });

      if (!process.env.SLACK_APP_VERIFICATION) {
        logger.error("SLACK_APP_VERIFICATION not set");
        continue;
      }

      const response = await slackAppFetch(apiUrl);
      logger.info("API response", { status: response.status });

      if (!response.ok) {
        logger.error("API error", { status: response.status, url: link.url });
        continue;
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        logger.warn("API returned no data", { result, url: link.url });
        continue;
      }

      const data = result.data;
      const sharedUrlObj = new URL(link.url);
      const sharedBaseUrl = `${sharedUrlObj.protocol}//${sharedUrlObj.host}`;

      if (isExternalChannel) {
        metadata.push(
          createPrivateEntityMetadata(
            data.id,
            data.type,
            link.url,
            sharedBaseUrl,
          ),
        );
      } else {
        if (data.type === "entry") {
          metadata.push(
            createEntryEntityMetadata(
              data,
              link.url,
              originalSlug,
              parsed.entryId,
              sharedBaseUrl,
            ),
          );
        } else if (data.type === "feedback") {
          metadata.push(
            createFeedbackEntityMetadata(
              data,
              link.url,
              originalSlug,
              sharedBaseUrl,
            ),
          );
        } else if (data.type === "area") {
          const areaSlug = parsed.slug || data.slug;
          if (!areaSlug) {
            logger.warn("Area missing slug", { data, parsed });
            continue;
          }
          metadata.push(
            createAreaEntityMetadata(data, link.url, areaSlug, sharedBaseUrl),
          );
        } else if (data.type === "account") {
          metadata.push(
            createAccountEntityMetadata(data, link.url, sharedBaseUrl),
          );
        }
      }
    } catch (error) {
      logger.error("Error processing link", { error, url: link.url });
    }
  }

  if (metadata.length === 0) {
    logger.info("no metadata to unfurl");
    return await next();
  }

  logger.info("unfurling", { count: metadata.length });

  try {
    await client.chat.unfurl({
      channel: event.channel,
      ts: event.message_ts,
      metadata: { entities: metadata },
      token: context.botToken,
    });
    logger.info("unfurl success");
  } catch (error: unknown) {
    const errorData = (error as { data?: { error?: string } })?.data;

    if (errorData?.error === "error_processing_metadata") {
      // Work Objects not enabled, fall back to traditional unfurls
      const unfurls: Record<
        string,
        {
          blocks: Array<{
            type: string;
            text?: { type: string; text: string };
          }>;
        }
      > = {};

      for (const entity of metadata) {
        const url = entity.app_unfurl_url;
        if (!url) continue;

        const title =
          entity.entity_payload?.attributes?.title?.text || "GTM Feedback";
        const fields = entity.entity_payload?.fields as
          | { description?: { value?: string } }
          | undefined;
        const description = fields?.description?.value || "";

        unfurls[url] = {
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*<${entity.url || url}|${title}>*\n${description}`,
              },
            },
          ],
        };
      }

      try {
        await client.chat.unfurl({
          channel: event.channel,
          ts: event.message_ts,
          unfurls,
          token: context.botToken,
        });
      } catch (fallbackError) {
        logger.error("Unfurl failed", { fallbackError });
      }
    } else {
      logger.error("Unfurl error", { error });
    }
  }

  return await next();
};

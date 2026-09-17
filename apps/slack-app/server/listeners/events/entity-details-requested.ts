import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import type { EntityMetadata } from "@slack/web-api";
import { appUrl } from "@feedback/config/url";

import { slackAppFetch } from "~/lib/fetcher";
import { EXTERNAL_REF_TYPES } from "~/lib/slack/parse-url";
import { buildEntityMetadata } from "~/lib/slack/ui/flexpane";
import { createPrivateEntityMetadata } from "~/lib/slack/ui/work-objects";

export const entityDetailsRequestedCallback = async ({
  event,
  logger,
  client,
  body,
  next,
}: AllMiddlewareArgs &
  SlackEventMiddlewareArgs<"entity_details_requested">) => {
  const entityId = (event as { external_ref?: { id?: string; type?: string } })
    .external_ref?.id;
  const entityType = (
    event as { external_ref?: { id?: string; type?: string } }
  ).external_ref?.type;
  const triggerId = (event as { trigger_id?: string }).trigger_id;
  const entityUrl = (event as { entity_url?: string }).entity_url;

  if (!entityId || !entityType || !triggerId) {
    logger.warn("Missing required fields for entity details", {
      entityId,
      entityType,
      triggerId,
    });
    return await next();
  }

  if (
    !Object.values(EXTERNAL_REF_TYPES).includes(
      entityType as (typeof EXTERNAL_REF_TYPES)[keyof typeof EXTERNAL_REF_TYPES],
    )
  ) {
    return await next();
  }

  const isExternalChannel = body?.is_ext_shared_channel ?? false;

  try {
    const queryParams = new URLSearchParams();
    queryParams.set("type", entityType);
    queryParams.set("id", entityId);

    const apiUrl = `${appUrl}/api/slack/object?${queryParams.toString()}`;
    const response = await slackAppFetch(apiUrl);

    if (!response.ok) {
      logger.error("API error for entity details", { status: response.status });
      return await next();
    }

    const apiResult = await response.json();
    if (!apiResult.success || !apiResult.data) {
      logger.error("API returned no data");
      return await next();
    }

    const data = apiResult.data;

    let entityMetadata: EntityMetadata | null;
    if (isExternalChannel) {
      // For external channels, show restricted metadata to protect sensitive data
      if (!entityUrl) {
        logger.warn("Missing entity_url for external channel restricted view");
        return await next();
      }
      const entityUrlObj = new URL(entityUrl);
      const baseUrl = `${entityUrlObj.protocol}//${entityUrlObj.host}`;
      entityMetadata = createPrivateEntityMetadata(
        entityId,
        entityType as "feedback" | "entry" | "area" | "account",
        entityUrl,
        baseUrl,
      );
    } else {
      // For internal channels, show detailed metadata
      entityMetadata = buildEntityMetadata(data);
    }

    if (!entityMetadata) {
      logger.error("Could not build metadata", { type: data.type });
      return await next();
    }

    await client.entity.presentDetails({
      trigger_id: triggerId,
      metadata: entityMetadata,
    });
  } catch (error) {
    logger.error("Error presenting entity details", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return await next();
};

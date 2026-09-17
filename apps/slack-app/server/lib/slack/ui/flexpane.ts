import type { EntityMetadata } from "@slack/web-api";
import { appUrl } from "@feedback/config/url";

import { EXTERNAL_REF_TYPES } from "../parse-url";
import {
  formatARR,
  formatSeverity,
  formatDate,
  type CustomField,
  createCustomField,
} from "./work-objects";

export function buildEntityMetadata(data: {
  type: string;
  id: string;
  slug?: string;
  title?: string;
  name?: string;
  description?: string;
  arr?: number;
  entriesCount?: number;
  feedbackCount?: number;
  entryCount?: number;
  feedbackTitle?: string;
  feedbackSlug?: string;
  accountType?: string;
  areaNames?: string | null;
  creatorName?: string | null;
  entryCreatorName?: string | null;
  severity?: string;
  externalLinks?: string[];
  severityCounts?: {
    low?: number;
    medium?: number;
    high?: number;
  };
  createdAt?: string | null;
  website?: string | null;
  topFeatureRequests?: Array<{
    title: string;
    slug: string;
    arr: number;
  }>;
}): EntityMetadata | null {
  const arr = data.arr ?? 0;

  if (data.type === "feedback") {
    const fields: Record<string, { value: string }> = {
      description: { value: data.description || "No description" },
    };

    const customFields: CustomField[] = [
      createCustomField(
        "entries",
        "Entries",
        `${data.entriesCount || 0} entries`,
      ),
      createCustomField("arr", "💰 ARR", formatARR(arr)),
    ];

    if (data.areaNames) {
      customFields.push(
        createCustomField("product_areas", "Product Area", data.areaNames),
      );
    }

    if (data.creatorName) {
      customFields.push(
        createCustomField("creator", "Creator", data.creatorName),
      );
    }

    if (data.createdAt) {
      customFields.push(
        createCustomField("created", "Created", formatDate(data.createdAt)),
      );
    }

    return {
      url: `${appUrl}/requests/${data.slug}`,
      entity_type: "slack#/entities/content_item",
      external_ref: { id: data.id, type: EXTERNAL_REF_TYPES.feedback },
      entity_payload: {
        attributes: { title: { text: data.title || "Feedback" } },
        fields: fields as EntityMetadata["entity_payload"]["fields"],
        custom_fields:
          customFields as unknown as EntityMetadata["entity_payload"]["custom_fields"],
      },
    };
  }

  if (data.type === "entry") {
    const entryUrl = data.feedbackSlug
      ? `${appUrl}/requests/${data.feedbackSlug}?eid=${data.id}`
      : `${appUrl}/requests`;

    const fields: Record<string, { value: string }> = {
      description: { value: data.description || "No description" },
    };

    const customFields: CustomField[] = [];

    if (data.severity) {
      const severityLabel = formatSeverity(data.severity);
      customFields.push(
        createCustomField("severity", "Severity", severityLabel),
      );
    }

    if (data.arr !== undefined) {
      customFields.push(createCustomField("arr", "💰 ARR", formatARR(arr)));
    }

    if (
      data.externalLinks &&
      Array.isArray(data.externalLinks) &&
      data.externalLinks.length > 0
    ) {
      data.externalLinks.forEach((link, index) => {
        customFields.push({
          key: `related_link_${index}`,
          label: index === 0 ? "Related Links" : "",
          type: "slack#/types/link",
          value: link,
        });
      });
    }

    if (data.feedbackTitle && data.feedbackSlug) {
      const feedbackUrl = `${appUrl}/requests/${data.feedbackSlug}`;
      customFields.push({
        key: "feature_request",
        label: "Feature Request",
        type: "string",
        value: data.feedbackTitle,
        link: feedbackUrl,
      });
    }

    if (data.entryCreatorName) {
      customFields.push(
        createCustomField("creator", "Creator", data.entryCreatorName),
      );
    }

    if (data.createdAt) {
      customFields.push(
        createCustomField("created", "Created", formatDate(data.createdAt)),
      );
    }

    return {
      url: entryUrl,
      entity_type: "slack#/entities/content_item",
      external_ref: { id: data.id, type: EXTERNAL_REF_TYPES.entry },
      entity_payload: {
        attributes: { title: { text: data.title || "Entry" } },
        fields: fields as EntityMetadata["entity_payload"]["fields"],
        custom_fields:
          customFields as unknown as EntityMetadata["entity_payload"]["custom_fields"],
      },
    };
  }

  if (data.type === "area") {
    const customFields: CustomField[] = [
      createCustomField(
        "feature_requests",
        "Feature Requests",
        `${data.feedbackCount || 0} requests`,
      ),
      createCustomField("arr", "💰 ARR", formatARR(arr)),
    ];

    if (data.topFeatureRequests && Array.isArray(data.topFeatureRequests)) {
      const medals = ["🥇", "🥈", "🥉"];
      const labels = [
        "🥇 Top Request by ARR",
        "🥈 Second by ARR",
        "🥉 Third by ARR",
      ];
      data.topFeatureRequests.forEach((request, index) => {
        if (request?.title && request?.slug) {
          const feedbackUrl = `${appUrl}/requests/${request.slug}`;
          customFields.push({
            key: `top_request_${index}`,
            label: labels[index] || medals[index] || "",
            type: "string",
            value: request.title,
            link: feedbackUrl,
          });
        }
      });
    }

    return {
      url: `${appUrl}/areas/${data.slug}`,
      entity_type: "slack#/entities/content_item",
      external_ref: { id: data.id, type: EXTERNAL_REF_TYPES.area },
      entity_payload: {
        attributes: { title: { text: data.title || data.name || "Area" } },
        fields: {
          description: { value: data.description || "No description" },
        } as EntityMetadata["entity_payload"]["fields"],
        custom_fields:
          customFields as unknown as EntityMetadata["entity_payload"]["custom_fields"],
      },
    };
  }

  if (data.type === "account") {
    const customFields: CustomField[] = [
      createCustomField("arr", "💰 ARR", formatARR(arr)),
    ];

    if (data.website) {
      const websiteUrl = data.website.startsWith("http")
        ? data.website
        : `https://${data.website}`;
      customFields.push({
        key: "website",
        label: "Website",
        type: "slack#/types/link",
        value: websiteUrl,
      });
    }

    if (data.severityCounts) {
      const counts = data.severityCounts as {
        low?: number;
        medium?: number;
        high?: number;
      };
      customFields.push(
        createCustomField(
          "nice_to_have",
          "👌 Nice to have",
          `${counts.low || 0} entries`,
        ),
      );
      customFields.push(
        createCustomField(
          "significant_pain",
          "⚠️ Significant pain",
          `${counts.medium || 0} entries`,
        ),
      );
      customFields.push(
        createCustomField(
          "dealbreaker",
          "🚨 Dealbreaker",
          `${counts.high || 0} entries`,
        ),
      );
    }

    return {
      url: `${appUrl}/accounts/${data.id}`,
      entity_type: "slack#/entities/content_item",
      external_ref: { id: data.id, type: EXTERNAL_REF_TYPES.account },
      entity_payload: {
        attributes: { title: { text: data.title || data.name || "Account" } },
        custom_fields:
          customFields as unknown as EntityMetadata["entity_payload"]["custom_fields"],
      },
    };
  }

  return null;
}

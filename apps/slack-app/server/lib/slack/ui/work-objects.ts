import type { EntityMetadata } from "@slack/web-api";
import { EXTERNAL_REF_TYPES } from "../parse-url";

export const formatARR = (arr: number): string => {
  if (arr === 0) return "$0";
  if (arr >= 1000000) return `$${(arr / 1000000).toFixed(1)}M`;
  if (arr >= 1000) return `$${(arr / 1000).toFixed(1)}K`;
  return `$${arr.toFixed(0)}`;
};

export const formatSeverity = (severity: string): string => {
  const severityMap: Record<string, string> = {
    low: "👌 Nice to have",
    medium: "⚠️ Significant pain",
    high: "🚨 Dealbreaker",
  };
  return severityMap[severity.toLowerCase()] || severity;
};

export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "Unknown";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "Unknown";
  }
};

export type CustomField = {
  key: string;
  label: string;
  type: "string" | "slack#/types/link";
  value: string;
  link?: string;
};

export const createCustomField = (
  key: string,
  label: string,
  value: string,
  link?: string,
): CustomField => ({
  key,
  label,
  type: "string",
  value,
  ...(link && { link }),
});

export const createFeedbackEntityMetadata = (
  data: {
    id: string;
    slug?: string;
    title: string;
    description: string;
    arr: number;
    entriesCount: number;
    areaNames?: string | null;
    creatorName?: string | null;
    createdAt?: string | null;
  },
  url: string,
  slug: string,
  baseUrl: string,
): EntityMetadata => {
  // For work objects (unfurl), only show entries and ARR
  const customFields: CustomField[] = [
    createCustomField("entries", "Feedback", `${data.entriesCount} entries`),
    createCustomField("arr", "💰 ARR", formatARR(data.arr)),
  ];

  return {
    app_unfurl_url: url,
    url: `${baseUrl}/requests/${slug || data.slug}`,
    entity_type: "slack#/entities/content_item",
    external_ref: {
      id: data.id,
      type: EXTERNAL_REF_TYPES.feedback,
    },
    entity_payload: {
      attributes: { title: { text: data.title } },
      fields: {
        description: { value: data.description || "No description" },
      } as EntityMetadata["entity_payload"]["fields"],
      custom_fields:
        customFields as unknown as EntityMetadata["entity_payload"]["custom_fields"],
    },
  };
};

export const createEntryEntityMetadata = (
  data: {
    id: string;
    title: string;
    description: string;
    arr: number;
    severity?: string;
    feedbackTitle?: string;
    feedbackSlug?: string;
    entryCreatorName?: string | null;
    createdAt?: string | null;
  },
  url: string,
  slug: string | undefined,
  entryId: string | undefined,
  baseUrl: string,
): EntityMetadata => {
  const feedbackSlug = slug || data.feedbackSlug;
  const entryUrl = feedbackSlug
    ? `${baseUrl}/requests/${feedbackSlug}${entryId ? `?eid=${entryId}` : ""}`
    : url;

  const fields: Record<string, { value: string }> = {
    description: { value: data.description || "No description" },
  };

  const customFields: CustomField[] = [];
  if (data.severity) {
    const severityLabel = formatSeverity(data.severity);
    customFields.push(createCustomField("severity", "Severity", severityLabel));
  }

  return {
    app_unfurl_url: url,
    url: entryUrl,
    entity_type: "slack#/entities/content_item",
    external_ref: {
      id: data.id,
      type: EXTERNAL_REF_TYPES.entry,
    },
    entity_payload: {
      attributes: { title: { text: data.title } },
      fields: fields as EntityMetadata["entity_payload"]["fields"],
      custom_fields:
        customFields.length > 0
          ? (customFields as unknown as EntityMetadata["entity_payload"]["custom_fields"])
          : undefined,
    },
  };
};

export const createAreaEntityMetadata = (
  data: {
    id: string;
    slug?: string;
    name?: string;
    title?: string;
    description: string;
    arr: number;
    feedbackCount: number;
  },
  url: string,
  slug: string,
  baseUrl: string,
): EntityMetadata => {
  const areaName = data.title || data.name || "Area";
  return {
    app_unfurl_url: url,
    url: `${baseUrl}/areas/${slug || data.slug}`,
    entity_type: "slack#/entities/content_item",
    external_ref: {
      id: data.id,
      type: EXTERNAL_REF_TYPES.area,
    },
    entity_payload: {
      attributes: { title: { text: areaName } },
      fields: {
        description: { value: data.description || "No description" },
      } as EntityMetadata["entity_payload"]["fields"],
      custom_fields: [
        createCustomField(
          "feature_requests",
          "Feature Requests",
          `${data.feedbackCount} requests`,
        ),
        createCustomField("arr", "💰 ARR", formatARR(data.arr)),
      ] as unknown as EntityMetadata["entity_payload"]["custom_fields"],
    },
  };
};

export const createAccountEntityMetadata = (
  data: {
    id: string;
    name: string;
    type?: string;
    accountType?: string;
    description?: string;
    website?: string | null;
    arr: number;
    entryCount: number;
  },
  url: string,
  baseUrl: string,
): EntityMetadata => {
  const customFields: CustomField[] = [
    createCustomField("entries", "Feedback", `${data.entryCount} entries`),
    createCustomField("arr", "💰 ARR", formatARR(data.arr)),
  ];

  return {
    app_unfurl_url: url,
    url: `${baseUrl}/accounts/${data.id}`,
    entity_type: "slack#/entities/content_item",
    external_ref: {
      id: data.id,
      type: EXTERNAL_REF_TYPES.account,
    },
    entity_payload: {
      attributes: { title: { text: data.name } },
      custom_fields:
        customFields as unknown as EntityMetadata["entity_payload"]["custom_fields"],
    },
  };
};

export const createPrivateEntityMetadata = (
  id: string,
  type: "feedback" | "entry" | "area" | "account",
  url: string,
  baseUrl: string,
): EntityMetadata => {
  const urlPath =
    type === "entry"
      ? "requests"
      : type === "area"
        ? "areas"
        : type === "account"
          ? "accounts"
          : "requests";

  const refType =
    type === "entry"
      ? EXTERNAL_REF_TYPES.entry
      : type === "area"
        ? EXTERNAL_REF_TYPES.area
        : type === "account"
          ? EXTERNAL_REF_TYPES.account
          : EXTERNAL_REF_TYPES.feedback;

  // For entries, use the original URL which has the correct format (/requests/{slug}?eid={entryId})
  // For other types, construct the URL from baseUrl and id
  const entityUrl = type === "entry" ? url : `${baseUrl}/${urlPath}/${id}`;

  return {
    app_unfurl_url: url,
    url: entityUrl,
    entity_type: "slack#/entities/content_item",
    external_ref: { id, type: refType },
    entity_payload: {
      attributes: { title: { text: "Private - GTM Feedback" } },
      fields: { description: { value: "Login to view" } },
    },
  };
};

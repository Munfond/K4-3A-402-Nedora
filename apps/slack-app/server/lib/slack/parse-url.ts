export const EXTERNAL_REF_TYPES = {
  feedback: "feedback",
  entry: "entry",
  area: "area",
  account: "account",
} as const;

/**
 * Parses a GTM Feedback URL to extract entity information
 * Supports:
 * - /requests/[slug] - Feature request (new URL)
 * - /requests/[slug]?eid=[entryId] - Entry within feature request (new URL)
 * - /feedback/[slug] - Feature request (legacy URL, redirects to /requests/)
 * - /feedback/[slug]?eid=[entryId] - Entry within feature request (legacy URL)
 * - /areas/[slug] - Product area
 * - /accounts/[id] - Account
 */
export function parseGtmFeedbackUrl(url: string): {
  type: "feedback" | "entry" | "area" | "account" | null;
  slug?: string;
  id?: string;
  entryId?: string;
} {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const searchParams = urlObj.searchParams;

    // Extract entryId from query params if present
    const entryId = searchParams.get("eid") || undefined;

    // Parse pathname - support both /requests/ (new) and /feedback/ (legacy)
    if (pathname.startsWith("/requests/")) {
      const slug = pathname.replace("/requests/", "").split("/")[0];
      if (slug) {
        return { type: entryId ? "entry" : "feedback", slug, entryId };
      }
    }

    // Legacy URL support - /feedback/ redirects to /requests/
    if (pathname.startsWith("/feedback/")) {
      const slug = pathname.replace("/feedback/", "").split("/")[0];
      if (slug) {
        return { type: entryId ? "entry" : "feedback", slug, entryId };
      }
    }

    if (pathname.startsWith("/areas/")) {
      const slug = pathname.replace("/areas/", "").split("/")[0];
      if (slug) {
        return { type: "area", slug };
      }
    }

    if (pathname.startsWith("/accounts/")) {
      const id = pathname.replace("/accounts/", "").split("/")[0];
      if (id) {
        return { type: "account", id };
      }
    }

    return { type: null };
  } catch {
    return { type: null };
  }
}

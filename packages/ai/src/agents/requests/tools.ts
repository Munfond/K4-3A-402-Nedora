import { tool } from "ai";
import { z } from "zod";
import { db } from "@feedback/db";
import { createRequestEmbedding, findSimilarRequests } from "../../embeddings";

export type RequestToolContext = {
  fetchCandidateRequests?: (
    query: string,
    areaIds?: string[],
    limit?: number,
  ) => Promise<unknown[]>;
  fetchProductAreas?: () => Promise<Array<{ id: string; name: string }>>;
  fetchRequestById?: (id: string) => Promise<unknown>;
};

export const defaultFetchCandidateRequests = async (
  query: string,
  areaIds?: string[],
  limit?: number,
): Promise<unknown[]> => {
  const apiKey = process.env.OPENAI_API_KEY;
  const vectorUrl = process.env.UPSTASH_VECTOR_REST_URL;
  const vectorToken = process.env.UPSTASH_VECTOR_REST_TOKEN;

  if (apiKey && vectorUrl && vectorToken) {
    const embedding = await createRequestEmbedding(query, "", apiKey);
    if (embedding) {
      const similar = await findSimilarRequests(
        embedding,
        vectorUrl,
        vectorToken,
        limit ?? 50,
        [],
      );

      if (similar.length > 0) {
        const ids = similar.map((s) => s.id);
        const results = await db.query.requests.findMany({
          where: (requests, { inArray }) => inArray(requests.id, ids),
          columns: {
            id: true,
            title: true,
            description: true,
            areaIds: true,
          },
        });

        if (areaIds?.length) {
          return results.filter((item) =>
            item.areaIds.some((id) => areaIds.includes(id)),
          );
        }
        return results;
      }
    }
  }

  const results = await db.query.requests.findMany({
    where: (requests, { eq }) => eq(requests.status, "open"),
    columns: {
      id: true,
      title: true,
      description: true,
      areaIds: true,
    },
    limit: limit ?? 100,
  });

  if (areaIds?.length) {
    return results.filter((item) =>
      item.areaIds.some((id) => areaIds.includes(id)),
    );
  }

  return results;
};

export const defaultFetchProductAreas = async (): Promise<
  Array<{ id: string; name: string }>
> => {
  const areas = await db.query.areas.findMany({
    columns: { id: true, name: true },
  });
  return areas;
};

export const defaultFetchRequestById = async (id: string): Promise<unknown> => {
  const request = await db.query.requests.findFirst({
    where: (requests, { eq }) => eq(requests.id, id),
    columns: {
      id: true,
      title: true,
      description: true,
      areaIds: true,
    },
  });
  return request;
};

export const defaultRequestToolContext: RequestToolContext = {
  fetchCandidateRequests: defaultFetchCandidateRequests,
  fetchProductAreas: defaultFetchProductAreas,
  fetchRequestById: defaultFetchRequestById,
};

export const getCandidateRequests = tool({
  description:
    "Fetch candidate request items to match against. Returns existing feature requests that could match the pain.",
  inputSchema: z.object({
    query: z.string().describe("The pain/query to search for"),
    areaIds: z
      .array(z.string())
      .optional()
      .describe("Filter to specific product areas"),
    limit: z.number().optional().default(50).describe("Max results to return"),
  }),
  execute: async ({ query, areaIds, limit }, { experimental_context }) => {
    const ctx = experimental_context as RequestToolContext;
    const fetchFn = ctx.fetchCandidateRequests ?? defaultFetchCandidateRequests;
    return fetchFn(query, areaIds, limit ?? 50);
  },
});

export const getProductAreas = tool({
  description: "Fetch all available product areas for categorization.",
  inputSchema: z.object({}),
  execute: async (_, { experimental_context }) => {
    const ctx = experimental_context as RequestToolContext;
    const fetchFn = ctx.fetchProductAreas ?? defaultFetchProductAreas;
    return fetchFn();
  },
});

export const getRequestById = tool({
  description: "Fetch a specific request item by ID.",
  inputSchema: z.object({
    id: z.string().describe("The request ID to fetch"),
  }),
  execute: async ({ id }, { experimental_context }) => {
    const ctx = experimental_context as RequestToolContext;
    const fetchFn = ctx.fetchRequestById ?? defaultFetchRequestById;
    return fetchFn(id);
  },
});

export const requestTools = {
  getCandidateRequests,
  getProductAreas,
  getRequestById,
};

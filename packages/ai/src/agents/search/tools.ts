import { tool } from "ai";
import { z } from "zod";
import { db } from "@feedback/db";
import {
  createRequestEmbedding,
  findSimilarRequests,
  storeRequestEmbedding,
} from "../../embeddings";

export type SearchToolContext = {
  createEmbedding?: (text: string) => Promise<number[] | null>;
  searchSimilar?: (
    embedding: number[],
    limit: number,
    excludeIds?: string[],
  ) => Promise<Array<{ id: string; score: number }>>;
  fetchRequestsByIds?: (ids: string[]) => Promise<
    Array<{
      id: string;
      title: string;
      description: string;
      areaIds?: string[];
    }>
  >;
  storeEmbedding?: (
    requestId: string,
    embedding: number[],
    metadata: { title: string; description: string; areaIds?: string[] },
  ) => Promise<boolean>;
  searchRequests?: (
    query: string,
    limit?: number,
    excludeIds?: string[],
  ) => Promise<Array<{ id: string; score: number }>>;
};

export const defaultCreateEmbedding = async (
  text: string,
): Promise<number[] | null> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("OPENAI_API_KEY not set, cannot create embedding");
    return null;
  }
  return createRequestEmbedding(text, "", apiKey);
};

export const defaultSearchSimilar = async (
  embedding: number[],
  limit: number,
  excludeIds?: string[],
): Promise<Array<{ id: string; score: number }>> => {
  const url = process.env.UPSTASH_VECTOR_REST_URL;
  const token = process.env.UPSTASH_VECTOR_REST_TOKEN;

  if (url && token) {
    const results = await findSimilarRequests(
      embedding,
      url,
      token,
      limit,
      excludeIds ?? [],
    );
    if (results.length > 0) {
      return results;
    }
  }

  // Fallback: fetch recent open requests when vector search unavailable or returns empty
  const fallbackResults = await db.query.requests.findMany({
    where: (requests, { eq, and, notInArray }) => {
      if (excludeIds?.length) {
        return and(
          eq(requests.status, "open"),
          notInArray(requests.id, excludeIds),
        );
      }
      return eq(requests.status, "open");
    },
    columns: { id: true },
    orderBy: (requests, { desc }) => [desc(requests.createdAt)],
    limit,
  });

  // Agent will re-rank based on semantic similarity
  return fallbackResults.map((r) => ({ id: r.id, score: 0 }));
};

export const defaultFetchRequestsByIds = async (
  ids: string[],
): Promise<
  Array<{ id: string; title: string; description: string; areaIds?: string[] }>
> => {
  if (ids.length === 0) return [];

  const results = await db.query.requests.findMany({
    where: (requests, { inArray }) => inArray(requests.id, ids),
    columns: {
      id: true,
      title: true,
      description: true,
      areaIds: true,
    },
  });
  return results.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    areaIds: r.areaIds,
  }));
};

export const defaultStoreEmbedding = async (
  requestId: string,
  embedding: number[],
  metadata: { title: string; description: string; areaIds?: string[] },
): Promise<boolean> => {
  const url = process.env.UPSTASH_VECTOR_REST_URL;
  const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
  if (!url || !token) {
    console.warn("Upstash Vector not configured");
    return false;
  }
  return storeRequestEmbedding(requestId, embedding, url, token, metadata);
};

export const defaultSearchToolContext: SearchToolContext = {
  createEmbedding: defaultCreateEmbedding,
  searchSimilar: defaultSearchSimilar,
  fetchRequestsByIds: defaultFetchRequestsByIds,
  storeEmbedding: defaultStoreEmbedding,
};

export const createEmbeddingTool = tool({
  description:
    "Create an embedding vector for semantic search. Returns a vector representation of the text.",
  inputSchema: z.object({
    text: z.string().describe("The text to create an embedding for"),
  }),
  execute: async ({ text }, { experimental_context }) => {
    const ctx = experimental_context as SearchToolContext;
    const createFn = ctx.createEmbedding ?? defaultCreateEmbedding;
    return createFn(text);
  },
});

export const searchSimilar = tool({
  description:
    "Search for similar requests using vector similarity. Returns candidates ranked by similarity.",
  inputSchema: z.object({
    embedding: z
      .array(z.number())
      .describe("The embedding vector to search with"),
    limit: z.number().optional().default(100).describe("Max results to return"),
    excludeIds: z
      .array(z.string())
      .optional()
      .describe("IDs to exclude from results"),
  }),
  execute: async (
    { embedding, limit, excludeIds },
    { experimental_context },
  ) => {
    const ctx = experimental_context as SearchToolContext;
    const searchFn = ctx.searchSimilar ?? defaultSearchSimilar;
    return searchFn(embedding, limit ?? 100, excludeIds);
  },
});

export const getRequestsByIds = tool({
  description: "Fetch full request details for a list of IDs.",
  inputSchema: z.object({
    ids: z.array(z.string()).describe("Request IDs to fetch"),
  }),
  execute: async ({ ids }, { experimental_context }) => {
    const ctx = experimental_context as SearchToolContext;
    const fetchFn = ctx.fetchRequestsByIds ?? defaultFetchRequestsByIds;
    return fetchFn(ids);
  },
});

export const storeEmbeddingTool = tool({
  description: "Store an embedding for a request item in the vector database.",
  inputSchema: z.object({
    requestId: z.string().describe("The request ID"),
    embedding: z.array(z.number()).describe("The embedding vector"),
    metadata: z
      .object({
        title: z.string(),
        description: z.string(),
        areaIds: z.array(z.string()).optional(),
      })
      .describe("Metadata to store with the embedding"),
  }),
  execute: async (
    { requestId, embedding, metadata },
    { experimental_context },
  ) => {
    const ctx = experimental_context as SearchToolContext;
    const storeFn = ctx.storeEmbedding ?? defaultStoreEmbedding;
    return storeFn(requestId, embedding, metadata);
  },
});

export const searchRequests = tool({
  description:
    "Search for request items matching a query. Uses semantic search if available, falls back to recent open requests otherwise. Returns IDs and details.",
  inputSchema: z.object({
    query: z.string().describe("The search query"),
    limit: z.number().optional().default(50).describe("Max results to return"),
    excludeIds: z
      .array(z.string())
      .optional()
      .describe("IDs to exclude from results"),
  }),
  execute: async ({ query, limit, excludeIds }, { experimental_context }) => {
    const ctx = experimental_context as SearchToolContext;
    const createFn = ctx.createEmbedding ?? defaultCreateEmbedding;
    const searchFn = ctx.searchSimilar ?? defaultSearchSimilar;
    const fetchFn = ctx.fetchRequestsByIds ?? defaultFetchRequestsByIds;

    let searchResults: Array<{ id: string; score: number }> = [];

    // Try semantic search if embedding can be created
    const embedding = await createFn(query);
    if (embedding) {
      searchResults = await searchFn(embedding, limit ?? 50, excludeIds);
    }

    // Fallback to recent open requests if no results
    if (searchResults.length === 0) {
      const fallback = await db.query.requests.findMany({
        where: (requests, { eq, and, notInArray }) => {
          if (excludeIds?.length) {
            return and(
              eq(requests.status, "open"),
              notInArray(requests.id, excludeIds),
            );
          }
          return eq(requests.status, "open");
        },
        columns: { id: true },
        orderBy: (requests, { desc }) => [desc(requests.createdAt)],
        limit: limit ?? 50,
      });
      // Agent will re-rank based on semantic similarity
      searchResults = fallback.map((r) => ({ id: r.id, score: 0 }));
    }

    if (searchResults.length === 0) {
      return [];
    }

    // Fetch full details
    const ids = searchResults.map((r) => r.id);
    const details = await fetchFn(ids);

    // Merge scores with details
    return details.map((d) => ({
      ...d,
      score: searchResults.find((r) => r.id === d.id)?.score ?? 0,
    }));
  },
});

export const searchTools = {
  createEmbedding: createEmbeddingTool,
  searchSimilar,
  getRequestsByIds,
  storeEmbedding: storeEmbeddingTool,
  searchRequests,
};

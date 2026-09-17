import { createOpenAI } from "@ai-sdk/openai";
import { Index } from "@upstash/vector";
import { embed, embedMany } from "ai";

let vectorIndex: Index<Record<string, unknown>> | null = null;
let cachedUrl: string | null = null;
let cachedToken: string | null = null;

function getVectorIndex(
  url?: string,
  token?: string,
): Index<Record<string, unknown>> | null {
  if (!url || !token) {
    throw new Error(
      "Upstash Vector not configured. UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN must be set.",
    );
  }

  // If index exists, validate that it was initialized with the same credentials
  // If credentials differ, recreate the index
  if (vectorIndex && (cachedUrl !== url || cachedToken !== token)) {
    vectorIndex = null;
  }

  if (!vectorIndex) {
    vectorIndex = new Index<Record<string, unknown>>({
      url,
      token,
    });
    cachedUrl = url;
    cachedToken = token;
  }

  return vectorIndex;
}

/**
 * Creates an embedding for request text (title + description)
 */
export async function createRequestEmbedding(
  title: string,
  description: string,
  apiKey: string,
): Promise<number[] | null> {
  if (!apiKey) {
    console.error("OpenAI API key is required. Cannot create embedding.");
    return null;
  }

  try {
    const openai = createOpenAI({ apiKey });
    const text = `${title}\n\n${description}`;
    const { embedding } = await embed({
      model: openai.embeddingModel("text-embedding-3-small"),
      value: text,
      providerOptions: {
        openai: {
          dimensions: 384, // Match Upstash Vector index dimension
        },
      },
    });

    return embedding;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to create embedding:", errorMessage);
    return null;
  }
}

/**
 * Creates embeddings for multiple request items (title + description)
 * Uses embedMany for efficient batch processing
 */
export async function createRequestEmbeddings(
  items: Array<{ title: string; description: string }>,
  apiKey: string,
): Promise<number[][] | null> {
  if (!apiKey) {
    console.error("OpenAI API key is required. Cannot create embeddings.");
    return null;
  }

  try {
    const openai = createOpenAI({ apiKey });
    const texts = items.map((item) => `${item.title}\n\n${item.description}`);
    const { embeddings } = await embedMany({
      model: openai.embeddingModel("text-embedding-3-small"),
      values: texts,
      providerOptions: {
        openai: {
          dimensions: 384, // Match Upstash Vector index dimension
        },
      },
    });

    return embeddings;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `Failed to create embeddings for ${items.length} items:`,
      errorMessage,
    );
    return null;
  }
}

/**
 * Stores an embedding for a request item in Upstash Vector
 */
export async function storeRequestEmbedding(
  requestId: string,
  embedding: number[],
  url: string,
  token: string,
  metadata?: Record<string, unknown>,
): Promise<boolean> {
  try {
    const index = getVectorIndex(url, token);
    if (!index) {
      console.error(`Failed to get vector index for request ${requestId}`);
      return false;
    }

    // Validate embedding dimension
    if (embedding.length !== 384) {
      console.error(
        `Invalid embedding dimension for ${requestId}: expected 384, got ${embedding.length}`,
      );
      return false;
    }

    await index.upsert({
      id: requestId,
      vector: embedding,
      metadata: metadata || {},
    });

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to store embedding for ${requestId}:`, errorMessage);
    return false;
  }
}

/**
 * Stores multiple embeddings for request items in Upstash Vector
 * Uses batch upsert for efficient storage
 * Returns a Set of requestIds that were successfully stored
 */
export async function storeRequestEmbeddings(
  items: Array<{
    requestId: string;
    embedding: number[];
    metadata?: Record<string, unknown>;
  }>,
  url: string,
  token: string,
): Promise<Set<string>> {
  let index: Index<Record<string, unknown>>;
  try {
    const indexResult = getVectorIndex(url, token);
    if (!indexResult) {
      console.error("Vector index is null");
      return new Set();
    }
    index = indexResult;
  } catch (error) {
    console.error(
      "Failed to get vector index:",
      error instanceof Error ? error.message : String(error),
    );
    return new Set();
  }

  if (items.length === 0) {
    return new Set();
  }

  try {
    const vectors = items.map((item) => ({
      id: item.requestId,
      vector: item.embedding,
      metadata: item.metadata || {},
    }));

    // Validate vectors before upsert
    if (vectors.length === 0) {
      return new Set();
    }

    // Validate vector dimensions
    const invalidVectors = vectors.filter(
      (v) => !v.vector || v.vector.length !== 384,
    );
    if (invalidVectors.length > 0) {
      console.error(
        `Invalid vector dimensions: ${invalidVectors.length} vectors have incorrect dimensions (expected 384)`,
      );
      return new Set();
    }

    // Upsert all vectors in parallel
    const results = await Promise.allSettled(
      vectors.map((vector) => index.upsert(vector)),
    );

    // Track which requestIds succeeded (results are in the same order as vectors)
    const successfulIds = new Set<string>();
    const failures = results.filter((result, idx) => {
      if (result.status === "fulfilled") {
        successfulIds.add(vectors[idx].id);
        return false;
      }
      return true;
    });

    if (failures.length > 0) {
      console.error(
        `Failed to store ${failures.length} out of ${vectors.length} vectors`,
      );
      // Log first few failures for debugging
      failures.slice(0, 3).forEach((failure, idx) => {
        if (failure.status === "rejected") {
          const errorMessage =
            failure.reason instanceof Error
              ? failure.reason.message
              : String(failure.reason);
          const vectorId = vectors[idx]?.id || "unknown";
          console.error(`  Failed vector ${vectorId}: ${errorMessage}`);
        }
      });
    }

    if (successfulIds.size === 0 && failures.length > 0) {
      const firstError =
        failures[0]?.status === "rejected"
          ? failures[0].reason instanceof Error
            ? failures[0].reason.message
            : String(failures[0].reason)
          : "Unknown error";
      throw new Error(
        `All ${vectors.length} upserts failed. First error: ${firstError}`,
      );
    }

    return successfulIds;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to store ${items.length} embeddings:`, errorMessage);
    return new Set();
  }
}

/**
 * Searches for similar requests using vector similarity
 */
export async function findSimilarRequests(
  embedding: number[],
  url: string,
  token: string,
  limit: number = 10,
  excludeIds: string[] = [],
): Promise<
  Array<{ id: string; score: number; metadata?: Record<string, unknown> }>
> {
  const index = getVectorIndex(url, token);
  if (!index) {
    return [];
  }

  try {
    const results = await index.query({
      vector: embedding,
      topK: limit + excludeIds.length,
      includeMetadata: true,
    });

    // Filter out excluded IDs and limit results
    return results
      .filter((result) => {
        const id = String(result.id);
        return !excludeIds.includes(id);
      })
      .slice(0, limit)
      .map((result) => ({
        id: String(result.id),
        score: result.score,
        metadata: result.metadata as Record<string, unknown> | undefined,
      }));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to search similar requests:", errorMessage);
    return [];
  }
}

/**
 * Updates an existing embedding for a request item
 */
export async function updateRequestEmbedding(
  requestId: string,
  embedding: number[],
  url: string,
  token: string,
  metadata?: Record<string, unknown>,
): Promise<boolean> {
  // Upsert handles both create and update
  return storeRequestEmbedding(requestId, embedding, url, token, metadata);
}

/**
 * Deletes an embedding for a request item
 */
export async function deleteRequestEmbedding(
  requestId: string,
  url: string,
  token: string,
): Promise<boolean> {
  const index = getVectorIndex(url, token);
  if (!index) {
    return false;
  }

  try {
    await index.delete([requestId]);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to delete embedding ${requestId}:`, errorMessage);
    return false;
  }
}

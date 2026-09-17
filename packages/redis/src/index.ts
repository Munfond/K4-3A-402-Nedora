import { Redis, type SetCommandOptions } from "@upstash/redis";

if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
  throw new Error("KV_REST_API_URL and KV_REST_API_TOKEN must be set");
}

export const redisClient = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

/**
 * Safe Redis wrapper with built-in error handling.
 * Returns success booleans for writes, null/empty for failed reads.
 */
export const redis = {
  async del(key: string): Promise<boolean> {
    try {
      await redisClient.del(key);
      return true;
    } catch (error) {
      console.error(`Redis del failed for ${key}:`, error);
      return false;
    }
  },

  async set<T>(
    key: string,
    value: T,
    options?: SetCommandOptions,
  ): Promise<boolean> {
    try {
      await redisClient.set(key, value, options);
      return true;
    } catch (error) {
      console.error(`Redis set failed for ${key}:`, error);
      return false;
    }
  },

  async get<T>(key: string): Promise<T | null> {
    try {
      return await redisClient.get<T>(key);
    } catch (error) {
      console.error(`Redis get failed for ${key}:`, error);
      return null;
    }
  },

  async keys(pattern: string): Promise<string[]> {
    try {
      return await redisClient.keys(pattern);
    } catch (error) {
      console.error(`Redis keys failed for ${pattern}:`, error);
      return [];
    }
  },
};

export { Redis, type SetCommandOptions } from "@upstash/redis";

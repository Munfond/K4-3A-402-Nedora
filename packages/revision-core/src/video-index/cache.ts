import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { RevisionStore } from "../store";
import { getDefaultStore } from "../store";
import { type BuildVideoIndexOptions, buildVideoIndex } from "./build";
import type { VideoIndex } from "./types";

/**
 * Lưu VideoIndex vào cache trên đĩa.
 */
export function saveVideoIndexCache(
  index: VideoIndex,
  store: RevisionStore = getDefaultStore(),
): void {
  const cacheDir = join(store.getStudioDir(), "cache");
  if (!existsSync(cacheDir)) {
    try {
      mkdirSync(cacheDir, { recursive: true });
    } catch {}
  }
  const filePath = join(
    cacheDir,
    `video-index-${index.videoId}-${index.versionId}.json`,
  );
  writeFileSync(filePath, JSON.stringify(index, null, 2), "utf-8");
}

/**
 * Tải VideoIndex từ cache nếu có.
 */
export function loadVideoIndexCache(
  videoId: string,
  versionId: string,
  store: RevisionStore = getDefaultStore(),
): VideoIndex | null {
  const cacheDir = join(store.getStudioDir(), "cache");
  const filePath = join(cacheDir, `video-index-${videoId}-${versionId}.json`);
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content) as VideoIndex;
  } catch {
    return null;
  }
}

/**
 * Lấy VideoIndex từ cache nếu có, nếu chưa có thì xây dựng và lưu vào cache.
 */
export function getOrBuildVideoIndex(
  options: BuildVideoIndexOptions,
  store: RevisionStore = getDefaultStore(),
  forceRebuild = false,
): VideoIndex {
  if (!forceRebuild) {
    const cached = loadVideoIndexCache(
      options.videoId,
      options.versionId,
      store,
    );
    if (cached) {
      return cached;
    }
  }

  const index = buildVideoIndex(options);
  saveVideoIndexCache(index, store);
  return index;
}

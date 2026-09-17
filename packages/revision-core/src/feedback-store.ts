import type { FeedbackItem } from "./types";
import type { RevisionStore } from "./store";
import { getDefaultStore } from "./store";

export function getStudioDataDir(
  store: RevisionStore = getDefaultStore(),
): string {
  return store.getStudioDir();
}

/**
 * Góp ý người dùng thêm trong studio, theo video + phiên bản (C3-STO-06).
 * Sử dụng store.ts để thao tác IO trừu tượng.
 */
export function loadStoredFeedback(
  videoId: string,
  versionId: string,
  store: RevisionStore = getDefaultStore(),
): FeedbackItem[] {
  return store.loadStoredFeedback(videoId, versionId);
}

export function appendStoredFeedback(
  videoId: string,
  versionId: string,
  items: FeedbackItem[],
  store: RevisionStore = getDefaultStore(),
): FeedbackItem[] {
  return store.appendStoredFeedback(videoId, versionId, items);
}

/** Số thứ tự tiếp theo cho mã `gy-u-<k>`, không trùng với góp ý đã lưu. */
export function nextStoredFeedbackIndex(items: FeedbackItem[]): number {
  let max = 0;
  for (const f of items) {
    const m = /^gy-u-(\d+)$/.exec(f.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

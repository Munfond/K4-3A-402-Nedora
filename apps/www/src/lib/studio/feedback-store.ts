import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FeedbackItem } from "@/lib/revision/types";

/**
 * Góp ý người dùng thêm trong studio, theo video + phiên bản (C3-STO-06).
 * Chỉ lưu bản đã làm sạch: bỏ `rawText` (chưa ẩn PII); góp ý bị cách ly đã có
 * `sanitizedText` rỗng từ sanitizeFeedbackItem.
 */
export function getStudioDataDir(): string {
  if (process.env.STUDIO_DATA_DIR) return process.env.STUDIO_DATA_DIR;
  const cwd = process.cwd();
  const baseDir =
    cwd.endsWith("apps/www") || cwd.endsWith("apps\\www")
      ? cwd
      : join(cwd, "apps/www");
  return join(baseDir, ".data/studio");
}

const SAFE_ID = /^[a-z0-9-]{1,64}$/;

function storePath(videoId: string, versionId: string): string {
  if (!SAFE_ID.test(videoId) || !SAFE_ID.test(versionId)) {
    throw new Error("INPUT_INVALID: mã video hoặc phiên bản không hợp lệ");
  }
  return join(getStudioDataDir(), "feedback", `${videoId}-${versionId}.json`);
}

export function loadStoredFeedback(
  videoId: string,
  versionId: string,
): FeedbackItem[] {
  const path = storePath(videoId, versionId);
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    return Array.isArray(parsed.feedback) ? parsed.feedback : [];
  } catch {
    return [];
  }
}

export function appendStoredFeedback(
  videoId: string,
  versionId: string,
  items: FeedbackItem[],
): FeedbackItem[] {
  const path = storePath(videoId, versionId);
  const current = loadStoredFeedback(videoId, versionId);
  const cleaned = items.map(({ rawText: _rawText, ...rest }) => rest);
  const next = [...current, ...cleaned];
  mkdirSync(join(getStudioDataDir(), "feedback"), { recursive: true });
  writeFileSync(path, JSON.stringify({ feedback: next }, null, 2), "utf-8");
  return cleaned;
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

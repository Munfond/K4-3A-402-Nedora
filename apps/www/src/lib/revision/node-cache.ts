import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { getStudioDataDir } from "@/lib/studio/feedback-store";
import { redactForPersist } from "./sanitize";

/**
 * P3: cache kết quả từng node theo (nodeType, promptHash, schemaVersion, inputHash).
 * Nhờ đó thêm một góp ý chỉ phải gọi model cho phần thực sự đổi; các vùng có
 * đầu vào y hệt lần trước được dùng lại, không gọi model.
 */
export interface NodeCacheKey {
  nodeType: string;
  promptHash: string;
  schemaVersion: string;
  input: unknown;
}

export interface NodeCacheEntry<T = unknown> {
  key: string;
  nodeType: string;
  savedAt: string;
  /** runId đã sinh ra kết quả này, để truy vết khi dùng lại. */
  sourceRunId: string;
  output: T;
}

function cacheDir(): string {
  return join(getStudioDataDir(), "node-cache");
}

/** Hash ổn định: sắp xếp khóa để thứ tự trường không làm đổi key. */
export function stableHash(value: unknown): string {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .filter(([, val]) => val !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, val]) => [k, norm(val)]),
      );
    }
    return v;
  };
  return createHash("sha256")
    .update(JSON.stringify(norm(value)))
    .digest("hex");
}

export function buildNodeCacheKey(key: NodeCacheKey): string {
  return stableHash({
    nodeType: key.nodeType,
    promptHash: key.promptHash,
    schemaVersion: key.schemaVersion,
    inputHash: stableHash(key.input),
  });
}

export function readNodeCache<T>(key: NodeCacheKey): NodeCacheEntry<T> | null {
  if (process.env.REVISION_NODE_CACHE === "0") return null;
  const hashed = buildNodeCacheKey(key);
  const file = join(cacheDir(), `${hashed}.json`);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as NodeCacheEntry<T>;
  } catch {
    return null;
  }
}

export function writeNodeCache<T>(
  key: NodeCacheKey,
  output: T,
  sourceRunId: string,
): void {
  if (process.env.REVISION_NODE_CACHE === "0") return;
  const hashed = buildNodeCacheKey(key);
  const dir = cacheDir();
  mkdirSync(dir, { recursive: true });
  const entry: NodeCacheEntry<T> = {
    key: hashed,
    nodeType: key.nodeType,
    savedAt: new Date().toISOString(),
    sourceRunId,
    output,
  };
  writeFileSync(
    join(dir, `${hashed}.json`),
    JSON.stringify(redactForPersist(entry), null, 2),
    "utf-8",
  );
}

export function clearNodeCache(): number {
  const dir = cacheDir();
  if (!existsSync(dir)) return 0;
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  rmSync(dir, { recursive: true, force: true });
  return files.length;
}

import { createHash } from "node:crypto";
import { redactForPersist } from "./sanitize";
import { getDefaultStore, type RevisionStore } from "./store";

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
  sourceRunId: string;
  output: T;
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

export function readNodeCache<T>(
  key: NodeCacheKey,
  store: RevisionStore = getDefaultStore(),
): NodeCacheEntry<T> | null {
  if (process.env.REVISION_NODE_CACHE === "0") return null;
  const hashed = buildNodeCacheKey(key);
  return store.readCache(hashed) as NodeCacheEntry<T> | null;
}

export function writeNodeCache<T>(
  key: NodeCacheKey,
  outputOrParams: T | { sourceRunId: string; output: T },
  sourceRunIdOrStore?: string | RevisionStore,
  maybeStore?: RevisionStore,
): void {
  if (process.env.REVISION_NODE_CACHE === "0") return;
  const hashed = buildNodeCacheKey(key);

  let output: T;
  let sourceRunId: string;
  let store: RevisionStore;

  if (
    outputOrParams &&
    typeof outputOrParams === "object" &&
    "sourceRunId" in outputOrParams &&
    "output" in outputOrParams
  ) {
    const params = outputOrParams as { sourceRunId: string; output: T };
    output = params.output;
    sourceRunId = params.sourceRunId;
    store = (sourceRunIdOrStore as RevisionStore) || getDefaultStore();
  } else {
    output = outputOrParams as T;
    sourceRunId =
      typeof sourceRunIdOrStore === "string" ? sourceRunIdOrStore : "";
    store = maybeStore || getDefaultStore();
  }

  const entry: NodeCacheEntry<T> = {
    key: hashed,
    nodeType: key.nodeType,
    savedAt: new Date().toISOString(),
    sourceRunId,
    output: redactForPersist(output) as T,
  };
  store.writeCache(hashed, entry as NodeCacheEntry);
}

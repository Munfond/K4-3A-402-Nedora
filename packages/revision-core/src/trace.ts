import { randomBytes } from "node:crypto";
import type { RevisionRunResult, RunMetadata } from "./types";
import { redactForPersist } from "./sanitize";
import { getDefaultStore, type RevisionStore } from "./store";

export function generateRunId(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const mi = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  const hex = randomBytes(2).toString("hex");

  return `run-${yyyy}${mm}${dd}-${hh}${mi}${ss}-${hex}`;
}

export function saveRunTrace(
  params: {
    runId: string;
    metadata: RunMetadata;
    sanitizedInput: unknown;
    attempts: any[];
    result?: RevisionRunResult;
  },
  store: RevisionStore = getDefaultStore(),
): void {
  store.saveRunTrace({
    runId: params.runId,
    metadata: redactForPersist(params.metadata) as RunMetadata,
    sanitizedInput: redactForPersist(params.sanitizedInput),
    attempts: redactForPersist(params.attempts) as any[],
    result: params.result
      ? (redactForPersist(params.result) as RevisionRunResult)
      : undefined,
  });
}

export function getRunList(
  store: RevisionStore = getDefaultStore(),
): RunMetadata[] {
  return store.listRunSummaries();
}

export function getRunById(
  runId: string,
  store: RevisionStore = getDefaultStore(),
): {
  run: RunMetadata;
  result?: RevisionRunResult;
  input?: unknown;
} | null {
  const found = store.getRunById(runId);
  if (!found) return null;
  return {
    run: found.run,
    result: found.result,
    input: found.sanitizedInput,
  };
}

export function getRunTraceCombined(
  runId: string,
  store: RevisionStore = getDefaultStore(),
): unknown | null {
  const item = store.getRunById(runId);
  if (!item) return null;
  return redactForPersist({
    run: item.run,
    input: item.sanitizedInput,
    attempts: item.attempts || [],
    result: item.result,
  });
}

export function getRunsDir(store: RevisionStore = getDefaultStore()): string {
  return store.getRunsDir();
}

export function listRunSummaries(
  options?: Parameters<RevisionStore["listRunSummaries"]>[0],
  store: RevisionStore = getDefaultStore(),
): RunMetadata[] {
  return store.listRunSummaries(options);
}

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import type {
  FeedbackItem,
  RevisionRunResult,
  RunMetadata,
  RunDecisionState,
} from "./types";
import { type RunEvent, type NodeDebugData, setEventStore } from "./events";
import type { NodeCacheEntry } from "./node-cache";

export interface RevisionStore {
  getRunsDir(): string;
  getPackDir(): string;
  getStudioDir(): string;

  saveRunTrace(params: {
    runId: string;
    metadata: RunMetadata;
    sanitizedInput: unknown;
    attempts: any[];
    result?: RevisionRunResult;
  }): void;

  getRunById(runId: string): {
    run: RunMetadata;
    result?: RevisionRunResult;
    attempts?: any[];
    sanitizedInput?: unknown;
  } | null;

  listRunSummaries(options?: {
    videoId?: string;
    versionId?: string;
    mode?: string;
    caseId?: string;
  }): RunMetadata[];

  appendEvent(runId: string, event: RunEvent): void;
  readEvents(runId: string, afterSeq?: number): RunEvent[];

  saveNodeDebugData(runId: string, nodeData: NodeDebugData): void;
  readNodeDebugData(runId: string, nodeId: string): NodeDebugData | null;
  readAllNodesDebugData(runId: string): NodeDebugData[];

  readCache(key: string): NodeCacheEntry | null;
  writeCache(key: string, entry: NodeCacheEntry): void;

  loadStoredFeedback(videoId: string, versionId: string): FeedbackItem[];
  appendStoredFeedback(
    videoId: string,
    versionId: string,
    items: FeedbackItem[],
  ): FeedbackItem[];

  readPackFile(filename: string): string;

  loadDecisions(runId: string): RunDecisionState;
  saveDecisions(runId: string, state: RunDecisionState): void;
}

const SAFE_ID = /^[a-z0-9-]{1,64}$/;

export function findRepoRoot(startDir: string = process.cwd()): string {
  let curr = resolve(startDir);
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(curr, "pnpm-workspace.yaml"))) {
      return curr;
    }
    const parent = resolve(curr, "..");
    if (parent === curr) break;
    curr = parent;
  }
  return resolve(startDir);
}

function resolvePackDir(customPath?: string, base?: string): string {
  if (customPath && existsSync(customPath)) return customPath;
  if (
    process.env.REVISION_DATA_DIR &&
    existsSync(process.env.REVISION_DATA_DIR)
  ) {
    return process.env.REVISION_DATA_DIR;
  }
  const root = base ? resolve(base) : findRepoRoot();
  const candidates = [
    join(root, "data/studio-pack/c5-feedbackradar"),
    join(root, "apps/www/src/data"),
    join(root, "src/data"),
  ];
  for (const c of candidates) {
    if (
      existsSync(join(c, "kich-ban-d1.json")) ||
      existsSync(join(c, "video-mau/kich-ban-d1.json"))
    ) {
      return c;
    }
  }
  return join(root, "apps/www/src/data");
}

function resolveDataDir(
  subdir: string,
  customPath?: string,
  envVar?: string,
  base?: string,
): string {
  if (customPath) return customPath;
  if (envVar && process.env[envVar]) return process.env[envVar]!;
  const root = base ? resolve(base) : findRepoRoot();
  const candidates = [
    join(root, "apps/www/.data", subdir),
    join(root, ".data", subdir),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0];
}

export class FsRevisionStore implements RevisionStore {
  private runsDir: string;
  private packDir: string;
  private studioDir: string;
  private cacheDir: string;

  constructor(options?: {
    baseDir?: string;
    runsDir?: string;
    packDir?: string;
    studioDir?: string;
    cacheDir?: string;
  }) {
    const base = options?.baseDir || ".";
    this.runsDir = resolveDataDir(
      "revision-runs",
      options?.runsDir,
      "REVISION_RUNS_DIR",
      base,
    );
    this.packDir = resolvePackDir(options?.packDir, base);
    this.studioDir = resolveDataDir(
      "studio",
      options?.studioDir,
      "STUDIO_DATA_DIR",
      base,
    );
    this.cacheDir = options?.cacheDir || join(this.runsDir, ".cache");

    [this.runsDir, this.studioDir, this.cacheDir].forEach((dir) => {
      if (!existsSync(dir)) {
        try {
          mkdirSync(dir, { recursive: true });
        } catch {}
      }
    });
  }

  getRunsDir(): string {
    return this.runsDir;
  }

  getPackDir(): string {
    return this.packDir;
  }

  getStudioDir(): string {
    return this.studioDir;
  }

  saveRunTrace(params: {
    runId: string;
    metadata: RunMetadata;
    sanitizedInput: unknown;
    attempts: any[];
    result?: RevisionRunResult;
  }): void {
    const { runId, metadata, sanitizedInput, attempts, result } = params;
    const runDir = join(this.runsDir, runId);
    if (!existsSync(runDir)) {
      mkdirSync(runDir, { recursive: true });
    }

    writeFileSync(
      join(runDir, "run.json"),
      JSON.stringify(metadata, null, 2),
      "utf-8",
    );
    writeFileSync(
      join(runDir, "input.sanitized.json"),
      JSON.stringify(sanitizedInput, null, 2),
      "utf-8",
    );
    writeFileSync(
      join(runDir, "attempts.json"),
      JSON.stringify(attempts, null, 2),
      "utf-8",
    );

    if (result) {
      writeFileSync(
        join(runDir, "result.json"),
        JSON.stringify(result, null, 2),
        "utf-8",
      );
    }
  }

  getRunById(runId: string): {
    run: RunMetadata;
    result?: RevisionRunResult;
    attempts?: any[];
    sanitizedInput?: unknown;
  } | null {
    const runDir = join(this.runsDir, runId);
    if (!existsSync(runDir)) return null;

    try {
      const runJson = JSON.parse(
        readFileSync(join(runDir, "run.json"), "utf-8"),
      );
      let result: RevisionRunResult | undefined;
      const resultPath = join(runDir, "result.json");
      if (existsSync(resultPath)) {
        result = JSON.parse(readFileSync(resultPath, "utf-8"));
      }
      let attempts: any[] | undefined;
      const attemptsPath = join(runDir, "attempts.json");
      if (existsSync(attemptsPath)) {
        attempts = JSON.parse(readFileSync(attemptsPath, "utf-8"));
      }
      let sanitizedInput: unknown;
      const inputPath = join(runDir, "input.sanitized.json");
      if (existsSync(inputPath)) {
        sanitizedInput = JSON.parse(readFileSync(inputPath, "utf-8"));
      }

      return { run: runJson, result, attempts, sanitizedInput };
    } catch {
      return null;
    }
  }

  listRunSummaries(options?: {
    videoId?: string;
    versionId?: string;
    mode?: string;
    caseId?: string;
  }): RunMetadata[] {
    if (!existsSync(this.runsDir)) return [];
    const entries = readdirSync(this.runsDir, { withFileTypes: true });
    const runs: RunMetadata[] = [];

    for (const ent of entries) {
      if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
      const runFilePath = join(this.runsDir, ent.name, "run.json");
      if (existsSync(runFilePath)) {
        try {
          const run = JSON.parse(readFileSync(runFilePath, "utf-8"));
          if (options?.videoId && run.videoId !== options.videoId) continue;
          if (options?.versionId && run.versionId !== options.versionId)
            continue;
          if (options?.mode && run.mode !== options.mode) continue;
          if (options?.caseId && run.caseId !== options.caseId) continue;
          runs.push(run);
        } catch {}
      }
    }

    return runs.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  appendEvent(runId: string, event: RunEvent): void {
    const runDir = join(this.runsDir, runId);
    if (!existsSync(runDir)) {
      try {
        mkdirSync(runDir, { recursive: true });
      } catch {}
    }
    const eventsPath = join(runDir, "events.jsonl");
    appendFileSync(eventsPath, JSON.stringify(event) + "\n", "utf-8");
  }

  readEvents(runId: string, afterSeq = 0): RunEvent[] {
    const eventsPath = join(this.runsDir, runId, "events.jsonl");
    if (!existsSync(eventsPath)) return [];
    try {
      const content = readFileSync(eventsPath, "utf-8");
      return content
        .split("\n")
        .filter((l) => l.trim().length > 0)
        .map((l) => JSON.parse(l) as RunEvent)
        .filter((e) => e.seq > afterSeq);
    } catch {
      return [];
    }
  }

  saveNodeDebugData(runId: string, nodeData: NodeDebugData): void {
    const nodesDir = join(this.runsDir, runId, "nodes");
    if (!existsSync(nodesDir)) {
      try {
        mkdirSync(nodesDir, { recursive: true });
      } catch {}
    }
    const safeNodeId = nodeData.nodeId.replace(/:/g, "_");
    const nodeFile = join(nodesDir, `${safeNodeId}.json`);
    writeFileSync(nodeFile, JSON.stringify(nodeData, null, 2), "utf-8");
  }

  readNodeDebugData(runId: string, nodeId: string): NodeDebugData | null {
    const safeNodeId = nodeId.replace(/:/g, "_");
    const nodeFile = join(this.runsDir, runId, "nodes", `${safeNodeId}.json`);
    if (!existsSync(nodeFile)) return null;
    try {
      return JSON.parse(readFileSync(nodeFile, "utf-8")) as NodeDebugData;
    } catch {
      return null;
    }
  }

  readAllNodesDebugData(runId: string): NodeDebugData[] {
    const nodesDir = join(this.runsDir, runId, "nodes");
    if (!existsSync(nodesDir)) return [];
    try {
      const files = readdirSync(nodesDir);
      const result: NodeDebugData[] = [];
      for (const f of files) {
        if (f.endsWith(".json")) {
          const rawId = f.slice(0, -5);
          const data = this.readNodeDebugData(runId, rawId);
          if (data) result.push(data);
        }
      }
      return result;
    } catch {
      return [];
    }
  }

  readCache(key: string): NodeCacheEntry | null {
    const p = join(this.cacheDir, `${key}.json`);
    if (!existsSync(p)) return null;
    try {
      return JSON.parse(readFileSync(p, "utf-8"));
    } catch {
      return null;
    }
  }

  writeCache(key: string, entry: NodeCacheEntry): void {
    if (!existsSync(this.cacheDir)) {
      try {
        mkdirSync(this.cacheDir, { recursive: true });
      } catch {}
    }
    const p = join(this.cacheDir, `${key}.json`);
    writeFileSync(p, JSON.stringify(entry, null, 2), "utf-8");
  }

  loadStoredFeedback(videoId: string, versionId: string): FeedbackItem[] {
    if (!SAFE_ID.test(videoId) || !SAFE_ID.test(versionId)) {
      throw new Error("INPUT_INVALID: mã video hoặc phiên bản không hợp lệ");
    }
    const p = join(this.studioDir, "feedback", `${videoId}-${versionId}.json`);
    if (!existsSync(p)) return [];
    try {
      const parsed = JSON.parse(readFileSync(p, "utf-8"));
      return Array.isArray(parsed.feedback) ? parsed.feedback : [];
    } catch {
      return [];
    }
  }

  appendStoredFeedback(
    videoId: string,
    versionId: string,
    items: FeedbackItem[],
  ): FeedbackItem[] {
    if (!SAFE_ID.test(videoId) || !SAFE_ID.test(versionId)) {
      throw new Error("INPUT_INVALID: mã video hoặc phiên bản không hợp lệ");
    }
    const feedbackDir = join(this.studioDir, "feedback");
    if (!existsSync(feedbackDir)) {
      mkdirSync(feedbackDir, { recursive: true });
    }
    const p = join(feedbackDir, `${videoId}-${versionId}.json`);
    const current = this.loadStoredFeedback(videoId, versionId);
    const cleaned = items.map(({ rawText: _rawText, ...rest }) => rest);
    const next = [...current, ...cleaned];
    writeFileSync(p, JSON.stringify({ feedback: next }, null, 2), "utf-8");
    return cleaned;
  }

  readPackFile(filename: string): string {
    const p = join(this.packDir, filename);
    if (!existsSync(p)) {
      throw new Error(`File pack không tồn tại: ${p}`);
    }
    return readFileSync(p, "utf-8");
  }

  loadDecisions(runId: string): RunDecisionState {
    const p = join(this.runsDir, runId, "decisions.json");
    if (!existsSync(p)) {
      return { version: 0, decisions: {}, updatedAt: new Date().toISOString() };
    }
    try {
      return JSON.parse(readFileSync(p, "utf-8")) as RunDecisionState;
    } catch {
      return { version: 0, decisions: {}, updatedAt: new Date().toISOString() };
    }
  }

  saveDecisions(runId: string, state: RunDecisionState): void {
    const runDir = join(this.runsDir, runId);
    if (!existsSync(runDir)) {
      try {
        mkdirSync(runDir, { recursive: true });
      } catch {}
    }
    const p = join(runDir, "decisions.json");
    writeFileSync(p, JSON.stringify(state, null, 2), "utf-8");
  }
}

let defaultStore: RevisionStore | null = null;

export function getDefaultStore(): RevisionStore {
  if (!defaultStore) {
    defaultStore = new FsRevisionStore();
    setEventStore(defaultStore);
  }
  return defaultStore;
}

export function setDefaultStore(store: RevisionStore): void {
  defaultStore = store;
  setEventStore(store);
}

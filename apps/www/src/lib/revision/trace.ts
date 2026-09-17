import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import type {
  AnalyzeInput,
  RevisionRunResult,
  RunMetadata,
  ValidationChecks,
} from "./types";
import { redactForPersist } from "./sanitize";

export function getRunsDir(): string {
  if (process.env.REVISION_RUNS_DIR) {
    return process.env.REVISION_RUNS_DIR;
  }
  const baseDir =
    process.cwd().endsWith("apps/www") || process.cwd().endsWith("apps\\www")
      ? process.cwd()
      : join(process.cwd(), "apps/www");
  const defaultDir = join(baseDir, ".data/revision-runs");
  if (!existsSync(defaultDir)) {
    try {
      mkdirSync(defaultDir, { recursive: true });
    } catch {
      // Bỏ qua nếu đã tồn tại
    }
  }
  return defaultDir;
}

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

export function saveRunTrace(params: {
  runId: string;
  metadata: RunMetadata;
  sanitizedInput: unknown;
  attempts: any[];
  result?: RevisionRunResult;
}): void {
  const { runId, metadata, sanitizedInput, attempts, result } = params;
  const runsDir = getRunsDir();
  const runDir = join(runsDir, runId);

  if (!existsSync(runDir)) {
    mkdirSync(runDir, { recursive: true });
  }

  // 1. run.json
  writeFileSync(
    join(runDir, "run.json"),
    JSON.stringify(redactForPersist(metadata), null, 2),
    "utf-8",
  );

  // 2. input.json
  writeFileSync(
    join(runDir, "input.json"),
    JSON.stringify(redactForPersist(sanitizedInput), null, 2),
    "utf-8",
  );

  // 3. attempt-<k>.json
  attempts.forEach((att, idx) => {
    writeFileSync(
      join(runDir, `attempt-${idx + 1}.json`),
      JSON.stringify(redactForPersist(att), null, 2),
      "utf-8",
    );
  });

  // 4. result.json
  if (result) {
    writeFileSync(
      join(runDir, "result.json"),
      JSON.stringify(redactForPersist(result), null, 2),
      "utf-8",
    );
  }
}

export function getRunList(): RunMetadata[] {
  const runsDir = getRunsDir();
  if (!existsSync(runsDir)) return [];

  const entries = readdirSync(runsDir, { withFileTypes: true });
  const runs: RunMetadata[] = [];

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith("run-")) {
      const runJsonPath = join(runsDir, entry.name, "run.json");
      if (existsSync(runJsonPath)) {
        try {
          const content = JSON.parse(readFileSync(runJsonPath, "utf-8"));
          runs.push(content);
        } catch {
          // Bỏ qua nếu lỗi đọc
        }
      }
    }
  }

  // Sắp xếp mới nhất lên đầu
  runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return runs;
}

export function getRunById(runId: string): {
  run: RunMetadata;
  result?: RevisionRunResult;
  input?: unknown;
} | null {
  const runsDir = getRunsDir();
  const runDir = join(runsDir, runId);
  if (!existsSync(runDir)) return null;

  const runJsonPath = join(runDir, "run.json");
  if (!existsSync(runJsonPath)) return null;

  const run: RunMetadata = JSON.parse(readFileSync(runJsonPath, "utf-8"));

  let result: RevisionRunResult | undefined;
  const resultJsonPath = join(runDir, "result.json");
  if (existsSync(resultJsonPath)) {
    result = JSON.parse(readFileSync(resultJsonPath, "utf-8"));
  }

  let input: unknown;
  const inputJsonPath = join(runDir, "input.json");
  if (existsSync(inputJsonPath)) {
    input = JSON.parse(readFileSync(inputJsonPath, "utf-8"));
  }

  return { run, result, input };
}

export function getRunTraceCombined(runId: string): unknown | null {
  const item = getRunById(runId);
  if (!item) return null;

  const runsDir = getRunsDir();
  const runDir = join(runsDir, runId);

  const attempts: unknown[] = [];
  const entries = readdirSync(runDir);
  for (const f of entries) {
    if (f.startsWith("attempt-") && f.endsWith(".json")) {
      try {
        attempts.push(JSON.parse(readFileSync(join(runDir, f), "utf-8")));
      } catch {
        // bỏ qua
      }
    }
  }

  return redactForPersist({
    run: item.run,
    input: item.input,
    attempts,
    result: item.result,
  });
}

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { getRunsDir } from "./trace";
import { redactForPersist } from "./sanitize";

export type NodeType =
  | "N1_BAT_DAU"
  | "N2_NAP_NGU_CANH"
  | "N3_LAM_SACH_CHAN"
  | "N4_PHAN_LOAI"
  | "V1_KIEM_TRA_PHAN_LOAI"
  | "N5_DINH_VI"
  | "N6_GOM_VAN_DE"
  | "N7_CHIA_VUNG"
  | "N8_LAP_PHUONG_AN"
  | "V2_KIEM_TRA_PATCH"
  | "N9_TINH_VIEC"
  | "N10_GOP_KET_QUA"
  | "N11_KET_THUC"
  | "MODEL_PHAN_TICH"
  | "V_KIEM_TRA_VA_GOM_VUNG";

export type RunEvent =
  | {
      seq: number;
      at: string;
      type: "run.started";
      runId: string;
      videoId: string;
      versionId: string;
      graphVersion: string;
    }
  | {
      seq: number;
      at: string;
      type: "node.started";
      nodeId: string;
      nodeType: NodeType;
      parentId?: string;
      iterationKey?: string;
      attempt: number;
    }
  | {
      seq: number;
      at: string;
      type: "node.progress";
      nodeId: string;
      done: number;
      total: number;
      label: string;
    }
  | {
      seq: number;
      at: string;
      type: "node.finished";
      nodeId: string;
      status: "xong" | "loi" | "bo-qua";
      ms: number;
      tokens?: { input: number; output: number };
      summary: string;
      errorCode?: string;
    }
  | {
      seq: number;
      at: string;
      type: "partial";
      kind: "feedback.labeled" | "cases.ready" | "options.ready";
      payload: unknown;
    }
  | {
      seq: number;
      at: string;
      type: "run.finished";
      status: "xong";
      ms: number;
      totalTokens: number;
    }
  | {
      seq: number;
      at: string;
      type: "run.failed";
      errorCode: string;
      message: string;
    }
  | {
      seq: number;
      at: string;
      type: "heartbeat";
    };

export type RunEventInput =
  | {
      type: "run.started";
      runId: string;
      videoId: string;
      versionId: string;
      graphVersion: string;
    }
  | {
      type: "node.started";
      nodeId: string;
      nodeType: NodeType;
      parentId?: string;
      iterationKey?: string;
      attempt: number;
    }
  | {
      type: "node.progress";
      nodeId: string;
      done: number;
      total: number;
      label: string;
    }
  | {
      type: "node.finished";
      nodeId: string;
      status: "xong" | "loi" | "bo-qua";
      ms: number;
      tokens?: { input: number; output: number };
      summary: string;
      errorCode?: string;
    }
  | {
      type: "partial";
      kind: "feedback.labeled" | "cases.ready" | "options.ready";
      payload: unknown;
    }
  | {
      type: "run.finished";
      status: "xong";
      ms: number;
      totalTokens: number;
    }
  | {
      type: "run.failed";
      errorCode: string;
      message: string;
    }
  | {
      type: "heartbeat";
    };

export interface NodeDebugData {
  nodeId: string;
  nodeType: NodeType;
  status: "chua-chay" | "dang-chay" | "xong" | "loi" | "bo-qua";
  ms: number;
  tokens?: { input: number; output: number };
  attempts: number;
  promptVersion?: string;
  promptHash?: string;
  input: unknown;
  output?: unknown;
  findings?: unknown[];
  rawOutput?: unknown;
  error?: string;
}

// Global In-Memory Pub/Sub for Server-Sent Events (SSE)
type EventListener = (event: RunEvent) => void;
const subscribers = new Map<string, Set<EventListener>>();

export function subscribeRunEvents(
  runId: string,
  listener: EventListener,
): () => void {
  let set = subscribers.get(runId);
  if (!set) {
    set = new Set();
    subscribers.set(runId, set);
  }
  set.add(listener);

  return () => {
    const currentSet = subscribers.get(runId);
    if (currentSet) {
      currentSet.delete(listener);
      if (currentSet.size === 0) {
        subscribers.delete(runId);
      }
    }
  };
}

export function appendRunEvent(
  runId: string,
  eventData: RunEventInput,
  forcedSeq?: number,
): RunEvent {
  const runsDir = getRunsDir();
  const runDir = join(runsDir, runId);
  if (!existsSync(runDir)) {
    mkdirSync(runDir, { recursive: true });
  }

  const eventsFile = join(runDir, "events.jsonl");
  let seq = forcedSeq;
  if (seq === undefined) {
    const existing = readRunEvents(runId);
    seq = existing.length + 1;
  }

  const fullEvent: RunEvent = {
    ...eventData,
    seq,
    at: new Date().toISOString(),
  } as RunEvent;

  const redacted = redactForPersist(fullEvent);
  appendFileSync(eventsFile, JSON.stringify(redacted) + "\n", "utf-8");

  // Phát cho các subscribers SSE
  const set = subscribers.get(runId);
  if (set) {
    for (const listener of set) {
      try {
        listener(redacted as RunEvent);
      } catch {
        // bỏ qua nếu socket đóng
      }
    }
  }

  return redacted as RunEvent;
}

export function readRunEvents(runId: string, afterSeq = 0): RunEvent[] {
  const runsDir = getRunsDir();
  const eventsFile = join(runsDir, runId, "events.jsonl");
  if (!existsSync(eventsFile)) return [];

  try {
    const content = readFileSync(eventsFile, "utf-8");
    const lines = content
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const events: RunEvent[] = [];
    for (const line of lines) {
      try {
        const ev = JSON.parse(line) as RunEvent;
        if (ev.seq > afterSeq) {
          events.push(ev);
        }
      } catch {
        // bỏ qua dòng hỏng
      }
    }
    return events;
  } catch {
    return [];
  }
}

export function saveNodeDebugData(
  runId: string,
  nodeData: NodeDebugData,
): void {
  const runsDir = getRunsDir();
  const nodesDir = join(runsDir, runId, "nodes");
  if (!existsSync(nodesDir)) {
    mkdirSync(nodesDir, { recursive: true });
  }

  const filePath = join(nodesDir, `${nodeData.nodeId}.json`);
  const redacted = redactForPersist(nodeData);
  writeFileSync(filePath, JSON.stringify(redacted, null, 2), "utf-8");
}

export function getNodeDebugData(
  runId: string,
  nodeId: string,
): NodeDebugData | null {
  const runsDir = getRunsDir();
  const filePath = join(runsDir, runId, "nodes", `${nodeId}.json`);
  if (!existsSync(filePath)) return null;

  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as NodeDebugData;
  } catch {
    return null;
  }
}

export function getAllNodesDebugData(runId: string): NodeDebugData[] {
  const runsDir = getRunsDir();
  const nodesDir = join(runsDir, runId, "nodes");
  if (!existsSync(nodesDir)) return [];

  try {
    const { readdirSync } = require("node:fs");
    const files: string[] = readdirSync(nodesDir);
    const result: NodeDebugData[] = [];
    for (const f of files) {
      if (f.endsWith(".json")) {
        try {
          const item = JSON.parse(
            readFileSync(join(nodesDir, f), "utf-8"),
          ) as NodeDebugData;
          result.push(item);
        } catch {
          // Bỏ qua nếu lỗi
        }
      }
    }
    return result;
  } catch {
    return [];
  }
}

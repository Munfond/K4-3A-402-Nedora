import { redactForPersist } from "./sanitize";
import { PIPELINE_GRAPH } from "./pipeline/graph";
import type { RevisionStore } from "./store";

let eventStore: RevisionStore | null = null;

export function setEventStore(store: RevisionStore): void {
  eventStore = store;
}

export function getEventStore(): RevisionStore | null {
  return eventStore;
}

export type GraphNodeId =
  | "nhan-dau-vao"
  | "lam-sach"
  | "hieu-gop-y"
  | "kiem-tra-hieu"
  | "lap-ho-so"
  | "lap-phuong-an"
  | "de-xuat"
  | "kiem-tra-de-xuat"
  | "tinh-pham-vi"
  | "cho-duyet"
  | "ap-dung"
  | "xuat-goi";

export type NodeType =
  | GraphNodeId
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
  | "V_KIEM_TRA_VA_GOM_VUNG"
  | (string & {});

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
      iterationKey?: string;
      done: number;
      total: number;
      label: string;
    }
  | {
      seq: number;
      at: string;
      type: "node.finished";
      nodeId: string;
      iterationKey?: string;
      status: "xong" | "loi" | "bo-qua";
      ms: number;
      tokens?: { input: number; output: number };
      summary: string;
      errorCode?: string;
    }
  | {
      seq: number;
      at: string;
      type: "node.skipped";
      nodeId: string;
      iterationKey?: string;
      reason: string;
    }
  | {
      seq: number;
      at: string;
      type: "node.retry";
      nodeId: string;
      iterationKey?: string;
      attempt: number;
      reason: string;
    }
  | {
      seq: number;
      at: string;
      type: "node.cache_hit";
      nodeId: string;
      iterationKey?: string;
      sourceRunId?: string;
    }
  | {
      seq: number;
      at: string;
      type: "partial";
      kind:
        | "feedback.labeled"
        | "cases.ready"
        | "options.ready"
        | "case.options.ready"
        | "brief.ready"
        | "claims.ready"
        | "issues.ready";

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
      type: "tool.called";
      toolName: string;
      nodeId?: string;
      ms: number;
      ok: boolean;
      bytes: number;
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
      iterationKey?: string;
      done: number;
      total: number;
      label: string;
    }
  | {
      type: "node.finished";
      nodeId: string;
      iterationKey?: string;
      status: "xong" | "loi" | "bo-qua";
      ms: number;
      tokens?: { input: number; output: number };
      summary: string;
      errorCode?: string;
    }
  | {
      type: "node.skipped";
      nodeId: string;
      iterationKey?: string;
      reason: string;
    }
  | {
      type: "node.retry";
      nodeId: string;
      iterationKey?: string;
      attempt: number;
      reason: string;
    }
  | {
      type: "node.cache_hit";
      nodeId: string;
      iterationKey?: string;
      sourceRunId?: string;
    }
  | {
      type: "partial";
      kind:
        | "feedback.labeled"
        | "cases.ready"
        | "options.ready"
        | "case.options.ready"
        | "brief.ready"
        | "claims.ready"
        | "issues.ready";

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
      type: "tool.called";
      toolName: string;
      nodeId?: string;
      ms: number;
      ok: boolean;
      bytes: number;
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

const VALID_GRAPH_NODE_IDS = new Set(PIPELINE_GRAPH.map((n) => n.id));

export function appendRunEvent(
  runId: string,
  eventData: RunEventInput,
  forcedSeq?: number,
  store?: RevisionStore,
): RunEvent {
  const effectiveStore = store || getEventStore();

  if (eventData.type === "node.started") {
    const baseId = eventData.nodeId.split(":")[0];
    const isKnown =
      VALID_GRAPH_NODE_IDS.has(eventData.nodeId) ||
      VALID_GRAPH_NODE_IDS.has(baseId) ||
      eventData.nodeId.startsWith("N") ||
      eventData.nodeId.startsWith("V") ||
      eventData.nodeId === "MODEL_PHAN_TICH";

    if (
      !isKnown &&
      typeof process !== "undefined" &&
      process.env?.NODE_ENV !== "production"
    ) {
      console.warn(
        `[events] Cảnh báo: nodeId '${eventData.nodeId}' không thuộc PIPELINE_GRAPH`,
      );
    }
  }

  const existing = effectiveStore ? effectiveStore.readEvents(runId) : [];
  const isTerminal = existing.some(
    (e) => e.type === "run.finished" || e.type === "run.failed",
  );
  if (isTerminal) {
    // Sau run.failed hoặc run.finished không ghi thêm sự kiện
    return existing[existing.length - 1];
  }

  let seq = forcedSeq;
  if (seq === undefined) {
    seq = existing.length + 1;
  }

  const fullEvent: RunEvent = {
    ...eventData,
    seq,
    at: new Date().toISOString(),
  } as RunEvent;

  const redacted = redactForPersist(fullEvent) as RunEvent;
  if (effectiveStore) {
    effectiveStore.appendEvent(runId, redacted);
  }

  const set = subscribers.get(runId);
  if (set) {
    for (const listener of set) {
      try {
        listener(redacted);
      } catch {
        // ignore closed listeners
      }
    }
  }

  return redacted;
}

export function readRunEvents(
  runId: string,
  afterSeq = 0,
  store?: RevisionStore,
): RunEvent[] {
  const effectiveStore = store || getEventStore();
  return effectiveStore ? effectiveStore.readEvents(runId, afterSeq) : [];
}

export function saveNodeDebugData(
  runId: string,
  nodeData: NodeDebugData,
  store?: RevisionStore,
): void {
  const effectiveStore = store || getEventStore();
  const redacted = redactForPersist(nodeData) as NodeDebugData;
  if (effectiveStore) {
    effectiveStore.saveNodeDebugData(runId, redacted);
  }
}

export function readNodeDebugData(
  runId: string,
  nodeId: string,
  store?: RevisionStore,
): NodeDebugData | null {
  const effectiveStore = store || getEventStore();
  return effectiveStore
    ? effectiveStore.readNodeDebugData(runId, nodeId)
    : null;
}

export function readAllNodesDebugData(
  runId: string,
  store?: RevisionStore,
): NodeDebugData[] {
  const effectiveStore = store || getEventStore();
  return effectiveStore ? effectiveStore.readAllNodesDebugData(runId) : [];
}

export const getNodeDebugData = readNodeDebugData;
export const getAllNodesDebugData = readAllNodesDebugData;

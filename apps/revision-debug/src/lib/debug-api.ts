export const SERVICE_BASE_URL = "http://127.0.0.1:8000";
// Không có token mặc định trong bundle: kỹ sư tự nhập token của service.
export function getDebugToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem("revision_debug_token") || "";
  } catch {
    return "";
  }
}

export function setDebugToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("revision_debug_token", token);
  }
}

async function debugRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getDebugToken();
  const res = await fetch(
    `${SERVICE_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    },
  );

  if (!res.ok) {
    let errData: any = {};
    try {
      errData = await res.json();
    } catch {
      errData = { message: await res.text() };
    }
    const err = new Error(
      errData?.error?.message || errData?.message || `HTTP ${res.status}`,
    );
    (err as any).statusCode = res.status;
    (err as any).code = errData?.error?.code;
    throw err;
  }

  return res.json() as Promise<T>;
}

export interface DebugRunMeta {
  runId: string;
  status: string;
  createdAt: string;
  inputHash: string;
  modelId: string;
  promptVersion: string;
  promptHash: string;
  graphVersion: string;
  videoId?: string;
  versionId?: string;
  mode?: "that" | "gia-lap";
  caseId?: string;
  retryOf?: string;
  caseCount?: number;
  totalFeedback?: number;
  durationMs?: number;
  attempts?: any[];
}

export interface NodeDebugEntry {
  nodeId: string;
  nodeType: string;
  status: "xong" | "loi" | "dang-chay" | "bo-qua";
  ms?: number;
  attempts?: number;
  promptVersion?: string;
  promptHash?: string;
  modelId?: string;
  tokens?: { input: number; output: number };
  input?: unknown;
  output?: unknown;
  error?: string;
}

export const debugApi = {
  async getPipeline(version?: string) {
    const q = version ? `?version=${encodeURIComponent(version)}` : "";
    const res = await fetch(`${SERVICE_BASE_URL}/pipeline${q}`);
    return res.json();
  },

  async listRuns(filters?: {
    videoId?: string;
    versionId?: string;
    mode?: string;
    caseId?: string;
  }) {
    const params = new URLSearchParams();
    if (filters?.videoId) params.set("videoId", filters.videoId);
    if (filters?.versionId) params.set("versionId", filters.versionId);
    if (filters?.mode) params.set("mode", filters.mode);
    if (filters?.caseId) params.set("caseId", filters.caseId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return debugRequest<{ runs: DebugRunMeta[] }>(`/debug/runs${qs}`);
  },

  async getRunNodes(runId: string) {
    return debugRequest<{ runId: string; nodes: NodeDebugEntry[] }>(
      `/debug/runs/${runId}/nodes`,
    );
  },

  async getNodeDetail(runId: string, nodeId: string, iterationKey?: string) {
    const q = iterationKey
      ? `?iterationKey=${encodeURIComponent(iterationKey)}`
      : "";
    return debugRequest<{ runId: string; node: NodeDebugEntry }>(
      `/debug/runs/${runId}/nodes/${nodeId}${q}`,
    );
  },

  async replayNode(runId: string, nodeId: string, iterationKey?: string) {
    const q = iterationKey
      ? `?iterationKey=${encodeURIComponent(iterationKey)}`
      : "";
    return debugRequest<{
      childRunId: string;
      parentRunId: string;
      replayedNodeId: string;
      status: string;
    }>(`/debug/runs/${runId}/nodes/${nodeId}/replay${q}`, {
      method: "POST",
    });
  },

  async compareRuns(runIdA: string, runIdB: string) {
    return debugRequest<{
      runA: string;
      runB: string;
      comparison: Record<
        string,
        {
          nodeId: string;
          statusA?: string;
          statusB?: string;
          msA?: number;
          msB?: number;
          tokensA?: { input: number; output: number };
          tokensB?: { input: number; output: number };
          outputMatches: boolean;
        }
      >;
    }>(
      `/debug/compare?a=${encodeURIComponent(runIdA)}&b=${encodeURIComponent(runIdB)}`,
    );
  },

  async getEvalRuns() {
    return debugRequest<{ evalRuns: any[] }>("/debug/eval/runs");
  },

  async getEvalRunDetail(evalRunId: string) {
    return debugRequest<any>(
      `/debug/eval/runs/${encodeURIComponent(evalRunId)}`,
    );
  },

  subscribeRunEvents(
    runId: string,
    onEvent: (ev: any) => void,
    onError?: (err: any) => void,
  ) {
    // Service đóng luồng khi run kết thúc; đóng phía trình duyệt để nó không tự
    // nối lại và phát lại toàn bộ sự kiện. Sự kiện trùng bị loại theo seq.
    let lastSeq = 0;
    let ended = false;
    const sse = new EventSource(`${SERVICE_BASE_URL}/runs/${runId}/events`);
    sse.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (typeof data.seq === "number") {
          if (data.seq <= lastSeq) return;
          lastSeq = data.seq;
        }
        onEvent(data);
        if (data.type === "run.finished" || data.type === "run.failed") {
          ended = true;
          sse.close();
        }
      } catch (err) {
        console.error("SSE parse error", err);
      }
    };
    sse.onerror = (e) => {
      if (ended) return;
      sse.close();
      onError?.(e);
    };
    return () => sse.close();
  },
};

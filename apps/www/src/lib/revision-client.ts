import type {
  AnalyzeInput,
  DecisionRecord,
  DecisionType,
  FeedbackItem,
  NewFeedbackInput,
  ReleaseSnapshot,
  RevisionRunResult,
  RunMetadata,
  ScriptData,
  ExportPackage,
} from "@feedback/revision-core/types";
import type { GraphNodeDefinition } from "@feedback/revision-core/pipeline/graph";

export class RevisionServiceError extends Error {
  code: string;
  statusCode?: number;
  isConnectionError: boolean;
  serviceUrl: string;

  constructor(
    message: string,
    options?: {
      code?: string;
      statusCode?: number;
      isConnectionError?: boolean;
      serviceUrl?: string;
    },
  ) {
    super(message);
    this.name = "RevisionServiceError";
    this.code = options?.code || "SERVICE_ERROR";
    this.statusCode = options?.statusCode;
    this.isConnectionError = Boolean(options?.isConnectionError);
    this.serviceUrl = options?.serviceUrl || getServiceUrl();
  }
}

/** Rỗng khi chưa cấu hình; requireServiceUrl() báo lỗi thay vì tự đoán địa chỉ. */
export function getServiceUrl(): string {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_REVISION_SERVICE_URL || "";
  }
  return (
    process.env.REVISION_SERVICE_URL ||
    process.env.NEXT_PUBLIC_REVISION_SERVICE_URL ||
    ""
  );
}

function requireServiceUrl(): string {
  const baseUrl = getServiceUrl();
  if (!baseUrl) {
    throw new RevisionServiceError(
      "Chưa cấu hình địa chỉ Revision service (NEXT_PUBLIC_REVISION_SERVICE_URL, REVISION_SERVICE_URL)",
      {
        code: "SERVICE_NOT_CONFIGURED",
        isConnectionError: true,
        serviceUrl: "",
      },
    );
  }
  return baseUrl;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = requireServiceUrl();
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    if (!res.ok) {
      let errData: any = {};
      try {
        errData = await res.json();
      } catch {
        errData = { message: await res.text() };
      }

      const errCode =
        errData?.error?.code ||
        (res.status === 409 ? "VERSION_CONFLICT" : "REQUEST_FAILED");
      const errMsg =
        errData?.error?.message || errData?.message || `Lỗi HTTP ${res.status}`;

      const error = new RevisionServiceError(errMsg, {
        code: errCode,
        statusCode: res.status,
        serviceUrl: baseUrl,
      });
      (error as any).data = errData;
      throw error;
    }

    return (await res.json()) as T;
  } catch (err: unknown) {
    if (err instanceof RevisionServiceError) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new RevisionServiceError(
      `Không kết nối được Revision service (${baseUrl}): ${msg}`,
      {
        code: "SERVICE_UNAVAILABLE",
        isConnectionError: true,
        serviceUrl: baseUrl,
      },
    );
  }
}

export const revisionClient = {
  getServiceUrl,

  async checkHealth(): Promise<{ ok: boolean; status?: string }> {
    return request<{ ok: boolean; status?: string }>("/health");
  },

  async getPipelineGraph(
    version?: string,
  ): Promise<{ graph: GraphNodeDefinition[]; version: string }> {
    const q = version ? `?version=${encodeURIComponent(version)}` : "";
    return request<{ graph: GraphNodeDefinition[]; version: string }>(
      `/pipeline${q}`,
    );
  },

  async startRun(
    input: AnalyzeInput,
  ): Promise<{ runId: string; graphVersion: string; status: string }> {
    return request<{ runId: string; graphVersion: string; status: string }>(
      "/runs",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  async listRuns(): Promise<{ runs: RunMetadata[] }> {
    return request<{ runs: RunMetadata[] }>("/runs");
  },

  async getRun(
    runId: string,
  ): Promise<{
    run: RunMetadata;
    result?: RevisionRunResult;
    input?: unknown;
  }> {
    return request<{
      run: RunMetadata;
      result?: RevisionRunResult;
      input?: unknown;
    }>(`/runs/${runId}`);
  },

  async getTrace(runId: string): Promise<any> {
    return request<any>(`/runs/${runId}/trace`);
  },

  async cancelRun(runId: string): Promise<{ ok: boolean; cancelled: boolean }> {
    return request<{ ok: boolean; cancelled: boolean }>(
      `/runs/${runId}/cancel`,
      {
        method: "POST",
      },
    );
  },

  getRunEventsUrl(runId: string, after = 0): string {
    const base = requireServiceUrl();
    return `${base}/runs/${runId}/events?after=${after}`;
  },

  async getVideos(): Promise<{ videos: any[] }> {
    return request<{ videos: any[] }>("/videos");
  },

  async getVideo(id: string): Promise<{ id: string; script: ScriptData }> {
    return request<{ id: string; script: ScriptData }>(`/videos/${id}`);
  },

  async getVideoFeedback(
    id: string,
    versionId = "v1",
  ): Promise<{ feedback: FeedbackItem[] }> {
    return request<{ feedback: FeedbackItem[] }>(
      `/videos/${id}/feedback?versionId=${encodeURIComponent(versionId)}`,
    );
  },

  async saveVideoFeedback(
    id: string,
    items: NewFeedbackInput[],
    versionId = "v1",
  ): Promise<{ items: FeedbackItem[] }> {
    return request<{ items: FeedbackItem[] }>(`/videos/${id}/feedback`, {
      method: "POST",
      body: JSON.stringify({ items, versionId }),
    });
  },

  async importVideoFeedback(
    id: string,
    csv: string,
    dryRun = false,
    versionId = "v1",
  ): Promise<any> {
    const q = dryRun ? "?dryRun=1" : "";
    return request<any>(`/videos/${id}/feedback/import${q}`, {
      method: "POST",
      body: JSON.stringify({ csv, versionId }),
    });
  },

  async getDecisionsAndRelease(
    runId: string,
  ): Promise<{
    version: number;
    decisions: Record<string, DecisionRecord>;
    snapshot: ReleaseSnapshot;
  }> {
    return request<{
      version: number;
      decisions: Record<string, DecisionRecord>;
      snapshot: ReleaseSnapshot;
    }>(`/runs/${runId}/release`);
  },

  async saveDecision(
    runId: string,
    caseId: string,
    decision: {
      type: DecisionType;
      optionId?: string;
      reason?: string;
      expectedVersion?: number;
    },
  ): Promise<{
    version: number;
    decisions: Record<string, DecisionRecord>;
    snapshot: ReleaseSnapshot;
  }> {
    return request<{
      version: number;
      decisions: Record<string, DecisionRecord>;
      snapshot: ReleaseSnapshot;
    }>(`/runs/${runId}/decisions/${encodeURIComponent(caseId)}`, {
      method: "PUT",
      body: JSON.stringify(decision),
    });
  },

  async exportReleaseFile(
    runId: string,
    file:
      | "kich-ban-v2.json"
      | "kich-ban-v2.md"
      | "viec-can-lam.csv"
      | "truy-vet.json",
    decisions?: Record<string, DecisionRecord>,
  ): Promise<Blob> {
    const baseUrl = requireServiceUrl();
    const url = `${baseUrl}/runs/${runId}/export`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file, decisions }),
    });

    if (!res.ok) {
      let errJson: any = {};
      try {
        errJson = await res.json();
      } catch {}
      throw new RevisionServiceError(
        errJson?.error?.message || `Lỗi tải file (${res.status})`,
        {
          code: errJson?.error?.code,
          statusCode: res.status,
          serviceUrl: baseUrl,
        },
      );
    }

    return res.blob();
  },

  async exportAllHandover(
    runId: string,
    decisions?: Record<string, DecisionRecord>,
  ): Promise<ExportPackage> {
    return request<ExportPackage>(`/runs/${runId}/export`, {
      method: "POST",
      body: JSON.stringify({ decisions }),
    });
  },
};

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  Loader2,
  RefreshCw,
  StopCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DecisionCase, RunMetadata } from "@/lib/revision/types";
import type { RunEvent } from "@/lib/revision/events";

interface AnalysisProgressPanelProps {
  runId: string;
  runMeta?: RunMetadata;
  onFinished: () => void;
  onRetry: () => void;
}

interface NodeState {
  nodeId: string;
  label: string;
  status: "chua-chay" | "dang-chay" | "xong" | "loi";
  summary?: string;
  ms?: number;
  tokens?: { input: number; output: number };
  /** Nhịp báo còn sống của node đang chạy (giây), từ sự kiện node.progress. */
  runningSeconds?: number;
  progressLabel?: string;
}

const DEFAULT_NODES: Array<{ id: string; label: string }> = [
  { id: "N1_BAT_DAU", label: "Khởi động đợt phân tích" },
  { id: "N2_NAP_NGU_CANH", label: "Nạp ngữ cảnh kịch bản & timecode" },
  {
    id: "N3_LAM_SACH_CHAN",
    label: "Làm sạch & kiểm soát an toàn (chặn PII/canary)",
  },
  { id: "MODEL_PHAN_TICH", label: "Gọi AI phân loại & lập phương án sửa" },
  {
    id: "V_KIEM_TRA_VA_GOM_VUNG",
    label: "Kiểm tra bằng code & lập hồ sơ vùng",
  },
];

export default function AnalysisProgressPanel({
  runId,
  runMeta,
  onFinished,
  onRetry,
}: AnalysisProgressPanelProps) {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);
  const [runError, setRunError] = useState<{
    code: string;
    message: string;
  } | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [partialCases, setPartialCases] = useState<DecisionCase[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);

  // 1. Timer thời gian thực đếm giây
  useEffect(() => {
    if (isCompleted || runError) return;
    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isCompleted, runError]);

  // 2. Kết nối Server-Sent Events (SSE) với tự động khôi phục sự kiện lỡ (after=seq)
  useEffect(() => {
    let active = true;
    let eventSource: EventSource | null = null;

    const connectSSE = () => {
      if (!runId) return;
      const lastSeq = events.length > 0 ? events[events.length - 1].seq : 0;
      eventSource = new EventSource(
        `/api/revisions/runs/${runId}/events?after=${lastSeq}`,
      );

      const handleEvent = (ev: MessageEvent) => {
        if (!active) return;
        try {
          const runEvent = JSON.parse(ev.data) as RunEvent;
          setEvents((prev) => {
            if (prev.some((e) => e.seq === runEvent.seq)) return prev;
            return [...prev, runEvent];
          });

          if (runEvent.type === "partial" && runEvent.kind === "cases.ready") {
            setPartialCases(runEvent.payload as DecisionCase[]);
          } else if (runEvent.type === "run.finished") {
            setIsCompleted(true);
            onFinished();
          } else if (runEvent.type === "run.failed") {
            setRunError({
              code: runEvent.errorCode,
              message: runEvent.message,
            });
          }
        } catch {
          // Bỏ qua nếu parse json lỗi
        }
      };

      eventSource.addEventListener("run.started", handleEvent);
      eventSource.addEventListener("node.started", handleEvent);
      eventSource.addEventListener("node.finished", handleEvent);
      eventSource.addEventListener("node.progress", handleEvent);
      eventSource.addEventListener("partial", handleEvent);
      eventSource.addEventListener("run.finished", handleEvent);
      eventSource.addEventListener("run.failed", handleEvent);

      eventSource.onerror = () => {
        // Fallback polling nếu SSE bị ngắt kết nối
        eventSource?.close();
      };
    };

    connectSSE();

    return () => {
      active = false;
      eventSource?.close();
    };
  }, [runId, onFinished, events.length]);

  // 3. Tính toán trạng thái các Node từ sự kiện thực tế
  const nodeStates = useMemo(() => {
    const map = new Map<string, NodeState>();
    for (const def of DEFAULT_NODES) {
      map.set(def.id, {
        nodeId: def.id,
        label: def.label,
        status: "chua-chay",
      });
    }

    for (const ev of events) {
      if (ev.type === "node.started") {
        const curr = map.get(ev.nodeId) || {
          nodeId: ev.nodeId,
          label: ev.nodeId,
          status: "dang-chay",
        };
        curr.status = "dang-chay";
        map.set(ev.nodeId, curr);
      } else if (ev.type === "node.progress") {
        const curr = map.get(ev.nodeId);
        if (curr) {
          curr.runningSeconds = ev.done;
          curr.progressLabel = ev.label;
          map.set(ev.nodeId, curr);
        }
      } else if (ev.type === "node.finished") {
        const curr = map.get(ev.nodeId) || {
          nodeId: ev.nodeId,
          label: ev.nodeId,
          status: "xong",
        };
        curr.status = ev.status === "loi" ? "loi" : "xong";
        curr.summary = ev.summary;
        curr.ms = ev.ms;
        curr.tokens = ev.tokens;
        map.set(ev.nodeId, curr);
      }
    }

    return Array.from(map.values());
  }, [events]);

  // 4. Xử lý Hủy đợt phân tích (AP-04)
  const handleCancel = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy đợt phân tích này?")) return;
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/revisions/runs/${runId}/cancel`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (data?.code === "RUN_CANCELLED") {
        setRunError({
          code: "RUN_CANCELLED",
          message: "Đợt phân tích đã được hủy theo yêu cầu",
        });
      }
    } catch {
      // bỏ qua
    } finally {
      setIsCancelling(false);
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Trạng thái thu gọn khi đã hoàn tất
  if (isCompleted && !isExpanded) {
    return (
      <div className="rounded-xl border bg-card p-3 shadow-xs flex items-center justify-between text-xs mb-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          <span className="font-medium text-foreground">
            Phân tích xong trong {formatTimer(elapsedSeconds)} ·{" "}
            {partialCases.length || runMeta?.caseCount || 0} vùng · kiểm tra
            bằng code: Đạt
          </span>
          <Badge variant="outline" className="font-mono text-[10px]">
            {runId}
          </Badge>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(true)}
          className="h-6 px-2 text-[11px] gap-1"
        >
          <span>Xem chi tiết tiến trình</span>
          <ChevronDown className="size-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-primary/20 bg-card/60 backdrop-blur shadow-sm p-4 space-y-4 mb-6">
      {/* HEADER BẢNG TIẾN TRÌNH */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-2">
          {runError ? (
            <XCircle className="size-5 text-rose-500 shrink-0" />
          ) : isCompleted ? (
            <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
          ) : (
            <Loader2 className="size-5 text-primary animate-spin shrink-0" />
          )}

          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground">
                {runError
                  ? "Đợt phân tích gặp lỗi hoặc đã bị dừng"
                  : isCompleted
                    ? "Đợt phân tích đã hoàn tất thành công"
                    : "Đang tiến hành phân tích theo node"}
              </span>
              <Badge variant="outline" className="font-mono text-[10px]">
                {runId}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono mt-0.5">
              <span>Mô hình: {runMeta?.modelId || "openai/gpt-5.6-terra"}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock className="size-3" /> {formatTimer(elapsedSeconds)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isCompleted && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(false)}
              className="h-7 px-2 text-xs gap-1 text-muted-foreground"
            >
              <ChevronUp className="size-3" /> Thu gọn
            </Button>
          )}

          {!isCompleted && !runError && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isCancelling}
              onClick={handleCancel}
              className="h-7 px-2.5 text-xs gap-1 border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              <StopCircle className="size-3.5" />
              <span>{isCancelling ? "Đang hủy…" : "Hủy"}</span>
            </Button>
          )}

          {runError && (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onRetry}
              className="h-7 px-2.5 text-xs gap-1"
            >
              <RefreshCw className="size-3.5" /> Thử lại
            </Button>
          )}
        </div>
      </div>

      {/* DANH SÁCH CÁC NODE TIẾN TRÌNH THỰC TẾ (KHÔNG DÙNG THANH % ẢO) */}
      <div className="space-y-2 text-xs">
        {nodeStates.map((n) => (
          <div
            key={n.nodeId}
            className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
              n.status === "dang-chay"
                ? "bg-primary/5 border-primary/40 ring-1 ring-primary/20"
                : n.status === "xong"
                  ? "bg-muted/30 border-border/80"
                  : n.status === "loi"
                    ? "bg-rose-50/20 border-rose-300"
                    : "bg-muted/10 border-dashed border-border/60 text-muted-foreground"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {n.status === "xong" ? (
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
              ) : n.status === "dang-chay" ? (
                <Loader2 className="size-4 text-primary animate-spin shrink-0" />
              ) : n.status === "loi" ? (
                <XCircle className="size-4 text-rose-600 shrink-0" />
              ) : (
                <div className="size-4 rounded-full border-2 border-muted-foreground/40 shrink-0" />
              )}

              <div className="min-w-0">
                <span className="font-semibold text-foreground mr-2">
                  {n.label}
                </span>
                {n.summary && (
                  <span className="text-[11px] text-muted-foreground font-mono">
                    ({n.summary})
                  </span>
                )}
              </div>
            </div>

            <div className="shrink-0 font-mono text-[11px] text-muted-foreground pl-2">
              {n.ms != null ? (
                <span>{(n.ms / 1000).toFixed(1)}s</span>
              ) : n.status === "dang-chay" ? (
                <span className="text-primary font-medium">
                  {n.runningSeconds != null
                    ? `${n.progressLabel ?? "đang chạy"} ${n.runningSeconds}s…`
                    : "đang chạy…"}
                </span>
              ) : (
                <span>chờ</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* LỖI NẾU CÓ */}
      {runError && (
        <div className="rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50/30 dark:bg-rose-950/20 p-3 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2.5">
          <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold flex items-center gap-2">
              <span>Lỗi phân tích: {runError.code}</span>
            </div>
            <p className="leading-relaxed">{runError.message}</p>
          </div>
        </div>
      )}

      {/* HIỂN THỊ CÁC VÙNG SỬA XEM TRƯỚC NẾU CÓ cases.ready (Mục 5.2) */}
      {partialCases.length > 0 && (
        <div className="pt-2 border-t space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs flex items-center gap-1.5 text-foreground">
              <Layers className="size-3.5 text-primary" />
              <span>
                Các vùng cần xem ({partialCases.length} vùng đã định vị)
              </span>
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              Hiển thị sớm từ sự kiện cases.ready
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {partialCases.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border p-2 bg-card text-xs space-y-1 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-1 text-[10px]">
                  <Badge
                    variant="outline"
                    className="font-mono text-[9px] border-primary/40 text-primary"
                  >
                    {c.id}
                  </Badge>
                  <span className="text-muted-foreground font-mono">
                    Câu {c.sentenceNs.join(", ")}
                  </span>
                </div>
                <p className="font-medium text-foreground text-[11px] truncate">
                  {c.title}
                </p>
                <p className="text-muted-foreground text-[10px] line-clamp-1">
                  {c.options.length > 0
                    ? `✓ ${c.options.length} phương án`
                    : "◐ đang lập phương án…"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

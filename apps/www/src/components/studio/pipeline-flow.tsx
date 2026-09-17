"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  Layers,
  Loader2,
  MinusCircle,
  RefreshCw,
  StopCircle,
  UserCheck,
  Wrench,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getUserVisibleNodes,
  type PipelineNodeDef,
} from "@/lib/revision/pipeline/graph";
import type {
  DecisionCase,
  RevisionOption,
  RunMetadata,
} from "@/lib/revision/types";
import type { RunEvent } from "@/lib/revision/events";
import { revisionClient } from "@/lib/revision-client";

export type NodeStatus =
  | "chua-chay"
  | "dang-chay"
  | "xong"
  | "loi"
  | "bo-qua"
  | "dung-lai-ket-qua-truoc";

export interface PipelineFlowProps {
  runId?: string;
  runMeta?: RunMetadata;
  isAnalyzing?: boolean;
  onFinished?: () => void;
  onRetry?: () => void;
  onPartialCases?: (cases: DecisionCase[]) => void;
  onCaseOptionsReady?: (payload: {
    caseId: string;
    options: RevisionOption[];
    standaloneWork: boolean;
  }) => void;
}

interface NodeState {
  id: string;
  label: string;
  kind: "code" | "ai" | "iteration" | "human";
  status: NodeStatus;
  summary?: string;
  ms?: number;
  runningSeconds?: number;
  progressLabel?: string;
  error?: string;
  sourceRunId?: string;
  // Cho iteration node `lap-phuong-an`
  iterationTotal?: number;
  iterationDone?: number;
}

interface RegionProgress {
  caseId: string;
  title: string;
  sentenceNs: number[];
  status: "chua-chay" | "dang-chay" | "xong" | "loi";
  runningSeconds?: number;
  optionsCount?: number;
  retryAttempt?: number;
  retryReason?: string;
  error?: string;
}

export default function PipelineFlow({
  runId,
  runMeta,
  isAnalyzing,
  onFinished,
  onRetry,
  onPartialCases,
  onCaseOptionsReady,
}: PipelineFlowProps) {
  const [nodes, setNodes] = useState<PipelineNodeDef[]>(() =>
    getUserVisibleNodes(),
  );
  const callbacksRef = useRef({
    onFinished,
    onPartialCases,
    onCaseOptionsReady,
  });
  callbacksRef.current = { onFinished, onPartialCases, onCaseOptionsReady };
  const lastSeqRef = useRef(0);
  // true khi thấy run đang chạy lúc mở: xong thì giữ sơ đồ mở để người dùng xem các bước.
  const sawLiveRef = useRef(false);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);
  const [runError, setRunError] = useState<{
    code: string;
    message: string;
  } | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showRegionsList, setShowRegionsList] = useState(false);
  const [partialCases, setPartialCases] = useState<DecisionCase[]>([]);
  const [regionProgressMap, setRegionProgressMap] = useState<
    Map<string, RegionProgress>
  >(new Map());

  // 1. Tải định nghĩa đồ thị từ GET /pipeline (fallback là getUserVisibleNodes())
  useEffect(() => {
    let active = true;
    revisionClient
      .getPipelineGraph()
      .then((data) => {
        if (active && Array.isArray(data?.graph)) {
          const visible = (data.graph as PipelineNodeDef[]).filter(
            (n) => n.userVisible,
          );
          if (visible.length > 0) {
            setNodes(visible);
          }
        }
      })
      .catch(() => {
        // Giữ fallback getUserVisibleNodes()
      });
    return () => {
      active = false;
    };
  }, []);

  // 2. Tự động đồng bộ trạng thái khi có runMeta từ server
  useEffect(() => {
    if (runMeta?.runId && runMeta.runId !== runId) return; // runMeta của run cũ
    if (runMeta?.status === "dang-chay") {
      sawLiveRef.current = true;
    } else if (runMeta?.status === "xong") {
      setIsCompleted(true);
      if (!sawLiveRef.current) {
        // Mở lại một run đã xong từ trước: thu gọn, lấy thời lượng từ server.
        setIsExpanded(false);
        if (runMeta.durationMs) {
          setElapsedSeconds(Math.round(runMeta.durationMs / 1000));
        }
      }
    } else if (runMeta?.status === "loi") {
      setRunError({
        code: "RUN_FAILED",
        message: "Đợt phân tích thất bại hoặc đã bị dừng",
      });
    }
  }, [runMeta?.status, runMeta?.runId, runMeta?.durationMs, runId]);

  // 3. Đếm thời gian trôi qua khi đang chạy
  useEffect(() => {
    if (isCompleted || runError || (!runId && !isAnalyzing)) return;
    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isCompleted, runError, runId, isAnalyzing]);

  // 4. Kết nối SSE để nhận sự kiện trực tiếp theo node.
  // Mỗi run một vòng đời: đổi run thì xoá toàn bộ trạng thái của run trước.
  useEffect(() => {
    setEvents([]);
    setRunError(null);
    setIsCompleted(false);
    setIsExpanded(true);
    setElapsedSeconds(0);
    setPartialCases([]);
    setRegionProgressMap(new Map());
    lastSeqRef.current = 0;
    sawLiveRef.current = false;
    if (!runId) return;

    let active = true;
    let finished = false;
    let retries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let eventSource: EventSource | null = null;

    const connectSSE = () => {
      eventSource = new EventSource(
        revisionClient.getRunEventsUrl(runId, lastSeqRef.current),
      );
      eventSource.onopen = () => {
        retries = 0;
      };

      const handleEvent = (ev: MessageEvent) => {
        if (!active) return;
        try {
          const runEvent = JSON.parse(ev.data) as RunEvent;
          if (runEvent.seq <= lastSeqRef.current) return;
          lastSeqRef.current = runEvent.seq;
          if (runEvent.type === "run.started") sawLiveRef.current = true;
          setEvents((prev) => [...prev, runEvent]);

          // Xử lý các sự kiện nghiệp vụ
          if (runEvent.type === "partial") {
            if (runEvent.kind === "cases.ready") {
              const cases = (runEvent.payload as DecisionCase[]) || [];
              setPartialCases(cases);
              callbacksRef.current.onPartialCases?.(cases);

              setRegionProgressMap((prev) => {
                const next = new Map(prev);
                for (const c of cases) {
                  if (!next.has(c.id)) {
                    next.set(c.id, {
                      caseId: c.id,
                      title: c.title,
                      sentenceNs: c.sentenceNs,
                      status: "chua-chay",
                      optionsCount: c.options?.length ?? 0,
                    });
                  }
                }
                return next;
              });
            } else if (runEvent.kind === "case.options.ready") {
              const payload = runEvent.payload as {
                caseId: string;
                options: RevisionOption[];
                standaloneWork: boolean;
              };
              if (payload?.caseId) {
                setRegionProgressMap((prev) => {
                  const next = new Map(prev);
                  const curr = next.get(payload.caseId);
                  if (curr) {
                    next.set(payload.caseId, {
                      ...curr,
                      status: "xong",
                      optionsCount: payload.options.length,
                    });
                  }
                  return next;
                });
                callbacksRef.current.onCaseOptionsReady?.(payload);
              }
            }
          } else if (runEvent.type === "node.retry") {
            if (runEvent.iterationKey) {
              setRegionProgressMap((prev) => {
                const next = new Map(prev);
                const curr = next.get(runEvent.iterationKey!);
                if (curr) {
                  next.set(runEvent.iterationKey!, {
                    ...curr,
                    retryAttempt: runEvent.attempt,
                    retryReason: runEvent.reason,
                    status: "dang-chay",
                  });
                }
                return next;
              });
            }
          } else if (runEvent.type === "node.started") {
            if (runEvent.iterationKey) {
              setRegionProgressMap((prev) => {
                const next = new Map(prev);
                const curr = next.get(runEvent.iterationKey!);
                if (curr) {
                  next.set(runEvent.iterationKey!, {
                    ...curr,
                    status: "dang-chay",
                  });
                }
                return next;
              });
            }
          } else if (runEvent.type === "run.finished") {
            finished = true;
            setIsCompleted(true);
            // Chạy trực tiếp thì giữ sơ đồ mở; người dùng tự thu gọn.
            if (!sawLiveRef.current) setIsExpanded(false);
            if (typeof runEvent.ms === "number") {
              setElapsedSeconds(Math.max(1, Math.round(runEvent.ms / 1000)));
            }
            callbacksRef.current.onFinished?.();
          } else if (runEvent.type === "run.failed") {
            finished = true;
            setRunError({
              code: runEvent.errorCode,
              message: runEvent.message,
            });
            callbacksRef.current.onFinished?.();
          }
        } catch {
          // Bỏ qua nếu parse JSON lỗi
        }
      };

      eventSource.onmessage = handleEvent;

      eventSource.onerror = () => {
        eventSource?.close();
        // Service đóng luồng khi run xong; còn đang chạy thì nối lại từ seq cuối.
        if (!active || finished || retries >= 5) return;
        retries++;
        retryTimer = setTimeout(connectSSE, 1000 * retries);
      };
    };

    connectSSE();

    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      eventSource?.close();
    };
  }, [runId]);

  // 5. Tính trạng thái từng node từ đồ thị + chuỗi sự kiện
  const nodeStates = useMemo<NodeState[]>(() => {
    const states = new Map<string, NodeState>();

    for (const def of nodes) {
      states.set(def.id, {
        id: def.id,
        label: def.label,
        kind: def.kind,
        status: "chua-chay",
      });
    }

    // Nếu chưa có runId hoặc chưa bắt đầu, toàn bộ node là "chua-chay"
    if (!runId && !isAnalyzing) {
      return Array.from(states.values());
    }

    let lapPhuongAnTotal = partialCases.length;
    let lapPhuongAnDone = 0;
    let deXuatReused = 0;

    for (const ev of events) {
      if (ev.type === "node.started") {
        const targetId =
          ev.nodeId === "lam-sach"
            ? "nhan-dau-vao"
            : ev.nodeId === "kiem-tra-hieu"
              ? "hieu-gop-y"
              : ev.nodeId === "de-xuat" ||
                  ev.nodeId === "kiem-tra-de-xuat" ||
                  ev.nodeId === "tinh-pham-vi"
                ? "lap-phuong-an"
                : ev.nodeId;

        const curr = states.get(targetId);
        if (curr && curr.status !== "xong" && curr.status !== "loi") {
          curr.status = "dang-chay";
        }
      } else if (ev.type === "node.progress") {
        const targetId =
          ev.nodeId === "de-xuat" ||
          ev.nodeId === "kiem-tra-de-xuat" ||
          ev.nodeId === "tinh-pham-vi"
            ? "lap-phuong-an"
            : ev.nodeId;

        const curr = states.get(targetId);
        if (curr) {
          curr.runningSeconds = ev.done;
          curr.progressLabel = ev.label;
        }
      } else if (ev.type === "node.finished") {
        if (
          ev.nodeId === "de-xuat" ||
          ev.nodeId === "kiem-tra-de-xuat" ||
          ev.nodeId === "tinh-pham-vi"
        ) {
          if (ev.nodeId === "tinh-pham-vi" && ev.status === "xong") {
            lapPhuongAnDone++;
          }
          const curr = states.get("lap-phuong-an");
          if (curr) {
            curr.iterationDone = lapPhuongAnDone;
            curr.iterationTotal = lapPhuongAnTotal;
            if (lapPhuongAnTotal > 0 && lapPhuongAnDone >= lapPhuongAnTotal) {
              curr.status = "xong";
            }
          }
        } else {
          const curr = states.get(ev.nodeId);
          if (curr) {
            // Node đã dùng lại kết quả cũ thì giữ trạng thái đó, không ghi đè thành "xong".
            const reused = curr.status === "dung-lai-ket-qua-truoc";
            curr.status =
              ev.status === "loi" ? "loi" : reused ? curr.status : "xong";
            curr.summary =
              reused && ev.status !== "loi" ? curr.summary : ev.summary;
            curr.ms = ev.ms;
          }
        }
      } else if (ev.type === "node.skipped") {
        const curr = states.get(ev.nodeId);
        if (curr) {
          curr.status = "bo-qua";
          curr.summary = ev.reason || "Bỏ qua";
        }
      } else if (ev.type === "node.cache_hit") {
        if (ev.nodeId === "de-xuat") {
          // Vòng lặp theo vùng: đếm số vùng dùng lại đề xuất cũ để hiện trên node lặp.
          deXuatReused++;
          const lap = states.get("lap-phuong-an");
          if (lap) {
            lap.summary = `${deXuatReused} vùng dùng lại đề xuất từ ${ev.sourceRunId}`;
          }
        } else {
          const curr = states.get(ev.nodeId);
          if (curr) {
            curr.status = "dung-lai-ket-qua-truoc";
            curr.sourceRunId = ev.sourceRunId;
            curr.summary = `Dùng lại từ ${ev.sourceRunId}`;
          }
        }
      } else if (ev.type === "partial" && ev.kind === "cases.ready") {
        const cases = (ev.payload as DecisionCase[]) || [];
        lapPhuongAnTotal = cases.length;
        const lapNode = states.get("lap-phuong-an");
        if (lapNode) {
          lapNode.iterationTotal = cases.length;
          lapNode.iterationDone = lapPhuongAnDone;
        }
      } else if (ev.type === "partial" && ev.kind === "case.options.ready") {
        lapPhuongAnDone++;
        const lapNode = states.get("lap-phuong-an");
        if (lapNode) {
          lapNode.iterationDone = Math.min(lapPhuongAnDone, lapPhuongAnTotal);
          if (lapPhuongAnTotal > 0 && lapPhuongAnDone >= lapPhuongAnTotal) {
            lapNode.status = "xong";
          }
        }
      }
    }

    // Nếu run.finished, cho-duyet sẵn sàng cho người dùng duyệt
    if (isCompleted) {
      const choDuyetNode = states.get("cho-duyet");
      if (choDuyetNode) {
        choDuyetNode.status = "xong";
        choDuyetNode.summary = "Sẵn sàng duyệt";
      }
      const lapNode = states.get("lap-phuong-an");
      if (lapNode && lapNode.status !== "loi") {
        lapNode.status = "xong";
        lapNode.iterationDone = lapPhuongAnTotal;
        lapNode.iterationTotal = lapPhuongAnTotal;
      }
    }

    return Array.from(states.values());
  }, [nodes, events, runId, isAnalyzing, isCompleted, partialCases]);

  // 6. Xử lý nút Hủy
  const handleCancel = async () => {
    if (!runId) return;
    if (!window.confirm("Bạn có chắc chắn muốn dừng đợt phân tích này?"))
      return;
    setIsCancelling(true);
    try {
      await revisionClient.cancelRun(runId);
      setRunError({
        code: "RUN_CANCELLED",
        message: "Đợt phân tích đã dừng theo yêu cầu của bạn",
      });
    } catch {
      // ignore
    } finally {
      setIsCancelling(false);
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Helper render biểu tượng + màu sắc cho 6 trạng thái chuẩn
  const renderStatusBadge = (status: NodeStatus, runningSec?: number) => {
    switch (status) {
      case "chua-chay":
        return (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
            <Circle className="size-3 text-muted-foreground/40 shrink-0" />
            <span>Chưa chạy</span>
          </div>
        );
      case "dang-chay":
        return (
          <div className="flex items-center gap-1 text-[11px] text-primary font-semibold">
            <Loader2 className="size-3 animate-spin shrink-0" />
            <span>Đang chạy ({runningSec ?? elapsedSeconds}s)</span>
          </div>
        );
      case "xong":
        return (
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
            <CheckCircle2 className="size-3 shrink-0" />
            <span>Xong</span>
          </div>
        );
      case "loi":
        return (
          <div className="flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
            <XCircle className="size-3 shrink-0" />
            <span>Lỗi</span>
          </div>
        );
      case "bo-qua":
        return (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
            <MinusCircle className="size-3 shrink-0" />
            <span>Bỏ qua</span>
          </div>
        );
      case "dung-lai-ket-qua-truoc":
        return (
          <div className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
            <RefreshCw className="size-3 shrink-0" />
            <span>Dùng lại kết quả trước</span>
          </div>
        );
    }
  };

  // 7. TRẠNG THÁI THU GỌN KHI PHÂN TÍCH XONG (AR-01 & Spec 5.1)
  if (isCompleted && !isExpanded) {
    const totalCasesCount =
      partialCases.length || runMeta?.caseCount || regionProgressMap.size || 0;

    return (
      <div className="rounded-xl border bg-card/80 p-3 shadow-2xs flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="size-6 rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="size-4" />
          </div>
          <span className="font-semibold text-foreground">
            Phân tích xong trong {formatTimer(elapsedSeconds)} ·{" "}
            {totalCasesCount} vùng · kiểm tra bằng code: Đạt
          </span>
          {runId && (
            <Badge variant="outline" className="font-mono text-[10px]">
              {runId}
            </Badge>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(true)}
          className="h-7 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <span>Xem chi tiết sơ đồ</span>
          <ChevronDown className="size-3.5" />
        </Button>
      </div>
    );
  }

  // 8. BẢNG TIẾN TRÌNH SƠ ĐỒ ĐẦY ĐỦ (Dify style, 5 node cố định)
  return (
    <div className="rounded-2xl border-2 border-primary/20 bg-card/70 backdrop-blur-xs shadow-xs p-4 space-y-4">
      {/* HEADER BẢNG SƠ ĐỒ */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-2.5">
          {runError ? (
            <div className="size-7 rounded-lg bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600">
              <AlertCircle className="size-4.5 shrink-0" />
            </div>
          ) : isCompleted ? (
            <div className="size-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="size-4.5 shrink-0" />
            </div>
          ) : runId || isAnalyzing ? (
            <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Loader2 className="size-4.5 animate-spin shrink-0" />
            </div>
          ) : (
            <div className="size-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
              <Layers className="size-4.5 shrink-0" />
            </div>
          )}

          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground">
                {runError
                  ? "Đợt phân tích gặp lỗi hoặc đã dừng"
                  : isCompleted
                    ? "Đợt phân tích hoàn tất thành công"
                    : runId || isAnalyzing
                      ? "Đang phân tích theo đồ thị (Pipeline)"
                      : "Sơ đồ luồng phân tích (5 bước cố định)"}
              </span>
              {runId && (
                <Badge variant="outline" className="font-mono text-[10px]">
                  {runId}
                </Badge>
              )}
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

        {/* NÚT THAO TÁC HEADER */}
        <div className="flex items-center gap-2">
          {isCompleted && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(false)}
              className="h-7 px-2.5 text-xs gap-1 text-muted-foreground hover:text-foreground"
            >
              <ChevronUp className="size-3.5" /> Thu gọn
            </Button>
          )}

          {(runId || isAnalyzing) && !isCompleted && !runError && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isCancelling}
              onClick={handleCancel}
              className="h-7 px-2.5 text-xs gap-1 border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              <StopCircle className="size-3.5" />
              <span>{isCancelling ? "Đang dừng…" : "Dừng"}</span>
            </Button>
          )}

          {runError && onRetry && (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onRetry}
              className="h-7 px-2.5 text-xs gap-1.5"
            >
              <RefreshCw className="size-3.5" /> Thử lại
            </Button>
          )}
        </div>
      </div>

      {/* SƠ ĐỒ 5 NODE CỐ ĐỊNH (RESPONSIVE: HÀNG NGANG TRÊN SM, DỌC DƯỚI 640PX) */}
      <div className="flex flex-col sm:flex-row items-stretch gap-2 sm:gap-1.5">
        {nodeStates.map((node, idx) => {
          const isIteration = node.id === "lap-phuong-an";
          const isLast = idx === nodeStates.length - 1;

          // Tiêu đề phụ cho node iteration
          const iterationSubtitle = isIteration
            ? node.iterationTotal
              ? `${node.iterationDone || 0}/${node.iterationTotal} vùng`
              : "0 vùng"
            : undefined;

          return (
            <div
              key={node.id}
              className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 min-w-0"
            >
              {/* Thẻ Node */}
              <div
                onClick={() => {
                  if (isIteration && (node.iterationTotal || 0) > 0) {
                    setShowRegionsList((v) => !v);
                  }
                }}
                className={`flex-1 rounded-xl p-3 border transition-all flex flex-col justify-between gap-2 select-none ${
                  isIteration ? "cursor-pointer hover:border-primary/60" : ""
                } ${
                  node.status === "dang-chay"
                    ? "bg-primary/5 border-primary ring-1 ring-primary/20 shadow-2xs"
                    : node.status === "xong"
                      ? "bg-muted/30 border-border/80"
                      : node.status === "loi"
                        ? "bg-rose-50/20 border-rose-300"
                        : node.status === "dung-lai-ket-qua-truoc"
                          ? "bg-blue-50/20 border-blue-300"
                          : "bg-muted/10 border-dashed border-border/60 text-muted-foreground"
                }`}
              >
                {/* Dòng trên: Nhãn node + Icon kind */}
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                      {idx + 1}.
                    </span>
                    <span className="font-semibold text-xs text-foreground truncate">
                      {node.label}
                    </span>
                  </div>

                  {isIteration && (
                    <Badge
                      variant="secondary"
                      className="text-[9px] font-mono px-1 py-0 h-4 shrink-0"
                    >
                      {iterationSubtitle}
                    </Badge>
                  )}
                </div>

                {/* Dòng dưới: Trạng thái Text + Icon */}
                <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/40">
                  {renderStatusBadge(node.status, node.runningSeconds)}

                  {node.ms != null && (
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                      {(node.ms / 1000).toFixed(1)}s
                    </span>
                  )}
                  {isIteration && (node.iterationTotal || 0) > 0 && (
                    <ChevronDown
                      className={`size-3 text-muted-foreground transition-transform shrink-0 ${
                        showRegionsList ? "rotate-180" : ""
                      }`}
                    />
                  )}
                </div>
              </div>

              {/* Mũi tên kết nối giữa các node (ẩn ở node cuối và ẩn trên màn hình di động) */}
              {!isLast && (
                <div className="hidden sm:flex items-center justify-center px-0.5 shrink-0 text-muted-foreground/30">
                  <ArrowRight className="size-3.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* DANH SÁCH CHI TIẾT TỪNG VÙNG CHO NODE `lap-phuong-an` (MỞ RA KHI BẤM VÀO NODE) */}
      {showRegionsList && regionProgressMap.size > 0 && (
        <div className="pt-2 border-t space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs flex items-center gap-1.5 text-foreground">
              <Wrench className="size-3.5 text-primary" />
              <span>Tiến trình từng vùng ({regionProgressMap.size} vùng)</span>
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              Lặp song song tối đa 3 vùng · kiểm tra patch bằng code
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {Array.from(regionProgressMap.values()).map((r) => (
              <div
                key={r.caseId}
                className="rounded-lg border p-2 bg-card text-xs space-y-1 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-1 text-[10px]">
                  <Badge
                    variant="outline"
                    className="font-mono text-[9px] border-primary/40 text-primary"
                  >
                    {r.caseId}
                  </Badge>
                  <span className="text-muted-foreground font-mono">
                    Câu {r.sentenceNs.join(", ")}
                  </span>
                </div>

                <p className="font-medium text-foreground text-[11px] truncate">
                  {r.title}
                </p>

                <div className="flex items-center justify-between gap-1 text-[10px]">
                  <span className="text-muted-foreground">
                    {r.optionsCount != null && r.optionsCount > 0
                      ? `✓ ${r.optionsCount} phương án`
                      : r.status === "dang-chay"
                        ? "◐ đang lập phương án…"
                        : "○ chờ xử lý"}
                  </span>

                  {r.retryAttempt != null && r.retryAttempt > 1 && (
                    <Badge
                      variant="destructive"
                      className="text-[9px] font-mono px-1 py-0 h-4"
                    >
                      lần {r.retryAttempt}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* THÔNG BÁO LỖI NẾU CÓ */}
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
    </div>
  );
}

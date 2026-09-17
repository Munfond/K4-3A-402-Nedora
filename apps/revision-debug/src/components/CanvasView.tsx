import React, { useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Sparkles,
  Layers,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Zap,
} from "lucide-react";
import type { NodeDebugEntry } from "../lib/debug-api";

interface CanvasViewProps {
  runId: string;
  runStatus: string;
  nodes: NodeDebugEntry[];
  events: any[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string, iterationKey?: string) => void;
  onReplayNode: (nodeId: string, iterationKey?: string) => void;
  isReplaying?: boolean;
}

const BASE_NODES = [
  { id: "nhan-dau-vao", label: "Chuẩn bị dữ liệu", kind: "code" },
  { id: "lam-sach", label: "Làm sạch & an toàn", kind: "code" },
  { id: "hieu-gop-y", label: "Hiểu góp ý", kind: "ai" },
  { id: "kiem-tra-hieu", label: "Kiểm tra hiểu", kind: "code" },
  { id: "lap-ho-so", label: "Lập hồ sơ vùng", kind: "code" },
];

export const CanvasView: React.FC<CanvasViewProps> = ({
  runId,
  runStatus,
  nodes,
  events,
  selectedNodeId,
  onSelectNode,
  onReplayNode,
  isReplaying,
}) => {
  const [expandedRegions, setExpandedRegions] = useState<
    Record<string, boolean>
  >({});

  // Group debug nodes by id and iterationKey
  const nodeMap = new Map<string, NodeDebugEntry>();
  for (const n of nodes) {
    nodeMap.set(n.nodeId, n);
  }

  // Find active / live states from events
  const liveStatusMap = new Map<
    string,
    { status: string; ms?: number; attempt?: number; error?: string }
  >();
  for (const ev of events) {
    if (ev.type === "node.started") {
      const key = ev.iterationKey
        ? `${ev.nodeId}:${ev.iterationKey}`
        : ev.nodeId;
      liveStatusMap.set(key, { status: "dang-chay", attempt: ev.attempt });
    } else if (ev.type === "node.finished") {
      const key = ev.iterationKey
        ? `${ev.nodeId}:${ev.iterationKey}`
        : ev.nodeId;
      liveStatusMap.set(key, {
        status: "xong",
        ms: ev.ms,
        attempt: ev.attempt,
      });
    } else if (ev.type === "node.retry") {
      const key = ev.iterationKey
        ? `kiem-tra-de-xuat:${ev.iterationKey}`
        : ev.nodeId;
      liveStatusMap.set(key, {
        status: "retry",
        attempt: ev.attempt,
        error: ev.reason,
      });
    }
  }

  // Extract region keys from nodes or events
  const regionKeys = Array.from(
    new Set([
      ...nodes
        .filter(
          (n) => n.nodeId.startsWith("de-xuat:") || n.nodeId.startsWith("rg-"),
        )
        .map((n) => {
          const parts = n.nodeId.split(":");
          return parts[1] || n.nodeId;
        }),
      ...events.filter((e) => e.iterationKey).map((e) => e.iterationKey),
    ]),
  ).sort();

  const getNodeStatus = (nodeId: string, iterationKey?: string) => {
    const key = iterationKey ? `${nodeId}:${iterationKey}` : nodeId;
    const live = liveStatusMap.get(key);
    if (live?.status) return live.status;

    // Check debug nodes
    const entry =
      nodeMap.get(nodeId) ||
      (iterationKey
        ? nodeMap.get(`${nodeId}:${iterationKey}:att1`)
        : undefined);
    if (entry) return entry.status;

    if (runStatus === "xong") return "xong";
    return "chua-chay";
  };

  const toggleRegion = (reg: string) => {
    setExpandedRegions((prev) => ({ ...prev, [reg]: !prev[reg] }));
  };

  const formatTokens = (tokens?: { input: number; output: number }) => {
    if (!tokens) return "";
    const total = tokens.input + tokens.output;
    return total > 0 ? `${(total / 1000).toFixed(1)}k tk` : "";
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-900/50 rounded-2xl border border-slate-800 backdrop-blur-sm overflow-x-auto">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
            Graph: revision@2
          </span>
          <span className="text-xs text-slate-400">
            Run: <code className="text-slate-200">{runId}</code>
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              runStatus === "xong"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                : runStatus === "dang-chay"
                  ? "bg-sky-500/10 text-sky-400 border border-sky-500/30 animate-pulse"
                  : "bg-slate-800 text-slate-400"
            }`}
          >
            {runStatus === "xong"
              ? "✓ Đã hoàn tất"
              : runStatus === "dang-chay"
                ? "● Đang chạy..."
                : runStatus}
          </span>
        </div>
      </div>

      {/* HORIZONTAL CANVAS OF NODES */}
      <div className="flex items-start gap-3 min-w-max py-2">
        {BASE_NODES.map((bNode, idx) => {
          const st = getNodeStatus(bNode.id);
          const debugData = nodeMap.get(bNode.id);
          const isSelected = selectedNodeId === bNode.id;

          return (
            <React.Fragment key={bNode.id}>
              <div
                onClick={() => onSelectNode(bNode.id)}
                className={`relative flex flex-col p-3 rounded-xl border transition-all cursor-pointer select-none min-w-[150px] ${
                  isSelected
                    ? "bg-sky-950/40 border-sky-500 shadow-md shadow-sky-950/50 ring-1 ring-sky-500/40"
                    : st === "xong"
                      ? "bg-slate-800/80 border-emerald-500/40 hover:border-emerald-500/80"
                      : st === "dang-chay"
                        ? "bg-sky-950/30 border-sky-500/60 ring-1 ring-sky-500/30 animate-pulse"
                        : "bg-slate-800/40 border-slate-700/60 opacity-60 hover:opacity-100"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    {bNode.kind}
                  </span>
                  {st === "xong" ? (
                    <CheckCircle2 className="size-3.5 text-emerald-400" />
                  ) : st === "dang-chay" ? (
                    <RefreshCw className="size-3.5 text-sky-400 animate-spin" />
                  ) : (
                    <Clock className="size-3.5 text-slate-500" />
                  )}
                </div>

                <div className="font-semibold text-xs text-slate-200 truncate">
                  {bNode.label}
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>{debugData?.ms ? `${debugData.ms}ms` : ""}</span>
                  <span>{formatTokens(debugData?.tokens)}</span>
                </div>
              </div>

              {/* Arrow connection */}
              <div className="flex items-center self-center text-slate-600">
                <ChevronRight className="size-4" />
              </div>
            </React.Fragment>
          );
        })}

        {/* ITERATION CONTAINER: ĐỀ XUẤT CÁCH SỬA (LAP-PHUONG-AN) */}
        <div
          className={`relative flex flex-col p-3.5 rounded-2xl border transition-all min-w-[340px] max-w-lg ${
            selectedNodeId === "lap-phuong-an"
              ? "bg-slate-800/90 border-sky-500 shadow-lg"
              : "bg-slate-800/40 border-slate-700 hover:border-slate-600"
          }`}
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-700/60 mb-3">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-sky-400" />
              <span className="font-bold text-xs text-slate-200">
                Đề xuất cách sửa (lặp {regionKeys.length} vùng)
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-700/60 text-slate-300">
              Song song 3
            </span>
          </div>

          {/* Region rows inside iteration container */}
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {regionKeys.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-4 italic">
                Chưa có vùng nào được lập hồ sơ...
              </div>
            ) : (
              regionKeys.map((reg) => {
                const isExpanded = expandedRegions[reg] ?? true;
                const regDeXuatStatus = getNodeStatus("de-xuat", reg);
                const isRegSelected = selectedNodeId === `de-xuat:${reg}`;

                return (
                  <div
                    key={reg}
                    className={`rounded-lg border p-2.5 transition-all ${
                      isRegSelected
                        ? "bg-slate-700/60 border-sky-500/80"
                        : "bg-slate-900/40 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => toggleRegion(reg)}
                        className="flex items-center gap-1.5 text-xs font-mono font-medium text-slate-300 hover:text-white text-left"
                      >
                        {isExpanded ? (
                          <ChevronDown className="size-3 text-slate-400" />
                        ) : (
                          <ChevronRight className="size-3 text-slate-400" />
                        )}
                        <span>{reg}</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onReplayNode("de-xuat", reg)}
                          disabled={isReplaying}
                          title="Chạy lại riêng vùng này (tạo run con)"
                          className="px-1.5 py-0.5 text-[10px] bg-slate-800 hover:bg-sky-900/50 hover:text-sky-300 text-slate-400 rounded border border-slate-700 transition flex items-center gap-1"
                        >
                          <RotateCcw className="size-2.5" />
                          Replay
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectNode("de-xuat", reg)}
                          className="px-1.5 py-0.5 text-[10px] bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded border border-sky-500/30 transition"
                        >
                          Soi
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-2 pl-2 border-l border-slate-700/60 flex items-center gap-2 text-[11px]">
                        <span className="flex items-center gap-1 text-slate-300 font-mono">
                          {regDeXuatStatus === "xong" ? (
                            <CheckCircle2 className="size-3 text-emerald-400" />
                          ) : regDeXuatStatus === "dang-chay" ? (
                            <RefreshCw className="size-3 text-sky-400 animate-spin" />
                          ) : (
                            <Clock className="size-3 text-slate-500" />
                          )}
                          de-xuat
                        </span>

                        <span className="text-slate-600">→</span>

                        <span className="flex items-center gap-1 text-slate-300 font-mono">
                          <CheckCircle2 className="size-3 text-emerald-400" />
                          kiem-tra
                        </span>

                        <span className="text-slate-600">→</span>

                        <span className="flex items-center gap-1 text-slate-300 font-mono">
                          <CheckCircle2 className="size-3 text-emerald-400" />
                          pham-vi
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Final arrow */}
        <div className="flex items-center self-center text-slate-600">
          <ChevronRight className="size-4" />
        </div>

        {/* HUMAN REVIEW NODE: CHỜ BẠN DUYỆT */}
        <div
          onClick={() => onSelectNode("cho-duyet")}
          className={`relative flex flex-col p-3 rounded-xl border transition-all cursor-pointer select-none min-w-[150px] ${
            selectedNodeId === "cho-duyet"
              ? "bg-sky-950/40 border-sky-500 shadow-md shadow-sky-950/50"
              : runStatus === "xong"
                ? "bg-slate-800/80 border-amber-500/40 hover:border-amber-500/80"
                : "bg-slate-800/40 border-slate-700/60 opacity-60"
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              human
            </span>
            <CheckCircle2 className="size-3.5 text-amber-400" />
          </div>

          <div className="font-semibold text-xs text-slate-200">
            Chờ bạn duyệt
          </div>

          <div className="mt-2 text-[11px] text-slate-400 font-mono">
            Studio UI
          </div>
        </div>
      </div>
    </div>
  );
};

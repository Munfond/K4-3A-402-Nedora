import React, { useState } from "react";
import {
  X,
  RotateCcw,
  Copy,
  Check,
  Code2,
  FileText,
  Clock,
  Zap,
  Shield,
  Layers,
  Sparkles,
} from "lucide-react";
import type { NodeDebugEntry } from "../lib/debug-api";

interface NodeInspectorProps {
  node: NodeDebugEntry | null;
  nodeId: string | null;
  iterationKey?: string;
  onClose: () => void;
  onReplay: (nodeId: string, iterationKey?: string) => void;
  isReplaying?: boolean;
}

export const NodeInspector: React.FC<NodeInspectorProps> = ({
  node,
  nodeId,
  iterationKey,
  onClose,
  onReplay,
  isReplaying,
}) => {
  const [activeTab, setActiveTab] = useState<"output" | "input" | "meta">(
    "output",
  );
  const [copied, setCopied] = useState(false);

  if (!nodeId) return null;

  const title = iterationKey ? `${nodeId} · ${iterationKey}` : nodeId;

  const handleCopyJson = () => {
    const data =
      activeTab === "output"
        ? node?.output
        : activeTab === "input"
          ? node?.input
          : node;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
        <div className="flex items-center gap-2.5">
          <Code2 className="size-4 text-sky-400" />
          <h3 className="font-bold text-sm text-slate-100 font-mono">
            {title}
          </h3>
          {node?.status && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                node.status === "xong"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                  : node.status === "loi"
                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                    : "bg-slate-800 text-slate-400"
              }`}
            >
              {node.status}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {nodeId.includes("de-xuat") && (
            <button
              type="button"
              onClick={() => onReplay(nodeId, iterationKey)}
              disabled={isReplaying}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium transition disabled:opacity-50"
            >
              <RotateCcw className="size-3" />
              {isReplaying ? "Đang tạo run con..." : "Chạy lại node này"}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-4 gap-2 px-5 py-2.5 bg-slate-950/30 border-b border-slate-800/80 text-xs">
        <div>
          <span className="text-slate-500 text-[11px] block">Thời gian</span>
          <span className="font-mono text-slate-200 font-medium">
            {node?.ms ? `${node.ms} ms` : "—"}
          </span>
        </div>
        <div>
          <span className="text-slate-500 text-[11px] block">Tokens</span>
          <span className="font-mono text-slate-200 font-medium">
            {node?.tokens
              ? `${node.tokens.input} vào / ${node.tokens.output} ra`
              : "—"}
          </span>
        </div>
        <div>
          <span className="text-slate-500 text-[11px] block">Model</span>
          <span
            className="font-mono text-slate-200 font-medium truncate block"
            title={node?.modelId}
          >
            {node?.modelId || "code"}
          </span>
        </div>
        <div>
          <span className="text-slate-500 text-[11px] block">Lần thử</span>
          <span className="font-mono text-slate-200 font-medium">
            {node?.attempts || 1}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between px-5 pt-3 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("output")}
            className={`px-3 py-1 rounded font-medium transition ${
              activeTab === "output"
                ? "bg-slate-800 text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Output (Có cấu trúc)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("input")}
            className={`px-3 py-1 rounded font-medium transition ${
              activeTab === "input"
                ? "bg-slate-800 text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Input (Đã redact)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("meta")}
            className={`px-3 py-1 rounded font-medium transition ${
              activeTab === "meta"
                ? "bg-slate-800 text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Prompt & Trace
          </button>
        </div>

        <button
          type="button"
          onClick={handleCopyJson}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
        >
          {copied ? (
            <Check className="size-3 text-emerald-400" />
          ) : (
            <Copy className="size-3" />
          )}
          <span>{copied ? "Đã chép" : "Sao chép JSON"}</span>
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 p-5 overflow-y-auto font-mono text-xs">
        {activeTab === "output" && (
          <div>
            {node?.error && (
              <div className="mb-4 p-3 rounded-lg border border-rose-500/30 bg-rose-950/20 text-rose-300">
                <span className="font-bold block mb-1">Lỗi:</span>
                <p className="text-slate-300 font-sans">{node.error}</p>
              </div>
            )}
            <pre className="text-slate-300 bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto leading-relaxed">
              {node?.output
                ? JSON.stringify(node.output, null, 2)
                : "Chưa có output"}
            </pre>
          </div>
        )}

        {activeTab === "input" && (
          <pre className="text-slate-300 bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto leading-relaxed">
            {node?.input
              ? JSON.stringify(node.input, null, 2)
              : "Chưa có input"}
          </pre>
        )}

        {activeTab === "meta" && (
          <div className="space-y-4 font-sans text-xs">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <span className="font-bold text-slate-300 block">
                Prompt Metadata
              </span>
              <div className="grid grid-cols-2 gap-2 text-slate-400">
                <div>
                  <span className="block text-slate-500">Prompt Version:</span>
                  <code className="text-sky-400">
                    {node?.promptVersion || "N/A"}
                  </code>
                </div>
                <div>
                  <span className="block text-slate-500">Prompt Hash:</span>
                  <code className="text-slate-300 truncate block">
                    {node?.promptHash || "N/A"}
                  </code>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <span className="font-bold text-slate-300 block">
                Chính sách bảo vệ
              </span>
              <p className="text-slate-400">
                Theo tiêu chuẩn AR-07 & §4.3: Không hiển thị prompt thô, chuỗi
                suy luận nội bộ, hoặc secret token. Dữ liệu hiển thị là đầu ra
                có cấu trúc đã qua kiểm tra.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

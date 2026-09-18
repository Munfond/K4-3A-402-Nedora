import React, { useEffect, useState } from "react";
import {
  Activity,
  Award,
  Layers,
  Search,
  Filter,
  RefreshCw,
  Key,
  RotateCcw,
  Sparkles,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import {
  debugApi,
  getDebugToken,
  setDebugToken,
  type DebugRunMeta,
  type NodeDebugEntry,
} from "./lib/debug-api";
import { CanvasView } from "./components/CanvasView";
import { NodeInspector } from "./components/NodeInspector";
import { ComparisonView } from "./components/ComparisonView";
import { GoldenSetView } from "./components/GoldenSetView";

export function App() {
  const [runs, setRuns] = useState<DebugRunMeta[]>([]);
  const [activeRunId, setActiveRunId] = useState<string>("");
  const [runNodes, setRunNodes] = useState<NodeDebugEntry[]>([]);
  const [runEvents, setRunEvents] = useState<any[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    "hieu-gop-y",
  );
  const [selectedIterationKey, setSelectedIterationKey] = useState<
    string | undefined
  >(undefined);
  const [selectedNodeData, setSelectedNodeData] =
    useState<NodeDebugEntry | null>(null);

  // Tabs & Views
  const [activeTab, setActiveTab] = useState<"canvas" | "goldenset">("canvas");
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonData, setComparisonData] = useState<any | null>(null);
  const [compareRunBId, setCompareRunBId] = useState<string>("");

  // Filters & State
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState(getDebugToken());

  // Load runs
  const loadRuns = async () => {
    setIsLoadingRuns(true);
    setServiceError(null);
    try {
      const data = await debugApi.listRuns({
        mode: modeFilter === "all" ? undefined : modeFilter,
      });
      setRuns(data.runs || []);
      if (data.runs && data.runs.length > 0 && !activeRunId) {
        setActiveRunId(data.runs[0].runId);
      }
    } catch (err: any) {
      setServiceError(err.message || "Lỗi kết nối tới service debug (:8000)");
    } finally {
      setIsLoadingRuns(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, [modeFilter]);

  // Load nodes and subscribe to SSE for active run
  useEffect(() => {
    if (!activeRunId) return;

    let unsubEvents: (() => void) | undefined;

    const loadRunDetails = async () => {
      try {
        const data = await debugApi.getRunNodes(activeRunId);
        setRunNodes(data.nodes || []);
      } catch (err) {
        console.error("Failed to load run nodes", err);
      }
    };

    loadRunDetails();

    // Subscribe to SSE
    setRunEvents([]);
    unsubEvents = debugApi.subscribeRunEvents(
      activeRunId,
      (event) => {
        setRunEvents((prev) => [...prev, event]);
        // Refresh nodes if event finishes
        if (event.type === "node.finished" || event.type === "run.completed") {
          loadRunDetails();
        }
      },
      (err) => {
        console.warn("SSE connection error", err);
      },
    );

    return () => {
      unsubEvents?.();
    };
  }, [activeRunId]);

  // Update selected node detail
  useEffect(() => {
    if (!activeRunId || !selectedNodeId) return;

    const found = runNodes.find((n) => {
      if (selectedIterationKey) {
        return (
          n.nodeId.includes(selectedIterationKey) &&
          n.nodeId.includes(selectedNodeId)
        );
      }
      return n.nodeId === selectedNodeId;
    });

    if (found) {
      setSelectedNodeData(found);
    } else {
      debugApi
        .getNodeDetail(activeRunId, selectedNodeId, selectedIterationKey)
        .then((res) => setSelectedNodeData(res.node))
        .catch(() => setSelectedNodeData(null));
    }
  }, [activeRunId, selectedNodeId, selectedIterationKey, runNodes]);

  const activeRun = runs.find((r) => r.runId === activeRunId);

  // Filtered runs
  const filteredRuns = runs.filter((r) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.runId.toLowerCase().includes(q) ||
        r.videoId?.toLowerCase().includes(q) ||
        r.caseId?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleSelectNode = (nodeId: string, iterationKey?: string) => {
    setSelectedNodeId(nodeId);
    setSelectedIterationKey(iterationKey);
  };

  const handleReplayNode = async (nodeId: string, iterationKey?: string) => {
    if (!activeRunId) return;
    setIsReplaying(true);
    try {
      const result = await debugApi.replayNode(
        activeRunId,
        nodeId,
        iterationKey,
      );
      await loadRuns();
      setActiveRunId(result.childRunId);
      // Automatically open comparison between parent and child
      const comp = await debugApi.compareRuns(activeRunId, result.childRunId);
      setComparisonData(comp.comparison);
      setCompareRunBId(result.childRunId);
      setIsComparing(true);
    } catch (err: any) {
      alert(`Lỗi chạy lại node: ${err.message}`);
    } finally {
      setIsReplaying(false);
    }
  };

  const handleOpenCompare = async (targetRunId: string) => {
    if (!activeRunId || !targetRunId) return;
    try {
      const comp = await debugApi.compareRuns(activeRunId, targetRunId);
      setComparisonData(comp.comparison);
      setCompareRunBId(targetRunId);
      setIsComparing(true);
    } catch (err: any) {
      alert(`Lỗi so sánh: ${err.message}`);
    }
  };

  const handleSaveToken = () => {
    setDebugToken(tokenInput.trim());
    setTokenModalOpen(false);
    loadRuns();
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Activity className="size-5 text-sky-400" />
            <h1 className="font-bold text-sm text-slate-100 tracking-wide">
              Revision Pipeline Debug{" "}
              <span className="text-sky-400 font-mono">:8001</span>
            </h1>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("canvas")}
              className={`px-3 py-1 rounded-md font-medium transition ${
                activeTab === "canvas"
                  ? "bg-slate-800 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Pipeline Canvas (AR-11)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("goldenset")}
              className={`px-3 py-1 rounded-md font-medium transition flex items-center gap-1.5 ${
                activeTab === "goldenset"
                  ? "bg-slate-800 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Award className="size-3.5 text-amber-400" />
              Golden Set Benchmarks (AR-15)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {runs.length > 1 && (
            <button
              type="button"
              onClick={() => {
                const other = runs.find((r) => r.runId !== activeRunId);
                if (other) handleOpenCompare(other.runId);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 font-medium transition"
            >
              <Layers className="size-3.5 text-sky-400" />
              So sánh 2 Runs (AR-13)
            </button>
          )}

          <button
            type="button"
            onClick={() => setTokenModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg border border-slate-800 transition"
          >
            <Key className="size-3.5" />
            Token Auth
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Runs List */}
        <aside className="w-80 border-r border-slate-800/80 bg-slate-900/40 flex flex-col shrink-0">
          <div className="p-3.5 border-b border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Danh sách Runs ({runs.length})
              </span>
              <button
                type="button"
                onClick={loadRuns}
                disabled={isLoadingRuns}
                className="p-1 text-slate-400 hover:text-white rounded transition"
              >
                <RefreshCw
                  className={`size-3.5 ${isLoadingRuns ? "animate-spin" : ""}`}
                />
              </button>
            </div>

            {/* Filter buttons */}
            <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
              <button
                type="button"
                onClick={() => setModeFilter("all")}
                className={`py-1 rounded font-medium ${
                  modeFilter === "all"
                    ? "bg-slate-800 text-white"
                    : "text-slate-400"
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setModeFilter("that")}
                className={`py-1 rounded font-medium ${
                  modeFilter === "that"
                    ? "bg-slate-800 text-emerald-400"
                    : "text-slate-400"
                }`}
              >
                Thật
              </button>
              <button
                type="button"
                onClick={() => setModeFilter("gia-lap")}
                className={`py-1 rounded font-medium ${
                  modeFilter === "gia-lap"
                    ? "bg-slate-800 text-amber-400"
                    : "text-slate-400"
                }`}
              >
                Giả lập
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="size-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm runId, videoId..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Runs list body */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40 p-1">
            {filteredRuns.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-8">
                {isLoadingRuns ? "Đang tải runs..." : "Không tìm thấy run nào"}
              </div>
            ) : (
              filteredRuns.map((r) => {
                const isSelected = r.runId === activeRunId;
                return (
                  <div
                    key={r.runId}
                    onClick={() => setActiveRunId(r.runId)}
                    className={`p-3 rounded-xl cursor-pointer transition select-none ${
                      isSelected
                        ? "bg-sky-950/40 border border-sky-500/40 shadow-xs"
                        : "hover:bg-slate-800/50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span className="font-mono text-xs font-semibold text-slate-200 truncate">
                        {r.runId}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                          r.status === "xong"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : r.status === "dang-chay"
                              ? "bg-sky-500/10 text-sky-400 border border-sky-500/20 animate-pulse"
                              : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        {r.videoId
                          ? `${r.videoId}/${r.versionId || "v1"}`
                          : "d1/v1"}
                      </span>
                      <span>
                        {r.durationMs
                          ? `${(r.durationMs / 1000).toFixed(1)}s`
                          : ""}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                        {r.mode || "that"}
                      </span>
                      {r.retryOf && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Replay con
                        </span>
                      )}
                      {r.caseCount !== undefined && (
                        <span className="text-[10px] text-slate-500">
                          {r.caseCount} vùng
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Content Area */}
        <main className="flex-1 flex flex-col p-6 overflow-hidden space-y-6">
          {serviceError && (
            <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-950/30 text-rose-300 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-rose-400 shrink-0" />
                <span>{serviceError}</span>
              </div>
              <button
                type="button"
                onClick={() => setTokenModalOpen(true)}
                className="px-2.5 py-1 text-xs bg-rose-900/60 hover:bg-rose-800 text-rose-100 rounded-lg border border-rose-700"
              >
                Nhập Token Bearer
              </button>
            </div>
          )}

          {activeTab === "canvas" ? (
            activeRunId ? (
              <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                {/* Top: Canvas */}
                <CanvasView
                  runId={activeRunId}
                  runStatus={activeRun?.status || "dang-chay"}
                  nodes={runNodes}
                  events={runEvents}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={handleSelectNode}
                  onReplayNode={handleReplayNode}
                  isReplaying={isReplaying}
                />

                {/* Bottom: Node Inspector */}
                <div className="flex-1 min-h-[300px] overflow-hidden">
                  <NodeInspector
                    node={selectedNodeData}
                    nodeId={selectedNodeId}
                    iterationKey={selectedIterationKey}
                    runModelId={
                      runs.find((r) => r.runId === activeRunId)?.modelId
                    }
                    onClose={() => setSelectedNodeId(null)}
                    onReplay={handleReplayNode}
                    isReplaying={isReplaying}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs italic">
                Chọn một run ở cột bên trái để soi đồ thị pipeline...
              </div>
            )
          ) : (
            <GoldenSetView
              onSelectRun={(runId) => {
                setActiveRunId(runId);
                setActiveTab("canvas");
              }}
            />
          )}
        </main>
      </div>

      {/* Comparison Modal (AR-13) */}
      {isComparing && comparisonData && (
        <ComparisonView
          runA={activeRunId}
          runB={compareRunBId}
          comparison={comparisonData}
          onClose={() => setIsComparing(false)}
        />
      )}

      {/* Token Modal */}
      {tokenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <Key className="size-4 text-sky-400" />
              Cấu hình Bearer Token Debug
            </h3>
            <p className="text-xs text-slate-400">
              Nhập giá trị <code>REVISION_DEBUG_TOKEN</code> trong{" "}
              <code>apps/revision-service/.env</code> để truy cập API debug.
            </p>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTokenModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveToken}
                className="px-4 py-1.5 text-xs bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium"
              >
                Lưu và kết nối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

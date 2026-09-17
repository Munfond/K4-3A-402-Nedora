"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react";

import PageWrapper from "@/components/page-wrapper";
import PipelineGraph from "@/components/studio/pipeline-graph";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NodeDebugData, RunEvent } from "@/lib/revision/events";
import type { RevisionRunResult, RunMetadata } from "@/lib/revision/types";

interface Props {
  runId: string;
  run: RunMetadata;
  result?: RevisionRunResult;
  nodes: NodeDebugData[];
  events: RunEvent[];
}

type TabId = "do-thi" | "dong-thoi-gian" | "su-kien" | "thanh-tra" | "so-sanh";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "do-thi", label: "Đồ thị" },
  { id: "dong-thoi-gian", label: "Dòng thời gian" },
  { id: "su-kien", label: "Sự kiện" },
  { id: "thanh-tra", label: "Thanh tra node" },
  { id: "so-sanh", label: "So sánh run" },
];

/** Thứ tự node theo đồ thị trong docs/agent-pipeline-ui-plan.md §3.2 */
const GRAPH_ORDER = [
  "N1_BAT_DAU",
  "N2_NAP_NGU_CANH",
  "N3_LAM_SACH_CHAN",
  "N4_PHAN_LOAI",
  "V1_KIEM_TRA_PHAN_LOAI",
  "N5_DINH_VI",
  "N6_GOM_VAN_DE",
  "N7_CHIA_VUNG",
  "MODEL_PHAN_TICH",
  "N8_LAP_PHUONG_AN",
  "V2_KIEM_TRA_PATCH",
  "V_KIEM_TRA_VA_GOM_VUNG",
  "N9_TINH_VIEC",
  "N10_GOP_KET_QUA",
  "N11_KET_THUC",
];

function statusIcon(status: string) {
  if (status === "xong") {
    return <CheckCircle2 className="size-4 text-green-600" />;
  }
  if (status === "loi") return <XCircle className="size-4 text-destructive" />;
  if (status === "dang-chay") {
    return <Loader2 className="size-4 text-primary animate-spin" />;
  }
  return <Circle className="size-4 text-muted-foreground" />;
}

function Json({ value }: { value: unknown }) {
  if (value === undefined || value === null) {
    return (
      <p className="text-xs text-muted-foreground italic">Không có dữ liệu</p>
    );
  }
  return (
    <pre className="text-[11px] leading-relaxed bg-muted/40 border rounded-md p-3 overflow-auto max-h-[420px] whitespace-pre-wrap break-words">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function RunInspectorClient({
  runId,
  run,
  result,
  nodes,
  events,
}: Props) {
  const [tab, setTab] = useState<TabId>("do-thi");
  const [selectedNodeId, setSelectedNodeId] = useState<string>(
    nodes[0]?.nodeId ?? "",
  );
  const [inspectorTab, setInspectorTab] = useState<
    "vao" | "ra" | "prompt" | "kiem-tra" | "lan-thu" | "tho"
  >("vao");
  const [replay, setReplay] = useState<{
    dangChay: boolean;
    ketQua?: Record<string, unknown>;
    loi?: string;
  }>({ dangChay: false });
  const [runIdB, setRunIdB] = useState("");
  const [soSanh, setSoSanh] = useState<{
    dangChay: boolean;
    data?: Record<string, unknown>;
    loi?: string;
  }>({ dangChay: false });

  const chayLaiNode = async (nodeId: string) => {
    setReplay({ dangChay: true });
    try {
      const res = await fetch(
        `/api/revisions/runs/${runId}/nodes/${nodeId}/replay`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setReplay({
          dangChay: false,
          loi: data?.error?.message ?? `Lỗi HTTP ${res.status}`,
        });
        return;
      }
      setReplay({ dangChay: false, ketQua: data });
    } catch (err) {
      setReplay({
        dangChay: false,
        loi: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const chaySoSanh = async () => {
    if (!runIdB.trim()) return;
    setSoSanh({ dangChay: true });
    try {
      const res = await fetch(
        `/api/revisions/runs/compare?a=${encodeURIComponent(runId)}&b=${encodeURIComponent(runIdB.trim())}`,
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSoSanh({
          dangChay: false,
          loi: data?.error?.message ?? `Lỗi HTTP ${res.status}`,
        });
        return;
      }
      setSoSanh({ dangChay: false, data });
    } catch (err) {
      setSoSanh({
        dangChay: false,
        loi: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const orderedNodes = useMemo(() => {
    const rank = (id: string) => {
      const i = GRAPH_ORDER.indexOf(id);
      return i === -1 ? GRAPH_ORDER.length : i;
    };
    return [...nodes].sort((a, b) => rank(a.nodeId) - rank(b.nodeId));
  }, [nodes]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.nodeId === selectedNodeId) ?? nodes[0],
    [nodes, selectedNodeId],
  );

  const maxMs = useMemo(
    () => Math.max(1, ...orderedNodes.map((n) => n.ms || 0)),
    [orderedNodes],
  );

  const totalMs = orderedNodes.reduce((sum, n) => sum + (n.ms || 0), 0);
  const totalTokens = orderedNodes.reduce(
    (sum, n) => sum + ((n.tokens?.input ?? 0) + (n.tokens?.output ?? 0)),
    0,
  );
  const isMock = run.mode === "gia-lap" || run.modelId?.startsWith("mock");

  return (
    <PageWrapper className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4 pb-20">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link
          href={"/dev/runs" as never}
          className="hover:text-foreground flex items-center gap-1"
        >
          <ArrowLeft className="size-3.5" /> Danh sách đợt chạy
        </Link>
        <span>/</span>
        <span className="font-mono text-foreground">{runId}</span>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono font-bold text-base">{runId}</h1>
          <Badge variant={run.status === "xong" ? "secondary" : "outline"}>
            {run.status}
          </Badge>
          {isMock && (
            <Badge className="bg-amber-100 text-amber-900 border border-amber-300">
              Giả lập
            </Badge>
          )}
          <Badge variant="outline" className="font-mono text-[10px]">
            {run.videoId ?? "d1"} · {run.versionId ?? "v1"}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono">
          <span>model: {run.modelId}</span>
          <span>prompt: {(run.promptHash || "").slice(0, 12)}…</span>
          <span>schema: {run.schemaVersion}</span>
          <span>tổng: {(totalMs / 1000).toFixed(1)}s</span>
          <span>
            token: {totalTokens || run.attempts?.[0]?.totalTokens || 0}
          </span>
          <span>node: {orderedNodes.length}</span>
        </div>
        {run.error && (
          <p className="text-xs text-destructive">
            {run.error.code}: {run.error.message}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1 bg-muted/60 p-1 rounded-lg border text-xs w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              tab === t.id
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "do-thi" && (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <p className="text-xs text-muted-foreground mb-2">
              Sơ đồ pipeline. Node chạy song song xếp cùng cột. Bấm một node để
              mở thanh tra.
            </p>
            <PipelineGraph
              nodes={orderedNodes}
              selectedNodeId={selectedNode?.nodeId}
              onSelectNode={(id) => {
                setSelectedNodeId(id);
                setTab("thanh-tra");
              }}
            />
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-2 text-xs">
            <p className="font-semibold">Tổng kết</p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Node lỗi</span>
              <span>
                {orderedNodes.filter((n) => n.status === "loi").length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Node phải thử lại</span>
              <span>{orderedNodes.filter((n) => n.attempts > 1).length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vùng sửa</span>
              <span>{result?.cases.length ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vấn đề</span>
              <span>{result?.issues.length ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ghi nhận kiểm tra</span>
              <span>{result?.validation.findings.length ?? 0}</span>
            </div>
            {run.caseId && (
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">Case golden set</span>
                <span className="font-mono">{run.caseId}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "dong-thoi-gian" && (
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <p className="text-xs text-muted-foreground mb-2">
            Độ dài thanh theo thời gian chạy của node, so với node lâu nhất.
          </p>
          {orderedNodes.map((n) => (
            <div key={n.nodeId} className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono">
                <span>{n.nodeId}</span>
                <span className="text-muted-foreground">
                  {((n.ms || 0) / 1000).toFixed(1)}s
                </span>
              </div>
              <div className="h-2.5 rounded bg-muted overflow-hidden">
                <div
                  className={`h-full ${
                    n.status === "loi" ? "bg-destructive" : "bg-primary"
                  }`}
                  style={{
                    width: `${Math.max(1, ((n.ms || 0) / maxMs) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground pt-2 border-t">
            Các node hiện chạy tuần tự; khi làm P2 (iteration song song) thanh
            của các vùng sẽ chồng thời gian lên nhau.
          </p>
        </div>
      )}

      {tab === "su-kien" && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-3">
            {events.length} sự kiện trong <code>events.jsonl</code>.
          </p>
          <div className="space-y-1 max-h-[560px] overflow-auto font-mono text-[11px]">
            {events.map((ev) => (
              <div
                key={ev.seq}
                className="flex gap-2 border-b border-border/40 py-1"
              >
                <span className="text-muted-foreground w-8 shrink-0">
                  {ev.seq}
                </span>
                <span className="text-muted-foreground w-20 shrink-0">
                  {new Date(ev.at).toLocaleTimeString("vi-VN")}
                </span>
                <span className="w-32 shrink-0 font-semibold">{ev.type}</span>
                <span className="flex-1 break-words text-muted-foreground">
                  {"nodeId" in ev ? ev.nodeId : ""}{" "}
                  {"summary" in ev ? ev.summary : ""}
                  {"label" in ev ? `${ev.label} ${ev.done}s` : ""}
                  {"kind" in ev ? ev.kind : ""}
                  {"errorCode" in ev ? ev.errorCode : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "thanh-tra" && (
        <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="rounded-xl border bg-card p-2 space-y-1 h-fit">
            {orderedNodes.map((n) => (
              <button
                key={n.nodeId}
                type="button"
                onClick={() => setSelectedNodeId(n.nodeId)}
                className={`w-full text-left flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                  selectedNode?.nodeId === n.nodeId
                    ? "bg-primary/10 text-foreground"
                    : "hover:bg-muted/60 text-muted-foreground"
                }`}
              >
                {statusIcon(n.status)}
                <span className="font-mono truncate">{n.nodeId}</span>
              </button>
            ))}
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-3">
            {!selectedNode ? (
              <p className="text-xs text-muted-foreground">
                Run này chưa có dữ liệu node.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono font-bold">
                    {selectedNode.nodeId}
                  </span>
                  <Badge variant="outline">{selectedNode.status}</Badge>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="size-3" />
                    {((selectedNode.ms || 0) / 1000).toFixed(1)}s
                  </span>
                  <span className="text-muted-foreground">
                    lần thử: {selectedNode.attempts}
                  </span>
                  {selectedNode.tokens && (
                    <span className="text-muted-foreground font-mono">
                      {selectedNode.tokens.input}/{selectedNode.tokens.output}{" "}
                      tk
                    </span>
                  )}
                </div>

                {selectedNode.error && (
                  <p className="text-xs text-destructive flex items-start gap-1.5">
                    <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
                    {selectedNode.error}
                  </p>
                )}

                {(selectedNode.nodeType === "N4_PHAN_LOAI" ||
                  selectedNode.nodeType === "N8_LAP_PHUONG_AN") && (
                  <div className="rounded-lg border bg-muted/20 p-2.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        Gọi lại model bằng đúng input đã lưu. Không ghi đè run
                        gốc, chỉ để đối chiếu.
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs gap-1.5 shrink-0"
                        disabled={replay.dangChay}
                        onClick={() => chayLaiNode(selectedNode.nodeId)}
                      >
                        <RotateCcw className="size-3.5" />
                        {replay.dangChay ? "Đang chạy lại…" : "Chạy lại node"}
                      </Button>
                    </div>
                    {replay.loi && (
                      <p className="text-xs text-destructive">{replay.loi}</p>
                    )}
                    {replay.ketQua && (
                      <div className="text-[11px] space-y-1">
                        <p>
                          <span className="text-muted-foreground">
                            Lần chạy lại:{" "}
                          </span>
                          {((Number(replay.ketQua.ms) || 0) / 1000).toFixed(1)}s
                          {" · "}
                          {String(replay.ketQua.tokens ?? 0)} token
                          {" · gốc "}
                          {((Number(replay.ketQua.msGoc) || 0) / 1000).toFixed(
                            1,
                          )}
                          s
                        </p>
                        <p className="text-muted-foreground">
                          Prompt hash{" "}
                          {replay.ketQua.promptHash ===
                          replay.ketQua.promptHashGoc
                            ? "giống bản gốc"
                            : "KHÁC bản gốc"}
                        </p>
                        <details>
                          <summary className="cursor-pointer text-primary">
                            Xem output lần chạy lại
                          </summary>
                          <Json value={replay.ketQua.output} />
                        </details>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-1 border-b pb-2">
                  {(
                    [
                      ["vao", "Vào"],
                      ["ra", "Ra"],
                      ["prompt", "Prompt"],
                      ["kiem-tra", "Kiểm tra"],
                      ["lan-thu", "Lần thử"],
                      ["tho", "Thô"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setInspectorTab(id)}
                      className={`px-2.5 py-1 rounded-md text-xs ${
                        inspectorTab === id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/60 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {inspectorTab === "vao" && <Json value={selectedNode.input} />}
                {inspectorTab === "ra" && <Json value={selectedNode.output} />}
                {inspectorTab === "prompt" && (
                  <div className="space-y-2 text-xs">
                    <p>
                      <span className="text-muted-foreground">
                        promptVersion:{" "}
                      </span>
                      <span className="font-mono">
                        {selectedNode.promptVersion ?? "—"}
                      </span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">
                        promptHash:{" "}
                      </span>
                      <span className="font-mono break-all">
                        {selectedNode.promptHash ?? "—"}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      Bản prompt đã render chỉ lưu khi bật{" "}
                      <code>REVISION_DEBUG_TRACE=1</code>.
                    </p>
                  </div>
                )}
                {inspectorTab === "kiem-tra" && (
                  <Json value={selectedNode.findings} />
                )}
                {inspectorTab === "lan-thu" && <Json value={run.attempts} />}
                {inspectorTab === "tho" && (
                  <Json value={selectedNode.rawOutput} />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {tab === "so-sanh" && (
        <div className="rounded-xl border bg-card p-4 space-y-3 text-xs">
          <p className="font-semibold">So sánh với run khác (AP-10)</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={runIdB}
              onChange={(e) => setRunIdB(e.target.value)}
              placeholder="Dán runId thứ hai, ví dụ run-20260917-160128-130e"
              className="flex-1 min-w-[280px] h-8 rounded-md border bg-background px-2.5 text-xs font-mono"
            />
            <Button
              size="sm"
              className="text-xs"
              disabled={soSanh.dangChay || !runIdB.trim()}
              onClick={chaySoSanh}
            >
              {soSanh.dangChay ? "Đang so…" : "So sánh"}
            </Button>
          </div>

          {soSanh.loi && <p className="text-destructive">{soSanh.loi}</p>}

          {soSanh.data && (
            <div className="space-y-3">
              {!(soSanh.data as { cungInputHash?: boolean }).cungInputHash && (
                <p className="text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                  <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
                  Hai run khác `inputHash`: khác cả đầu vào nên chênh lệch dưới
                  đây không chỉ do đổi prompt hay graph.
                </p>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                {(["a", "b"] as const).map((ky) => {
                  const r = (
                    soSanh.data as Record<string, Record<string, unknown>>
                  )[ky];
                  return (
                    <div key={ky} className="rounded-lg border p-2.5 space-y-1">
                      <p className="font-mono font-semibold">
                        {ky.toUpperCase()}: {String(r.runId)}
                      </p>
                      <p className="text-muted-foreground">
                        {String(r.modelId)} ·{" "}
                        {((Number(r.durationMs) || 0) / 1000).toFixed(1)}s
                      </p>
                      <p>
                        vấn đề {String(r.soVanDe)} · vùng {String(r.soVung)} ·
                        vùng có phương án {String(r.vungCoPhuongAn)}
                      </p>
                      <p>
                        phương án hợp lệ {String(r.phuongAnHopLe)} · ghi nhận{" "}
                        {String(r.soFindings)}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="overflow-auto">
                <table className="w-full text-[11px] font-mono">
                  <thead className="text-muted-foreground border-b">
                    <tr>
                      <th className="text-left py-1">node</th>
                      <th className="text-right py-1">ms A</th>
                      <th className="text-right py-1">ms B</th>
                      <th className="text-right py-1">token A</th>
                      <th className="text-right py-1">token B</th>
                      <th className="text-left py-1 pl-2">ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      (
                        soSanh.data as {
                          nodes?: Array<Record<string, unknown>>;
                        }
                      ).nodes ?? []
                    ).map((n) => (
                      <tr
                        key={String(n.nodeId)}
                        className="border-b border-border/40"
                      >
                        <td className="py-1">{String(n.nodeId)}</td>
                        <td className="text-right">{String(n.msA ?? "—")}</td>
                        <td className="text-right">{String(n.msB ?? "—")}</td>
                        <td className="text-right">
                          {String(n.tokensA ?? "—")}
                        </td>
                        <td className="text-right">
                          {String(n.tokensB ?? "—")}
                        </td>
                        <td className="pl-2 text-muted-foreground">
                          {n.chiCoO ? `chỉ có ở ${String(n.chiCoO)}` : ""}
                          {n.trangThaiA !== n.trangThaiB
                            ? ` trạng thái khác: ${String(n.trangThaiA)} / ${String(n.trangThaiB)}`
                            : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </PageWrapper>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  ExternalLink,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  Terminal,
  XCircle,
} from "lucide-react";

import PageWrapper from "@/components/page-wrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RunMetadata } from "@/lib/revision/types";

interface DevRunsClientProps {
  initialRuns: RunMetadata[];
}

export default function DevRunsClient({ initialRuns }: DevRunsClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "xong" | "loi" | "dang-chay"
  >("all");

  const stats = useMemo(() => {
    const total = initialRuns.length;
    const xong = initialRuns.filter((r) => r.status === "xong").length;
    const loi = initialRuns.filter((r) => r.status === "loi").length;
    const dangChay = initialRuns.filter((r) => r.status === "dang-chay").length;
    return { total, xong, loi, dangChay };
  }, [initialRuns]);

  const filteredRuns = useMemo(() => {
    return initialRuns.filter((run) => {
      if (statusFilter !== "all" && run.status !== statusFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchId = run.runId.toLowerCase().includes(q);
      const matchModel = run.modelId?.toLowerCase().includes(q);
      const matchHash = run.inputHash?.toLowerCase().includes(q);
      return matchId || matchModel || matchHash;
    });
  }, [initialRuns, statusFilter, searchQuery]);

  return (
    <PageWrapper className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 pb-20">
      {/* HEADER BANNER KỸ SƯ */}
      <div className="rounded-2xl border bg-card p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Terminal className="size-5 text-primary" />
              <h1 className="text-xl font-bold text-foreground">
                Thanh tra Đợt phân tích (Revision Agent Debug Console)
              </h1>
              <Badge
                variant="outline"
                className="text-xs font-mono border-primary/30 text-primary"
              >
                REVISION_DEBUG_UI=1
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Màn hình kỹ sư phân tích theo đồ thị node, dòng thời gian Gantt,
              sự kiện SSE và thanh tra telemetry.
            </p>
          </div>

          {/* STATS BADGES */}
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="px-2.5 py-1 font-mono">
              Tổng: {stats.total} runs
            </Badge>
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-1 font-mono">
              {stats.xong} hoàn tất
            </Badge>
            {stats.dangChay > 0 && (
              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-2.5 py-1 font-mono animate-pulse">
                {stats.dangChay} đang chạy
              </Badge>
            )}
            {stats.loi > 0 && (
              <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 px-2.5 py-1 font-mono">
                {stats.loi} lỗi
              </Badge>
            )}
          </div>
        </div>

        {/* SEARCH & FILTERS */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Search className="size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Tìm theo Run ID, model, inputHash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs bg-background"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                statusFilter === "all"
                  ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              Tất cả ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("xong")}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                statusFilter === "xong"
                  ? "bg-emerald-600 text-white font-bold shadow-2xs"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              Hoàn tất ({stats.xong})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("dang-chay")}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                statusFilter === "dang-chay"
                  ? "bg-blue-600 text-white font-bold shadow-2xs"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              Đang chạy ({stats.dangChay})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("loi")}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                statusFilter === "loi"
                  ? "bg-rose-600 text-white font-bold shadow-2xs"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              Lỗi ({stats.loi})
            </button>
          </div>
        </div>
      </div>

      {/* DANH SÁCH RUNS */}
      <div className="space-y-3">
        {filteredRuns.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed text-xs text-muted-foreground space-y-2">
            <Database className="size-8 mx-auto text-muted-foreground/50" />
            <p>Không tìm thấy đợt phân tích nào phù hợp với bộ lọc.</p>
          </div>
        ) : (
          filteredRuns.map((run) => {
            const isMock =
              run.mode === "gia-lap" || run.modelId?.startsWith("mock");
            const durationMs =
              run.attempts?.reduce((acc, a) => acc + (a.durationMs || 0), 0) ||
              0;
            const totalTokens =
              run.attempts?.reduce((acc, a) => acc + (a.totalTokens || 0), 0) ||
              0;

            return (
              <div
                key={run.runId}
                className="p-4 rounded-xl border bg-card hover:border-primary/50 transition-all shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/dev/runs/${run.runId}`}
                      className="font-mono font-bold text-sm text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                    >
                      <span>{run.runId}</span>
                      <ExternalLink className="size-3 text-muted-foreground" />
                    </Link>

                    {run.status === "xong" ? (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 text-[10px] gap-1">
                        <CheckCircle2 className="size-3" /> Hoàn tất
                      </Badge>
                    ) : run.status === "dang-chay" ? (
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 text-[10px] gap-1 animate-pulse">
                        <Loader2 className="size-3 animate-spin" /> Đang chạy
                      </Badge>
                    ) : (
                      <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 text-[10px] gap-1">
                        <XCircle className="size-3" /> Thất bại
                      </Badge>
                    )}

                    {isMock && (
                      <Badge
                        variant="outline"
                        className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]"
                      >
                        Giả lập
                      </Badge>
                    )}

                    {run.graphVersion && (
                      <Badge
                        variant="secondary"
                        className="font-mono text-[10px]"
                      >
                        {run.graphVersion}
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono">
                    <span className="flex items-center gap-1">
                      <Cpu className="size-3 text-primary" />
                      <span>{run.modelId || "chưa xác định model"}</span>
                    </span>

                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      <span>
                        {new Date(run.createdAt).toLocaleString("vi-VN")}
                      </span>
                    </span>

                    {durationMs > 0 && (
                      <span>Thời gian: {(durationMs / 1000).toFixed(1)}s</span>
                    )}

                    {totalTokens > 0 && (
                      <span>Tokens: {totalTokens.toLocaleString()}</span>
                    )}

                    {run.inputHash && (
                      <span
                        className="truncate max-w-[140px]"
                        title={run.inputHash}
                      >
                        hash: {run.inputHash.slice(0, 8)}…
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/dev/runs/${run.runId}`}>
                    <Button size="sm" className="gap-1.5 text-xs font-semibold">
                      <span>Mở thanh tra (5 tabs)</span>
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </PageWrapper>
  );
}

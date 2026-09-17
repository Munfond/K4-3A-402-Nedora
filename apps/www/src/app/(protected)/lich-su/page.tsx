"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Clock,
  Download,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Layers,
  Users,
  MessageSquare,
  Sparkles,
  History,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import PageWrapper from "@/components/page-wrapper";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { setLastRunId } from "@/hooks/use-quyet-dinh";
import type { RunMetadata } from "@/lib/revision/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function LichSuPage() {
  const router = useRouter();
  const { data, isLoading, error, mutate } = useSWR<{ runs: RunMetadata[] }>(
    "/api/revisions/runs",
    fetcher,
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const runs = data?.runs || [];

  const handleOpenRun = (runId: string) => {
    setLastRunId(runId);
    router.push(`/van-de?run=${runId}`);
  };

  const handleCopyId = (runId: string) => {
    navigator.clipboard.writeText(runId);
    setCopiedId(runId);
    toast.success(`Đã sao chép mã ${runId}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadTrace = async (runId: string) => {
    try {
      setDownloadingId(runId);
      const res = await fetch(`/api/revisions/runs/${runId}/trace`);
      if (!res.ok) {
        throw new Error("Không thể tải trace");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trace-${runId}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Đã tải xuống file trace thành công");
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi tải trace");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <PageWrapper>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <History className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">
                Lịch sử lượt chạy
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Đối chiếu đầu vào mới, thông số model và kết quả phân tích theo
              từng phiên
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => mutate()}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
              Làm mới
            </Button>
            <Button asChild size="sm" className="gap-2">
              <Link href="/">
                <Sparkles className="h-4 w-4" />
                Phân tích mới
              </Link>
            </Button>
          </div>
        </div>

        {/* Content Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Danh sách các lượt chạy ({runs.length})</span>
            </CardTitle>
            <CardDescription>
              Mỗi lượt chạy được lưu vết độc lập tại{" "}
              <code>.data/revision-runs/</code> với nhật ký đầy đủ
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                <span>Đang tải danh sách lịch sử...</span>
              </div>
            ) : error ? (
              <div className="py-12 text-center text-destructive text-sm flex flex-col items-center gap-2">
                <AlertCircle className="h-6 w-6" />
                <span>
                  Lỗi khi tải danh sách: {error.message || "Không xác định"}
                </span>
              </div>
            ) : runs.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <History className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">
                    Chưa có lượt chạy nào
                  </p>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Hãy bấm nút &quot;Phân tích mới&quot; hoặc bắt đầu từ trang
                    Tổng quan để chạy lượt phân tích đầu tiên.
                  </p>
                </div>
                <Button asChild size="sm" className="mt-2">
                  <Link href="/">Bắt đầu phân tích</Link>
                </Button>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Mã lượt chạy</TableHead>
                      <TableHead>Thời điểm</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Góp ý &amp; Người gửi</TableHead>
                      <TableHead>Hồ sơ</TableHead>
                      <TableHead>Model / Thời gian</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((r) => {
                      const totalTokens = r.attempts?.reduce(
                        (sum, att) => sum + (att.totalTokens || 0),
                        0,
                      );
                      const isSuccess = r.status === "xong";

                      return (
                        <TableRow key={r.runId}>
                          <TableCell className="font-mono text-xs font-medium">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="truncate max-w-[140px]"
                                title={r.runId}
                              >
                                {r.runId}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyId(r.runId)}
                                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                                title="Sao chép runId"
                              >
                                {copiedId === r.runId ? (
                                  <Check className="h-3 w-3 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(r.createdAt).toLocaleString("vi-VN", {
                                hour: "2-digit",
                                minute: "2-digit",
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })}
                            </div>
                          </TableCell>
                          <TableCell>
                            {isSuccess ? (
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 text-[11px]"
                              >
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                Hoàn tất
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-rose-50 text-rose-700 border-rose-200 gap-1 text-[11px]"
                              >
                                <AlertCircle className="h-3 w-3 text-rose-600" />
                                Lỗi ({r.error?.code || "LOI"})
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="space-y-0.5">
                              <div className="font-medium text-foreground flex items-center gap-1">
                                <MessageSquare className="h-3 w-3 text-muted-foreground" />
                                {r.totalFeedback} góp ý
                                {r.newFeedbackCount > 0 && (
                                  <span className="text-[11px] text-primary font-normal">
                                    ({r.newFeedbackCount} mới)
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {r.independentSenders} người gửi độc lập
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-1">
                              <Layers className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium">{r.caseCount}</span>{" "}
                              hồ sơ
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1 font-mono text-[11px] text-foreground">
                                <Cpu className="h-3 w-3 text-muted-foreground" />
                                {r.modelId.split("/").pop() || r.modelId}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {(r.durationMs / 1000).toFixed(1)}s
                                {totalTokens && totalTokens > 0
                                  ? ` · ${totalTokens.toLocaleString()} tokens`
                                  : ""}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs gap-1"
                                onClick={() => handleDownloadTrace(r.runId)}
                                disabled={downloadingId === r.runId}
                                title="Tải file vết chạy truy_vet.json"
                              >
                                <Download className="h-3 w-3" />
                                Trace
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 px-2.5 text-xs gap-1"
                                onClick={() => handleOpenRun(r.runId)}
                              >
                                Mở kết quả
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}

"use client";

import { useState, useEffect } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Flag,
  GalleryVerticalEnd,
  Loader2,
  MessagesSquare,
  Plus,
  RefreshCw,
  Trash2,
  AlertCircle,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import useSWR from "swr";

import PageWrapper from "@/components/page-wrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { getLastRunId, setLastRunId } from "@/hooks/use-quyet-dinh";
import type {
  NewFeedbackInput,
  RevisionRunResult,
  RunMetadata,
} from "@/lib/revision/types";
import { dinhDangPhut } from "@/lib/revision/format";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function TongQuanPage() {
  const [includeD1, setIncludeD1] = useState(true);
  const [newFeedbacks, setNewFeedbacks] = useState<NewFeedbackInput[]>([]);
  const [currentText, setCurrentText] = useState("");
  const [currentChannel, setCurrentChannel] = useState<
    "binh-luan" | "tin-nhan" | "khao-sat"
  >("binh-luan");
  const [currentSender, setCurrentSender] = useState("");

  const [analyzing, setAnalyzing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorInfo, setErrorInfo] = useState<{
    code: string;
    message: string;
    runId?: string;
  } | null>(null);
  const [activeRunId, setActiveRunId] = useState<string>("");

  // Lấy lastRunId khi tải trang
  useEffect(() => {
    const last = getLastRunId();
    if (last) setActiveRunId(last);
  }, []);

  // Timer khi đang phân tích
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (analyzing) {
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [analyzing]);

  // Lấy dữ liệu của active run
  const { data: runData, mutate: mutateRun } = useSWR<{
    run: RunMetadata;
    result?: RevisionRunResult;
  }>(activeRunId ? `/api/revisions/runs/${activeRunId}` : null, fetcher);

  const handleAddFeedback = () => {
    if (!currentText.trim()) return;
    setNewFeedbacks((prev) => [
      ...prev,
      {
        text: currentText.trim(),
        channel: currentChannel,
        sender: currentSender.trim() || undefined,
      },
    ]);
    setCurrentText("");
    setCurrentSender("");
  };

  const handleRemoveFeedback = (index: number) => {
    setNewFeedbacks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStartAnalysis = async () => {
    setAnalyzing(true);
    setErrorInfo(null);

    try {
      const res = await fetch("/api/revisions/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scriptId: "d1",
          includeD1Feedback: includeD1,
          newFeedback: newFeedbacks,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorInfo({
          code: data.error?.code || `HTTP_${res.status}`,
          message: data.error?.message || "Phân tích thất bại",
          runId: data.error?.runId || data.runId,
        });
        if (data.runId) {
          setActiveRunId(data.runId);
          setLastRunId(data.runId);
        }
      } else {
        const runId = data.runId;
        setActiveRunId(runId);
        setLastRunId(runId);
        mutateRun();
      }
    } catch (err: unknown) {
      setErrorInfo({
        code: "NETWORK_ERROR",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const result = runData?.result;
  const run = runData?.run;

  return (
    <PageWrapper className="flex flex-col overflow-y-auto bg-sidebar pb-24 dark:bg-[#0a0a0a]">
      <div className="mx-auto mt-8 w-full max-w-4xl shrink-0 px-4 text-center">
        <p className="font-mono text-muted-foreground text-xs uppercase tracking-widest">
          VIDEO D1 · BẢN V2 REVISION PLANNER
        </p>
        <h1 className="mt-2 text-balance font-bold text-3xl dark:text-gray-50 sm:text-4xl">
          Đề xuất chỉnh sửa dựa trên phản hồi góp ý
        </h1>
        <p className="mt-2 text-balance text-muted-foreground text-sm dark:text-gray-400">
          Biến các lời phàn nàn thành phương án sửa có bằng chứng, phân vùng độc
          lập và tính gói bàn giao không trùng việc.
        </p>
      </div>

      {/* KHUNG PHÂN TÍCH GÓP Ý (C3-UI-01) */}
      <div className="mx-auto mt-6 w-full max-w-4xl px-4">
        <Card className="border-neutral-200 shadow-sm dark:border-neutral-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span>Đợt phân tích góp ý</span>
              <Badge
                variant="outline"
                className="font-normal font-mono text-xs"
              >
                {includeD1 ? "D1 (22 góp ý)" : "Tùy chỉnh"} +{" "}
                {newFeedbacks.length} góp ý mới
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={includeD1}
                onChange={(e) => setIncludeD1(e.target.checked)}
                className="size-4 rounded border-gray-300"
              />
              <span>Dùng bộ góp ý D1 hiện có (22 góp ý từ 20 người học)</span>
            </label>

            <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider">
                Thêm góp ý mới vào đợt này
              </p>
              <Textarea
                placeholder="Nhập nội dung góp ý của người học (1–2000 ký tự)..."
                value={currentText}
                onChange={(e) => setCurrentText(e.target.value)}
                rows={2}
                className="resize-none text-sm bg-background"
              />
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={currentChannel}
                  onChange={(e: any) => setCurrentChannel(e.target.value)}
                  className="rounded-md border bg-background px-2.5 py-1.5 text-xs"
                >
                  <option value="binh-luan">Bình luận</option>
                  <option value="tin-nhan">Tin nhắn</option>
                  <option value="khao-sat">Khảo sát</option>
                </select>
                <Input
                  placeholder="Mã người gửi (vd: hv-901, tùy chọn)"
                  value={currentSender}
                  onChange={(e) => setCurrentSender(e.target.value)}
                  className="h-8 max-w-[200px] text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddFeedback}
                  disabled={!currentText.trim()}
                  className="gap-1.5 ml-auto text-xs"
                >
                  <Plus className="size-3.5" />
                  Thêm góp ý
                </Button>
              </div>

              {newFeedbacks.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    Góp ý mới đã thêm ({newFeedbacks.length}):
                  </p>
                  <div className="max-h-36 overflow-y-auto space-y-1">
                    {newFeedbacks.map((fb, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 rounded bg-background p-2 text-xs border"
                      >
                        <span className="truncate max-w-[80%]">
                          <strong className="text-muted-foreground">
                            [{fb.channel}
                            {fb.sender ? ` · ${fb.sender}` : ""}]
                          </strong>{" "}
                          {fb.text}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveFeedback(idx)}
                          className="size-6 text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Trạng thái lỗi */}
            {errorInfo && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-800 text-xs dark:border-red-900 dark:bg-red-950/50 dark:text-red-300 space-y-1">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircle className="size-4" />
                  <span>Lỗi: {errorInfo.code}</span>
                </div>
                <p>{errorInfo.message}</p>
                {errorInfo.runId && (
                  <p className="font-mono text-muted-foreground">
                    Run ID: {errorInfo.runId}
                  </p>
                )}
                <div className="pt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleStartAnalysis}
                    className="gap-1.5 text-xs h-7"
                  >
                    <RefreshCw className="size-3" />
                    Thử lại
                  </Button>
                </div>
              </div>
            )}

            {/* Trạng thái hoàn tất của run vừa xong */}
            {result && !analyzing && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-green-900 text-xs dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-green-600" />
                  <span>
                    Đã hoàn thành phân tích (Run:{" "}
                    <code className="font-mono font-bold">{result.runId}</code>)
                    · {result.cases.length} hồ sơ duyệt
                  </span>
                </div>
                <Link
                  href={`/van-de?run=${result.runId}`}
                  className="inline-flex items-center gap-1 font-semibold text-green-700 hover:underline dark:text-green-300"
                >
                  Xem danh sách vấn đề <ArrowRight className="size-3.5" />
                </Link>
              </div>
            )}

            {/* Nút Phân tích */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-muted-foreground">
                {analyzing ? (
                  <span className="flex items-center gap-2 text-primary">
                    <Loader2 className="size-4 animate-spin" />
                    Đang gọi model phân tích... ({elapsedSeconds}s)
                  </span>
                ) : (
                  <span>Sẵn sàng phân tích với model AI thật</span>
                )}
              </div>
              <Button
                type="button"
                onClick={handleStartAnalysis}
                disabled={
                  analyzing || (!includeD1 && newFeedbacks.length === 0)
                }
                className="gap-2"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Đang phân tích...
                  </>
                ) : (
                  <>
                    <RefreshCw className="size-4" />
                    Phân tích góp ý
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* THẺ THỐNG KÊ RUN HIỆN TẠI */}
      <div className="mx-auto mt-6 grid w-full max-w-4xl gap-3 px-4 sm:grid-cols-3">
        <Link
          href={
            activeRunId ? `/van-de?run=${activeRunId}` : ("/van-de" as Route)
          }
        >
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardContent className="flex items-center gap-3 p-4">
              <GalleryVerticalEnd className="size-5 text-muted-foreground" />
              <div>
                <p className="font-semibold text-2xl">
                  {result ? result.cases.length : "—"}
                </p>
                <p className="text-muted-foreground text-xs">Hồ sơ vùng sửa</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link
          href={activeRunId ? `/gop-y?run=${activeRunId}` : ("/gop-y" as Route)}
        >
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardContent className="flex items-center gap-3 p-4">
              <MessagesSquare className="size-5 text-muted-foreground" />
              <div>
                <p className="font-semibold text-2xl">
                  {result ? result.feedback.length : "—"}
                </p>
                <p className="text-muted-foreground text-xs">Góp ý đã nhận</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link
          href={
            activeRunId
              ? `/gop-y/gan-co?run=${activeRunId}`
              : ("/gop-y/gan-co" as Route)
          }
        >
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardContent className="flex items-center gap-3 p-4">
              <Flag className="size-5 text-muted-foreground" />
              <div>
                <p className="font-semibold text-2xl">
                  {result ? result.quarantinedFeedback.length : "—"}
                </p>
                <p className="text-muted-foreground text-xs">
                  Góp ý cách ly (gắn cờ)
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* HƯỚNG DẪN LUỒNG DUYỆT */}
      <div className="mx-auto mt-6 w-full max-w-4xl px-4">
        <Card>
          <CardContent className="space-y-3 p-5 text-sm">
            <p className="font-medium">
              Luồng làm việc hai tầng của Revision Planner
            </p>
            <ol className="ml-4 list-decimal space-y-1 text-muted-foreground text-xs">
              <li>
                <strong className="text-foreground">
                  Tầng 1 — Hồ sơ quyết định từng vùng:
                </strong>{" "}
                Người duyệt xem các vấn đề và bằng chứng gốc, so sánh ngang hai
                phương án A/B (nội dung trước/sau, câu thu lại, cảnh dựng lại),
                rồi chọn A, B, hoặc hoãn/bỏ.
              </li>
              <li>
                <strong className="text-foreground">
                  Tầng 2 — Gói phát hành cả phiên bản:
                </strong>{" "}
                Mỗi lựa chọn được code tự động tính lại toàn bộ: hợp nhất câu
                thu lại theo ngữ cảnh ±1 câu, loại trùng, phát hiện xung đột và
                xuất kịch bản mới cùng danh sách việc.
              </li>
            </ol>
            {result && result.unassignedFeedback.length > 0 && (
              <p className="text-muted-foreground text-xs">
                Có {result.unassignedFeedback.length} phản hồi (khen / chỉ chấm
                điểm / nhiễu) không tạo thành vấn đề cần sửa — xem tại trang Góp
                ý gốc.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}

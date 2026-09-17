"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clapperboard,
  Clock,
  Download,
  Eye,
  FileCode,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Mic,
  RotateCcw,
  Sparkles,
  Subtitles,
  Users,
} from "lucide-react";

import PageWrapper from "@/components/page-wrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServiceOfflineBanner } from "@/components/studio/service-offline-banner";
import { getLastRunId, useQuyetDinh } from "@/hooks/use-quyet-dinh";
import { revisionClient, RevisionServiceError } from "@/lib/revision-client";
import { computeReleaseSnapshot } from "@/lib/revision/engine";
import { dinhDangPhut } from "@/lib/revision/format";
import type {
  RevisionRunResult,
  RunMetadata,
  WorkItem,
} from "@/lib/revision/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function XuatPage() {
  const searchParams = useSearchParams();
  const queryRunId = searchParams.get("run");
  const [activeRunId, setActiveRunId] = useState<string>(queryRunId || "");

  useEffect(() => {
    if (queryRunId) {
      setActiveRunId(queryRunId);
    } else {
      const last = getLastRunId();
      if (last) setActiveRunId(last);
    }
  }, [queryRunId]);

  const { bang, xoaHet, isStorageFailed } = useQuyetDinh(activeRunId);

  const {
    data,
    isLoading,
    error: runFetchError,
    mutate: mutateRun,
  } = useSWR<{
    run: RunMetadata;
    result?: RevisionRunResult;
  }>(
    activeRunId ? ["revision-run", activeRunId] : null,
    ([, id]: [string, string]) => revisionClient.getRun(id),
  );

  const isServiceOffline = Boolean(
    (runFetchError instanceof RevisionServiceError &&
      runFetchError.isConnectionError) ||
      (runFetchError &&
        "isConnectionError" in (runFetchError as any) &&
        (runFetchError as any).isConnectionError),
  );

  const result = data?.result;
  const script = result?.script;
  const cases = useMemo(() => result?.cases || [], [result]);
  const allFeedback = useMemo(() => result?.feedback || [], [result]);

  const [downloading, setDownloading] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showOnlyChanged, setShowOnlyChanged] = useState(true);
  const [workFilter, setWorkFilter] = useState<
    "all" | "thu-lai" | "dung-canh" | "sua-phu-de"
  >("all");

  // Feedback lookup map
  const feedbackById = useMemo(() => {
    const map = new Map<string, (typeof allFeedback)[0]>();
    for (const f of allFeedback) {
      map.set(f.id, f);
    }
    return map;
  }, [allFeedback]);

  // Case lookup map
  const caseById = useMemo(() => {
    const map = new Map<string, (typeof cases)[0]>();
    for (const c of cases) {
      map.set(c.id, c);
    }
    return map;
  }, [cases]);

  // Release snapshot
  const snapshot = useMemo(() => {
    if (!script || cases.length === 0) return null;
    return computeReleaseSnapshot({
      runId: activeRunId,
      inputHash: result?.inputHash || "export",
      script,
      cases,
      decisions: bang,
    });
  }, [activeRunId, result, script, cases, bang]);

  const handleDownloadFile = async (
    fileType:
      | "kich-ban-v2.json"
      | "kich-ban-v2.md"
      | "viec-can-lam.csv"
      | "truy-vet.json",
  ) => {
    if (!activeRunId) return;
    setDownloading(fileType);
    setExportError(null);

    try {
      const blob = await revisionClient.exportReleaseFile(
        activeRunId,
        fileType,
        bang,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileType;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(null);
    }
  };

  // Nút chính: Xuất trọn bộ gói chỉnh sửa (tải lần lượt 4 file)
  const handleExportAll = async () => {
    const files: Array<
      | "kich-ban-v2.json"
      | "kich-ban-v2.md"
      | "viec-can-lam.csv"
      | "truy-vet.json"
    > = [
      "kich-ban-v2.json",
      "kich-ban-v2.md",
      "viec-can-lam.csv",
      "truy-vet.json",
    ];

    setDownloading("all");
    setExportError(null);

    try {
      for (const f of files) {
        await handleDownloadFile(f);
        // Small delay to let browser handle multiple downloads
        await new Promise((r) => setTimeout(r, 400));
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(null);
    }
  };

  if (isLoading) {
    return (
      <PageWrapper className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-2 text-muted-foreground text-sm">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Đang tải gói bản sửa v2...</span>
        </div>
      </PageWrapper>
    );
  }

  if (!result || !script || !snapshot) {
    return (
      <PageWrapper className="flex flex-col items-center justify-center min-h-[60vh] p-10 text-center space-y-4">
        <p className="text-muted-foreground">
          Chưa có dữ liệu phân tích nào được chọn.
        </p>
        <Link href="/">
          <Button size="sm" className="gap-2">
            <Sparkles className="size-4" /> Bắt đầu từ Bước 1: Góp ý
          </Button>
        </Link>
      </PageWrapper>
    );
  }

  const tiLeKyTu =
    snapshot.summary.tongKyTuGoc > 0
      ? Math.round(
          (snapshot.summary.soKyTuThuLai / snapshot.summary.tongKyTuGoc) * 100,
        )
      : 0;

  const hasConflicts = snapshot.conflicts.length > 0;

  // Filtered work items for Tab 2
  const filteredWorkItems = snapshot.workItems.filter((w) => {
    if (workFilter === "all") return true;
    return w.kind === workFilter;
  });

  // Unprocessed cases for Tab 3
  const pendingCases = cases.filter((c) => !bang[c.id]?.type);
  const deferredCases = cases.filter((c) => bang[c.id]?.type === "hoan");
  const rejectedCases = cases.filter((c) => bang[c.id]?.type === "bo");

  return (
    <PageWrapper className="overflow-y-auto pb-24">
      <div className="mx-auto mt-6 w-full max-w-5xl space-y-6 px-4">
        {isServiceOffline && (
          <ServiceOfflineBanner onRetry={() => void mutateRun()} />
        )}

        {/* HEADER: TIÊU ĐỀ RÕ RÀNG */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs bg-muted font-mono">
                Bước 3 / 3
              </Badge>
              <Badge className="bg-primary text-primary-foreground text-xs">
                Sẵn sàng bàn giao sản xuất
              </Badge>
            </div>
            <h1 className="font-bold text-2xl dark:text-neutral-50 sm:text-3xl">
              Bản sửa v2 — chưa tạo video mới
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm max-w-2xl leading-relaxed">
              Gói bàn giao kỹ thuật cho phòng thu và đội dựng video. Hệ thống tự
              động hợp nhất toàn bộ quyết định duyệt, bảo đảm cấu trúc 40 câu và
              phân định trách nhiệm từng khâu.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/van-de?run=${activeRunId}` as any}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <ArrowLeft className="size-3.5" /> Duyệt lại phương án
              </Button>
            </Link>
          </div>
        </div>

        {/* THÔNG BÁO BẮT BUỘC: CHƯA TỰ DỰNG VIDEO */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground flex items-start gap-3">
          <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-primary">
              Thông báo quy trình sản xuất:
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Tính năng này hoàn tất công tác lập kế hoạch chỉnh sửa (Revision
              Planning). Video v2 sẽ được thu âm và dựng mới thủ công dựa trên 4
              tệp dữ liệu được xuất bên dưới.
            </p>
          </div>
        </div>

        {/* CẢNH BÁO STORAGE THẤT BẠI NẾU CÓ */}
        {isStorageFailed && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-800 text-xs dark:bg-amber-950/40 dark:text-amber-300">
            Lưu ý: Bộ nhớ localStorage bị chặn — các quyết định chỉ lưu tạm thời
            trong phiên duyệt này.
          </div>
        )}

        {/* KHỐI CẢNH BÁO XUNG ĐỘT (C3-ENG-03, C3-EXP-01) */}
        {hasConflicts && (
          <div className="rounded-lg border-2 border-red-500 bg-red-50 p-4 text-red-950 dark:bg-red-950/50 dark:text-red-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-red-700 dark:text-red-400">
              <AlertTriangle className="size-5 shrink-0" />
              <span>
                CẢNH BÁO: Có {snapshot.conflicts.length} xung đột ghi đè chưa
                được giải quyết!
              </span>
            </div>
            <p className="text-xs">
              Các phương án dưới đây cùng ghi đè lên một trường của cùng một
              câu. Cần quay lại Bước 2 để chọn lại trước khi xuất gói:
            </p>
            <div className="space-y-1.5 pt-1">
              {snapshot.conflicts.map((cf, i) => (
                <div
                  key={i}
                  className="rounded bg-background p-2.5 text-xs border border-red-200 dark:border-red-900 space-y-1"
                >
                  <p className="font-mono font-bold">
                    Câu {cf.n}, trường '{cf.field}':
                  </p>
                  <ul className="list-disc ml-4 space-y-0.5">
                    {cf.values.map((v, idx) => (
                      <li key={idx}>
                        Vùng <strong>{v.caseId}</strong> (Phương án {v.optionId}
                        ): "{v.value}"
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LỖI XUẤT NẾU CÓ */}
        {exportError && (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-red-800 text-xs dark:bg-red-950/40 dark:text-red-300">
            {exportError}
          </div>
        )}

        {/* THẺ TỔNG CÔNG VIỆC BẢN SỬA V2 */}
        <div className="grid gap-3 sm:grid-cols-4">
          <Card className="shadow-xs">
            <CardContent className="flex items-center gap-3 p-4">
              <Mic className="size-5 text-primary shrink-0" />
              <div>
                <p className="font-bold text-2xl">
                  {snapshot.summary.cauThuLai.length}
                </p>
                <p className="text-muted-foreground text-xs">
                  Câu thu lại giọng (gồm ±1)
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-xs">
            <CardContent className="flex items-center gap-3 p-4">
              <Clapperboard className="size-5 text-primary shrink-0" />
              <div>
                <p className="font-bold text-2xl">
                  {snapshot.summary.soKyTuThuLai}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    / {snapshot.summary.tongKyTuGoc}
                  </span>
                </p>
                <p className="text-muted-foreground text-xs">
                  Ký tự thu mới ({tiLeKyTu}%)
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-xs">
            <CardContent className="flex items-center gap-3 p-4">
              <Layers className="size-5 text-primary shrink-0" />
              <div>
                <p className="font-bold text-2xl">
                  {snapshot.summary.canhDungLai.length}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    / {snapshot.summary.tongCanh}
                  </span>
                </p>
                <p className="text-muted-foreground text-xs">
                  Cảnh cần cập nhật hình
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-xs">
            <CardContent className="flex items-center gap-3 p-4">
              <Subtitles className="size-5 text-primary shrink-0" />
              <div>
                <p className="font-bold text-2xl">
                  {snapshot.summary.phuDeSua.length}
                </p>
                <p className="text-muted-foreground text-xs">
                  Phụ đề cần chỉnh sửa
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* KHỐI XUẤT GÓI CHỈNH SỬA CHÍNH (NÚT CHÍNH + 4 TỆP) */}
        <Card className="border-2 border-primary/30 shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Download className="size-4 text-primary" />
                  Xuất gói chỉnh sửa v2
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tải về các tệp dữ liệu đã qua xử lý chuẩn định dạng cho đội
                  sản xuất
                </p>
              </div>

              {/* NÚT CHÍNH: XUẤT TRỌN BỘ GÓI CHỈNH SỬA */}
              <Button
                type="button"
                size="default"
                disabled={hasConflicts || downloading !== null}
                onClick={handleExportAll}
                className="gap-2 font-bold shadow-xs px-5"
              >
                <Download className="size-4" />
                {downloading === "all"
                  ? "Đang xuất trọn bộ..."
                  : "Xuất toàn bộ gói chỉnh sửa"}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                disabled={hasConflicts || downloading !== null}
                onClick={() => handleDownloadFile("kich-ban-v2.json")}
                className="justify-start gap-3 h-auto py-3 px-3 text-xs bg-card hover:bg-muted/40"
              >
                <FileCode className="size-5 text-primary shrink-0" />
                <div className="text-left">
                  <p className="font-semibold text-foreground">
                    kich-ban-v2.json
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    Kịch bản mới có lời thay thế, giữ nguyên cấu trúc 40 câu
                  </p>
                </div>
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={hasConflicts || downloading !== null}
                onClick={() => handleDownloadFile("kich-ban-v2.md")}
                className="justify-start gap-3 h-auto py-3 px-3 text-xs bg-card hover:bg-muted/40"
              >
                <FileText className="size-5 text-primary shrink-0" />
                <div className="text-left">
                  <p className="font-semibold text-foreground">
                    kich-ban-v2.md
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    Kịch bản Markdown định dạng chuẩn theo mẫu để in và đọc
                  </p>
                </div>
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={hasConflicts || downloading !== null}
                onClick={() => handleDownloadFile("viec-can-lam.csv")}
                className="justify-start gap-3 h-auto py-3 px-3 text-xs bg-card hover:bg-muted/40"
              >
                <FileSpreadsheet className="size-5 text-primary shrink-0" />
                <div className="text-left">
                  <p className="font-semibold text-foreground">
                    viec-can-lam.csv
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    Bảng phân công công việc: câu thu lại, ký tự, cảnh, phụ đề
                  </p>
                </div>
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={hasConflicts || downloading !== null}
                onClick={() => handleDownloadFile("truy-vet.json")}
                className="justify-start gap-3 h-auto py-3 px-3 text-xs bg-card hover:bg-muted/40"
              >
                <Download className="size-5 text-primary shrink-0" />
                <div className="text-left">
                  <p className="font-semibold text-foreground">truy-vet.json</p>
                  <p className="text-muted-foreground text-[11px]">
                    Báo cáo truy vết 100% từ quyết định duyệt tới mã góp ý gốc
                  </p>
                </div>
              </Button>
            </div>

            {hasConflicts && (
              <p className="text-xs text-red-600 dark:text-red-400 font-medium text-center">
                Vui lòng giải quyết các xung đột ghi đè trước khi tải gói xuất.
              </p>
            )}
          </CardContent>
        </Card>

        {/* 3 TAB NỘI DUNG CHÍNH: KỊCH BẢN, VIỆC CẦN LÀM, CHƯA XỬ LÝ */}
        <div className="space-y-3 pt-2">
          <Tabs defaultValue="kich-ban" className="w-full">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-2">
              <TabsList className="h-9">
                <TabsTrigger value="kich-ban" className="text-xs gap-1.5 px-3">
                  <FileText className="size-3.5" /> 1. Kịch bản trước / sau
                </TabsTrigger>
                <TabsTrigger
                  value="viec-can-lam"
                  className="text-xs gap-1.5 px-3"
                >
                  <Layers className="size-3.5" /> 2. Việc cần làm (
                  {snapshot.workItems.length})
                </TabsTrigger>
                <TabsTrigger
                  value="chua-xu-ly"
                  className="text-xs gap-1.5 px-3"
                >
                  <Clock className="size-3.5" /> 3. Chưa xử lý (
                  {deferredCases.length +
                    rejectedCases.length +
                    pendingCases.length}
                  )
                </TabsTrigger>
              </TabsList>
            </div>

            {/* TAB 1: KỊCH BẢN TRƯỚC / SAU */}
            <TabsContent value="kich-ban" className="pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  So sánh trực quan kịch bản v1 và bản sửa v2. Những chỗ thay
                  đổi được đánh dấu nổi bật.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOnlyChanged(!showOnlyChanged)}
                  className="text-xs h-7 gap-1.5"
                >
                  <Filter className="size-3" />
                  {showOnlyChanged
                    ? "Hiển thị toàn bộ 40 câu"
                    : "Chỉ hiện câu thay đổi"}
                </Button>
              </div>

              <div className="divide-y rounded-xl border bg-card text-xs overflow-hidden shadow-xs">
                {snapshot.draftSentences
                  .filter((draft) => {
                    if (!showOnlyChanged) return true;
                    const orig = script.cau.find((c) => c.n === draft.n);
                    if (!orig) return false;
                    return (
                      (draft.loi || "") !== (orig.loi || "") ||
                      (draft.chuTrenManHinh || "") !==
                        (orig.chuTrenManHinh || "") ||
                      (draft.yDoHinh || "") !== (orig.yDoHinh || "") ||
                      (draft.dungGiay || 0) !== (orig.dungGiay || 0)
                    );
                  })
                  .map((draft) => {
                    const orig = script.cau.find((c) => c.n === draft.n)!;
                    const isLoiChanged =
                      (draft.loi || "").trim() !== (orig.loi || "").trim();
                    const isChuChanged =
                      (draft.chuTrenManHinh || "").trim() !==
                      (orig.chuTrenManHinh || "").trim();
                    const isYDoChanged =
                      (draft.yDoHinh || "").trim() !==
                      (orig.yDoHinh || "").trim();
                    const isSilenceChanged =
                      (draft.dungGiay || 0) !== (orig.dungGiay || 0);

                    const isAnyChanged =
                      isLoiChanged ||
                      isChuChanged ||
                      isYDoChanged ||
                      isSilenceChanged;

                    return (
                      <div
                        key={draft.n}
                        className={`p-4 space-y-3 transition-colors ${
                          isAnyChanged ? "bg-muted/15" : "hover:bg-muted/5"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-foreground">
                              Câu {draft.n}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0 font-normal"
                            >
                              Phần {draft.phan}
                            </Badge>
                            {isAnyChanged ? (
                              <Badge className="bg-green-600 text-white text-[10px] py-0">
                                Có thay đổi
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-muted-foreground text-[10px] py-0"
                              >
                                Giữ nguyên
                              </Badge>
                            )}
                          </div>
                          <span className="text-muted-foreground font-mono text-xs">
                            {dinhDangPhut(orig.batDauGiay)} –{" "}
                            {dinhDangPhut(orig.ketThucGiay)}
                          </span>
                        </div>

                        {/* Thay đổi Lời đọc */}
                        {isLoiChanged ? (
                          <div className="space-y-1.5">
                            <span className="text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">
                              Lời đọc:
                            </span>
                            <div className="rounded-lg bg-red-50/70 dark:bg-red-950/40 p-2.5 border-l-3 border-red-500 text-red-950 dark:text-red-200 text-xs">
                              <strong>v1:</strong> {orig.loi}
                            </div>
                            <div className="rounded-lg bg-green-50/70 dark:bg-green-950/40 p-2.5 border-l-3 border-green-500 text-green-950 dark:text-green-200 text-xs font-medium">
                              <strong>v2:</strong> {draft.loi}
                            </div>
                          </div>
                        ) : (
                          orig.loi && (
                            <div className="text-muted-foreground text-xs">
                              <span className="font-medium text-foreground">
                                Lời đọc:{" "}
                              </span>
                              {orig.loi}
                            </div>
                          )
                        )}

                        {/* Khoảng lặng */}
                        {(draft.dungGiay || orig.dungGiay) && (
                          <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                            <Clock className="size-3.5" />
                            <span>
                              Khoảng lặng dừng:{" "}
                              {draft.dungGiay || orig.dungGiay} giây
                            </span>
                            {isSilenceChanged && (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-amber-700 ml-1"
                              >
                                (Đã chỉnh sửa khoảng lặng)
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Thay đổi Chữ màn hình */}
                        {isChuChanged ? (
                          <div className="space-y-1 text-xs">
                            <span className="font-medium text-muted-foreground">
                              Chữ trên màn hình:
                            </span>
                            <div className="rounded bg-red-50 dark:bg-red-950/30 p-2 border-l-2 border-red-500">
                              <strong>v1:</strong>{" "}
                              {orig.chuTrenManHinh || (
                                <span className="italic">Không có</span>
                              )}
                            </div>
                            <div className="rounded bg-green-50 dark:bg-green-950/30 p-2 border-l-2 border-green-500">
                              <strong>v2:</strong> {draft.chuTrenManHinh}
                            </div>
                          </div>
                        ) : (
                          orig.chuTrenManHinh && (
                            <div className="text-muted-foreground text-xs">
                              <span className="font-medium text-foreground">
                                Chữ màn hình:{" "}
                              </span>
                              {orig.chuTrenManHinh}
                            </div>
                          )
                        )}

                        {/* Thay đổi Ý đồ hình */}
                        {isYDoChanged ? (
                          <div className="space-y-1 text-xs">
                            <span className="font-medium text-muted-foreground">
                              Ý đồ hình:
                            </span>
                            <div className="rounded bg-red-50 dark:bg-red-950/30 p-2 border-l-2 border-red-500">
                              <strong>v1:</strong>{" "}
                              {orig.yDoHinh || (
                                <span className="italic">Không có</span>
                              )}
                            </div>
                            <div className="rounded bg-green-50 dark:bg-green-950/30 p-2 border-l-2 border-green-500">
                              <strong>v2:</strong> {draft.yDoHinh}
                            </div>
                          </div>
                        ) : (
                          orig.yDoHinh && (
                            <div className="text-muted-foreground text-xs">
                              <span className="font-medium text-foreground">
                                Ý đồ hình:{" "}
                              </span>
                              {orig.yDoHinh}
                            </div>
                          )
                        )}
                      </div>
                    );
                  })}
              </div>
            </TabsContent>

            {/* TAB 2: VIỆC CẦN LÀM (PHÂN LOẠI KHÂU & TRUY VẾT GỐC) */}
            <TabsContent value="viec-can-lam" className="pt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Phân công nhiệm vụ cụ thể cho từng khâu, có liên kết ngược về
                  quyết định và ý kiến người học:
                </p>

                {/* Filter khâu */}
                <div className="flex items-center gap-1 text-xs">
                  <Button
                    type="button"
                    variant={workFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setWorkFilter("all")}
                    className="h-7 text-xs px-2.5"
                  >
                    Tất cả ({snapshot.workItems.length})
                  </Button>
                  <Button
                    type="button"
                    variant={workFilter === "thu-lai" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setWorkFilter("thu-lai")}
                    className="h-7 text-xs px-2.5 gap-1"
                  >
                    <Mic className="size-3" /> Thu âm (
                    {snapshot.summary.cauThuLai.length})
                  </Button>
                  <Button
                    type="button"
                    variant={workFilter === "dung-canh" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setWorkFilter("dung-canh")}
                    className="h-7 text-xs px-2.5 gap-1"
                  >
                    <Clapperboard className="size-3" /> Dựng cảnh (
                    {snapshot.summary.canhDungLai.length})
                  </Button>
                  <Button
                    type="button"
                    variant={
                      workFilter === "sua-phu-de" ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => setWorkFilter("sua-phu-de")}
                    className="h-7 text-xs px-2.5 gap-1"
                  >
                    <Subtitles className="size-3" /> Phụ đề (
                    {snapshot.summary.phuDeSua.length})
                  </Button>
                </div>
              </div>

              <div className="divide-y rounded-xl border bg-card text-xs overflow-hidden shadow-xs">
                {filteredWorkItems.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Không có công việc nào thuộc khâu này.
                  </div>
                ) : (
                  filteredWorkItems.map((w, idx) => {
                    const origSentence = script.cau.find((c) => c.n === w.n);

                    return (
                      <div key={idx} className="p-4 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-foreground">
                              Câu {w.n}
                            </span>
                            <Badge
                              className={`text-[10px] font-medium ${
                                w.kind === "thu-lai"
                                  ? "bg-amber-600 text-white"
                                  : w.kind === "dung-canh"
                                    ? "bg-sky-600 text-white"
                                    : "bg-purple-600 text-white"
                              }`}
                            >
                              {w.kind === "thu-lai"
                                ? "Thu âm lại"
                                : w.kind === "dung-canh"
                                  ? "Dựng lại hình"
                                  : "Chỉnh phụ đề"}
                            </Badge>
                            {w.charCount != null && (
                              <span className="text-muted-foreground text-[11px]">
                                ({w.charCount} ký tự)
                              </span>
                            )}
                          </div>

                          {origSentence && (
                            <span className="text-muted-foreground font-mono text-[11px]">
                              {dinhDangPhut(origSentence.batDauGiay)} –{" "}
                              {dinhDangPhut(origSentence.ketThucGiay)}
                            </span>
                          )}
                        </div>

                        {/* Nội dung câu mới */}
                        {w.newContent && (
                          <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-foreground font-medium">
                            "{w.newContent}"
                          </div>
                        )}

                        {/* Lý do & Truy vết ngược */}
                        <div className="space-y-1 pt-1 text-[11px] text-muted-foreground">
                          <div>
                            <span className="font-semibold text-foreground">
                              Lý do phát sinh:{" "}
                            </span>
                            {w.reasons.map((r) => r.text).join("; ")}
                          </div>

                          {/* Liên kết ngược về Case & Feedback */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="font-semibold text-foreground">
                              Truy vết nguồn gốc:{" "}
                            </span>
                            {w.reasons.flatMap((r) => {
                              if (!r.caseId) return [];
                              const c = caseById.get(r.caseId);
                              const fids =
                                c?.issues.flatMap((iss) => iss.feedbackIds) ||
                                [];

                              return (
                                <div
                                  key={r.caseId}
                                  className="inline-flex items-center gap-1"
                                >
                                  <Badge
                                    variant="outline"
                                    className="font-mono text-[10px] bg-background"
                                  >
                                    Vùng {r.caseId}
                                  </Badge>
                                  {fids.length > 0 && (
                                    <span className="text-[10px] text-muted-foreground">
                                      (từ góp ý {fids.join(", ")})
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </TabsContent>

            {/* TAB 3: CHƯA XỬ LÝ (THEO DÕI BẢN SAU) */}
            <TabsContent value="chua-xu-ly" className="pt-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                Tổng hợp các vùng sửa được Hoãn, Giữ nguyên hoặc chưa quyết định
                kèm lý do để ghi nhận vào báo cáo và xử lý ở các phiên bản tiếp
                theo:
              </p>

              <div className="space-y-4">
                {/* 1. Danh sách hoãn */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-amber-600" />
                    <h3 className="font-semibold text-sm text-foreground">
                      Các vùng hoãn lại ({deferredCases.length})
                    </h3>
                  </div>
                  {deferredCases.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground text-xs">
                      Không có vùng nào bị hoãn.
                    </div>
                  ) : (
                    <div className="divide-y rounded-xl border bg-card text-xs overflow-hidden shadow-xs">
                      {deferredCases.map((c) => {
                        const dec = bang[c.id];
                        return (
                          <div key={c.id} className="p-3.5 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-foreground">
                                  {c.id}
                                </span>
                                <span className="font-semibold">{c.title}</span>
                              </div>
                              <Badge className="bg-amber-600 text-white text-[10px]">
                                Đã hoãn
                              </Badge>
                            </div>
                            <p className="text-muted-foreground text-[11px]">
                              Câu {c.sentenceNs.join(", ")} ·{" "}
                              {c.independentSenders} người độc lập
                            </p>
                            <div className="rounded bg-amber-50/70 dark:bg-amber-950/30 p-2 border border-amber-200 text-amber-900 dark:text-amber-200 text-[11px]">
                              <strong>Lý do hoãn:</strong>{" "}
                              {dec?.reason || "Không nêu lý do"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. Danh sách giữ nguyên bản gốc */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-neutral-600" />
                    <h3 className="font-semibold text-sm text-foreground">
                      Các vùng quyết định giữ nguyên ({rejectedCases.length})
                    </h3>
                  </div>
                  {rejectedCases.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground text-xs">
                      Không có vùng nào chọn giữ nguyên.
                    </div>
                  ) : (
                    <div className="divide-y rounded-xl border bg-card text-xs overflow-hidden shadow-xs">
                      {rejectedCases.map((c) => {
                        const dec = bang[c.id];
                        return (
                          <div key={c.id} className="p-3.5 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-foreground">
                                  {c.id}
                                </span>
                                <span className="font-semibold">{c.title}</span>
                              </div>
                              <Badge className="bg-neutral-600 text-white text-[10px]">
                                Giữ nguyên
                              </Badge>
                            </div>
                            <p className="text-muted-foreground text-[11px]">
                              Câu {c.sentenceNs.join(", ")} ·{" "}
                              {c.independentSenders} người độc lập
                            </p>
                            <div className="rounded bg-muted/50 p-2 text-muted-foreground text-[11px]">
                              <strong>Lý do giữ nguyên:</strong>{" "}
                              {dec?.reason || "Không nêu lý do"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Danh sách chưa duyệt */}
                {pendingCases.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="size-4 text-muted-foreground" />
                      <h3 className="font-semibold text-sm text-foreground">
                        Các vùng chưa có quyết định duyệt ({pendingCases.length}
                        )
                      </h3>
                    </div>
                    <div className="divide-y rounded-xl border bg-card text-xs overflow-hidden shadow-xs">
                      {pendingCases.map((c) => (
                        <div
                          key={c.id}
                          className="p-3 flex items-center justify-between"
                        >
                          <div>
                            <span className="font-mono font-bold text-foreground mr-2">
                              {c.id}
                            </span>
                            <span>{c.title}</span>
                          </div>
                          <Link
                            href={
                              `/van-de?run=${activeRunId}&case=${c.id}` as any
                            }
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-primary"
                            >
                              Duyệt ngay →
                            </Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </PageWrapper>
  );
}

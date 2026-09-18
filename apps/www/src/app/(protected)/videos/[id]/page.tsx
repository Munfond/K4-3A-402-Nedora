"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clapperboard,
  Clock,
  Download,
  FileCode,
  FileSpreadsheet,
  FileText,
  Film,
  History,
  Layers,
  MessageSquare,
  Mic,
  RotateCcw,
  Sparkles,
  Subtitles,
  Users,
  LayoutList,
  Network,
  Loader2,
  RefreshCw,
} from "lucide-react";

import PageWrapper from "@/components/page-wrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VideoPlayerSync from "@/components/studio/video-player-sync";
import KichBanChiTietTab from "@/components/studio/kich-ban-chi-tiet-tab";
import VideoFeedbackTab from "@/components/studio/video-feedback-tab";
import VideoVersionsTab from "@/components/studio/video-versions-tab";
import CaseListColumn from "@/components/studio/case-list-column";
import DecisionDossier from "@/components/studio/decision-dossier";
import V2PreparationColumn from "@/components/studio/v2-preparation-column";
import PipelineFlow from "@/components/studio/pipeline-flow";
import RevisionGraphView from "@/components/studio/revision-graph-view";
import { ServiceOfflineBanner } from "@/components/studio/service-offline-banner";
import {
  getLastRunId,
  setLastRunId,
  useQuyetDinh,
} from "@/hooks/use-quyet-dinh";
import { revisionClient, RevisionServiceError } from "@/lib/revision-client";
import { computeReleaseSnapshot } from "@/lib/revision/engine";
import { dinhDangPhut } from "@/lib/revision/format";
import type { StudioFeedback, StudioVideo } from "@/lib/studio/types";
import type {
  DecisionCase,
  NewFeedbackInput,
  RevisionOption,
  RevisionRunResult,
  RunMetadata,
} from "@/lib/revision/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface AnalyzeError {
  code: string;
  message: string;
  runId?: string;
}

export default function VideoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: videoId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryTab = searchParams.get("tab") || "xem-video";
  const normalizedInitialTab =
    queryTab === "kich-ban"
      ? "xem-video"
      : queryTab === "chinh-sua"
        ? "de-xuat"
        : queryTab === "ban-giao"
          ? "ban-sua"
          : queryTab;
  const queryRunId = searchParams.get("run");
  const queryCaseId = searchParams.get("case");
  const queryCau = searchParams.get("cau");

  const [activeTab, setActiveTab] = useState<string>(normalizedInitialTab);
  const [activeRunId, setActiveRunId] = useState<string>(queryRunId || "");
  const [selectedCaseId, setSelectedCaseId] = useState<string>(
    queryCaseId || "",
  );
  const [targetSentenceN, setTargetSentenceN] = useState<number | undefined>(
    queryCau ? parseInt(queryCau, 10) : undefined,
  );
  const [videoSeekTime, setVideoSeekTime] = useState<number | null>(null);
  const [feedbackPrefillSentenceN, setFeedbackPrefillSentenceN] = useState<
    number | null
  >(null);
  const [feedbackPrefillText, setFeedbackPrefillText] = useState<string>("");
  const [feedbackPrefillTime, setFeedbackPrefillTime] = useState<number | null>(
    null,
  );
  const [feedbackAutoOpen, setFeedbackAutoOpen] = useState<boolean>(false);
  const [feedbackSearchQuery, setFeedbackSearchQuery] = useState<string>("");

  useEffect(() => {
    if (queryCau) {
      setTargetSentenceN(parseInt(queryCau, 10));
    }
  }, [queryCau]);

  // Lấy dữ liệu video từ API studio
  const {
    data: videoData,
    isLoading: isVideoLoading,
    mutate: mutateVideo,
  } = useSWR<{
    video: StudioVideo;
  }>(`/api/studio/videos/${videoId}`, fetcher);

  const video = videoData?.video;
  const versionId = video?.currentVersion ?? "v1";
  const runScope = `${videoId}:${versionId}`;

  // Đồng bộ run ID — mỗi video nhớ run của riêng nó (C3-STO-03)
  useEffect(() => {
    if (queryRunId) {
      setActiveRunId(queryRunId);
    } else {
      setActiveRunId(getLastRunId(runScope));
    }
  }, [queryRunId, runScope]);

  // Lấy dữ liệu run qua revision-service (R2 & AR-06)
  const {
    data: runData,
    error: runFetchError,
    mutate: mutateRun,
  } = useSWR<{
    run: RunMetadata;
    result?: RevisionRunResult;
    error?: { code: string; message: string };
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

  // Run cũ (trước studio) không có videoId/versionId: đều là D1 v1.
  const runOwner = runData?.run
    ? `${runData.run.videoId ?? "d1"}:${runData.run.versionId ?? "v1"}`
    : null;
  const runBelongsToVideo = runOwner === null || runOwner === runScope;
  const runLoadError =
    runData?.error?.message ??
    (runFetchError ? String(runFetchError) : null) ??
    (!runBelongsToVideo ? `Run ${activeRunId} thuộc video khác` : null);

  // Xử lý khi tham số run trên URL không tồn tại (P0a - AP-09)
  const [urlRunNotFoundMessage, setUrlRunNotFoundMessage] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (
      queryRunId &&
      !isServiceOffline &&
      (runFetchError ||
        (runData && (runData.error || !runData.run || !runBelongsToVideo)))
    ) {
      setUrlRunNotFoundMessage(
        `Không tìm thấy đợt phân tích ${queryRunId}; đã mở trạng thái mới nhất của video`,
      );
      const fallbackRunId = getLastRunId(runScope);
      setActiveRunId(fallbackRunId !== queryRunId ? fallbackRunId : "");
      const url = new URL(window.location.href);
      url.searchParams.delete("run");
      window.history.replaceState(null, "", url.toString());
    }
  }, [
    queryRunId,
    runFetchError,
    runData,
    runBelongsToVideo,
    runScope,
    isServiceOffline,
  ]);

  const result = runBelongsToVideo ? runData?.result : undefined;
  const runMeta = runBelongsToVideo ? runData?.run : undefined;
  const isMockRun =
    runMeta?.mode === "gia-lap" || runMeta?.modelId?.startsWith("mock");
  const script = video?.script || result?.script;
  const [streamingCases, setStreamingCases] = useState<DecisionCase[] | null>(
    null,
  );
  const cases = useMemo(() => {
    if (result?.cases && result.cases.length > 0) return result.cases;
    if (streamingCases && streamingCases.length > 0) return streamingCases;
    return [];
  }, [result?.cases, streamingCases]);
  const allFeedback = useMemo(() => result?.feedback || [], [result]);

  const {
    bang,
    dat,
    xoa,
    isStorageFailed,
    isSavedToServer,
    hasConflict,
    serverSnapshot,
  } = useQuyetDinh(activeRunId, {
    scoped: true,
  });

  const [viewMode, setViewMode] = useState<"danh-sach" | "do-thi">("danh-sach");

  // Set initial selected case
  useEffect(() => {
    if (queryCaseId) {
      setSelectedCaseId(queryCaseId);
    } else if (cases.length > 0 && !selectedCaseId) {
      setSelectedCaseId(cases[0].id);
    }
  }, [queryCaseId, cases, selectedCaseId]);

  const selectedCase = useMemo(() => {
    return cases.find((c) => c.id === selectedCaseId) || cases[0];
  }, [cases, selectedCaseId]);

  // Gói bản sửa: lấy từ server khi quyết định đã lưu. Chỉ tự tính ở client khi
  // quyết định còn là bản nháp chưa lưu được, và khi đó hiện nhãn "xem trước".
  const isReleasePreview = !isSavedToServer || !serverSnapshot;
  const snapshot = useMemo(() => {
    if (!script || cases.length === 0) return null;
    if (!isReleasePreview && serverSnapshot) return serverSnapshot;
    return computeReleaseSnapshot({
      runId: activeRunId,
      inputHash: result?.inputHash || "video-v2",
      script,
      cases,
      decisions: bang,
    });
  }, [
    activeRunId,
    result,
    script,
    cases,
    bang,
    isReleasePreview,
    serverSnapshot,
  ]);

  // Phân tích góp ý
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisTimer, setAnalysisTimer] = useState(0);

  useEffect(() => {
    let t: NodeJS.Timeout;
    if (isAnalyzing) {
      t = setInterval(() => setAnalysisTimer((s) => s + 1), 1000);
    } else {
      setAnalysisTimer(0);
    }
    return () => clearInterval(t);
  }, [isAnalyzing]);

  const [analyzeError, setAnalyzeError] = useState<AnalyzeError | null>(null);

  const handleTriggerAnalyze = async (options?: { useCache?: boolean }) => {
    setIsAnalyzing(true);
    setStreamingCases(null);
    setAnalyzeError(null);
    try {
      const data = await revisionClient.startRun({
        videoId,
        versionId,
        ...(options?.useCache === false ? { useCache: false } : {}),
      });
      setLastRunId(data.runId, runScope);
      setActiveRunId(data.runId);
      setSelectedCaseId("");
      setActiveTab("de-xuat");
      router.replace(`/videos/${videoId}?tab=de-xuat&run=${data.runId}`);
    } catch (err: unknown) {
      if (err instanceof RevisionServiceError) {
        setAnalyzeError({
          code: err.code,
          message: err.message,
        });
      } else {
        setAnalyzeError({
          code: "NETWORK_ERROR",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", val);
    if (activeRunId) url.searchParams.set("run", activeRunId);
    if (val !== "kich-ban-chi-tiet") {
      url.searchParams.delete("cau");
    }
    window.history.replaceState(null, "", url.toString());
  };

  const handleViewDetailedScript = (sentenceN: number) => {
    setTargetSentenceN(sentenceN);
    setActiveTab("kich-ban-chi-tiet");
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "kich-ban-chi-tiet");
    url.searchParams.set("cau", String(sentenceN));
    if (activeRunId) url.searchParams.set("run", activeRunId);
    window.history.replaceState(null, "", url.toString());
  };

  const handleSelectCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    const url = new URL(window.location.href);
    url.searchParams.set("case", caseId);
    window.history.replaceState(null, "", url.toString());
  };

  // Góp ý nguồn thuần của video: không gắn vị trí suy luận của AI (P0a - C3)
  const rawSourceFeedbacks = useMemo<StudioFeedback[]>(() => {
    return video?.feedbacks ?? [];
  }, [video?.feedbacks]);

  // Góp ý của video: lấy từ server (đã làm sạch). Sau khi có run, góp ý nằm
  // trong vấn đề đã định vị được gắn "AI đề xuất vị trí" (C3-UI-03).
  const localFeedbacks = useMemo<StudioFeedback[]>(() => {
    const base = rawSourceFeedbacks;
    if (!result) return base;
    const aiLocation = new Map<string, number>();
    for (const issue of result.issues) {
      if (issue.location.status !== "da-dinh-vi") continue;
      const first = Math.min(...issue.location.sentenceNs);
      for (const fid of issue.feedbackIds) {
        if (!aiLocation.has(fid)) aiLocation.set(fid, first);
      }
    }
    const runLabels = new Map(result.feedback.map((f) => [f.id, f]));
    return base.map((f) => {
      const analysed = runLabels.get(f.id);
      const merged = analysed
        ? {
            ...f,
            label: analysed.label,
            isQuarantined: analysed.isQuarantined,
            quarantineReason: analysed.quarantineReason,
          }
        : f;
      const n = aiLocation.get(f.id);
      if (merged.locationSource !== "chua-xac-dinh" || n === undefined) {
        return merged;
      }
      return {
        ...merged,
        locationSource: "ai-de-xuat" as const,
        sentenceN: n,
        timeSeconds: script?.cau.find((c) => c.n === n)?.batDauGiay,
      };
    });
  }, [video?.feedbacks, result, script]);

  const handleAddNewFeedback = async (
    fb: NewFeedbackInput,
  ): Promise<string | null> => {
    try {
      await revisionClient.saveVideoFeedback(videoId, [fb], versionId);
      await mutateVideo();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  };

  // Decision actions for revision tab
  const handleSelectOption = (option: RevisionOption) => {
    if (!selectedCase) return;
    if (option.status === "khong-hop-le" || option.status === "ngoai-pham-vi")
      return;
    dat(selectedCase.id, {
      type: "chon",
      optionId: option.id,
      at: new Date().toISOString(),
    });
  };

  const handleDeferCase = (reason: string) => {
    if (!selectedCase) return;
    dat(selectedCase.id, {
      type: "hoan",
      reason,
      at: new Date().toISOString(),
    });
  };

  const handleRejectCase = (reason: string) => {
    if (!selectedCase) return;
    dat(selectedCase.id, {
      type: "bo",
      reason,
      at: new Date().toISOString(),
    });
  };

  const handleResetCase = () => {
    if (!selectedCase) return;
    xoa(selectedCase.id);
  };

  // Download handler for handover tab
  const [downloading, setDownloading] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleDownloadFile = async (fileType: string) => {
    if (!activeRunId) return;
    setDownloading(fileType);
    setExportError(null);

    try {
      const blob = await revisionClient.exportReleaseFile(
        activeRunId,
        fileType as any,
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

  const handleExportAll = async () => {
    const files = [
      "kich-ban-v2.json",
      "kich-ban-v2.md",
      "viec-can-lam.csv",
      "truy-vet.json",
    ];
    setDownloading("all");
    try {
      for (const f of files) {
        await handleDownloadFile(f);
        await new Promise((r) => setTimeout(r, 400));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(null);
    }
  };

  if (isVideoLoading) {
    return (
      <PageWrapper className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-2 text-muted-foreground text-sm">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Đang nạp video studio...</span>
        </div>
      </PageWrapper>
    );
  }

  if (!video) {
    return (
      <PageWrapper className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center space-y-4">
        <p className="text-muted-foreground">
          Không tìm thấy video có mã <code>{videoId}</code>.
        </p>
        <Link href="/">
          <Button size="sm" className="gap-2">
            <ArrowLeft className="size-4" /> Quay lại thư viện video
          </Button>
        </Link>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="flex flex-col min-h-[calc(100vh-64px)] pb-16">
      {/* HEADER BREADCRUMB & THÔNG TIN VIDEO */}
      <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-30 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link
                href="/"
                className="hover:text-foreground flex items-center gap-1"
              >
                <ArrowLeft className="size-3.5" /> Thư viện video
              </Link>
              <span>/</span>
              <span className="font-semibold text-foreground truncate max-w-xs sm:max-w-md">
                {video.title}
              </span>
            </div>

            <div className="flex items-center gap-2.5 pt-0.5">
              <h1 className="text-base sm:text-lg font-bold text-foreground truncate max-w-xl">
                {video.title}
              </h1>
              {video.isSample && (
                <Badge
                  variant="secondary"
                  className="bg-primary/10 text-primary border-primary/20 text-[10px] py-0"
                >
                  Dữ liệu mẫu
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] font-mono py-0">
                Phiên bản: {video.currentVersion}
              </Badge>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                · {dinhDangPhut(video.durationSeconds)} (
                {script ? `${script.cau.length} câu` : "Chưa có kịch bản"})
              </span>
            </div>
          </div>

          {/* TAB NAVIGATION CHÍNH: 5 TABS + LỊCH SỬ PHIÊN BẢN */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border text-xs overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => handleTabChange("xem-video")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all shrink-0 ${
                activeTab === "xem-video" || activeTab === "kich-ban"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Xem video
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("kich-ban-chi-tiet")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                activeTab === "kich-ban-chi-tiet"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Kịch bản chi tiết</span>
              <Badge
                variant="outline"
                className="text-[10px] px-1 py-0 font-mono"
              >
                {script ? `${script.cau.length} câu` : "40 câu"}
              </Badge>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("gop-y")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                activeTab === "gop-y"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Góp ý</span>
              <Badge
                variant="secondary"
                className="text-[10px] px-1 py-0 font-mono"
              >
                {localFeedbacks.length}
              </Badge>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("de-xuat")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                activeTab === "de-xuat" || activeTab === "chinh-sua"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="size-3 text-primary" />
              <span>Đề xuất chỉnh sửa</span>
              {cases.length > 0 && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1 py-0 font-mono"
                >
                  {cases.length} vùng
                </Badge>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("ban-sua")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all shrink-0 ${
                activeTab === "ban-sua" || activeTab === "ban-giao"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Bản sửa
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("phien-ban")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all shrink-0 ${
                activeTab === "phien-ban"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Lịch sử phiên bản
            </button>
          </div>
        </div>
      </div>

      {/* THÔNG BÁO MẤT KẾT NỐI REVISION SERVICE (AR-06) */}
      {(isServiceOffline || video?.feedbackError) && (
        <div className="max-w-7xl mx-auto w-full px-4 pt-2">
          <ServiceOfflineBanner
            serviceUrl={video?.feedbackError?.serviceUrl}
            error={video?.feedbackError}
            onRetry={() => {
              void mutateVideo();
              void mutateRun();
            }}
          />
        </div>
      )}

      {/* THÔNG BÁO RUN KHÔNG TỒN TẠI (P0a - AP-09) */}
      {urlRunNotFoundMessage && (
        <div className="max-w-7xl mx-auto w-full px-4 pt-2">
          <div className="rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-amber-600 shrink-0" />
              <span>{urlRunNotFoundMessage}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setUrlRunNotFoundMessage(null)}
              className="h-6 px-2 text-xs text-amber-700 hover:bg-amber-200/50"
            >
              Đóng
            </Button>
          </div>
        </div>
      )}

      {/* NỘI DUNG TỪNG TAB */}
      <div className="max-w-7xl mx-auto w-full p-4 flex-1 flex flex-col">
        {/* TAB 1: XEM VIDEO (KỊCH BẢN & TRÌNH PHÁT) */}
        {(activeTab === "xem-video" || activeTab === "kich-ban") && (
          <VideoPlayerSync
            videoUrl={video.videoUrl}
            title={video.title}
            durationSeconds={video.durationSeconds}
            script={script}
            initialSeekTime={videoSeekTime}
            onAddFeedbackAtTime={(sec, sentenceN) => {
              // Vị trí đi vào trường có cấu trúc, không chèn vào nội dung góp ý.
              setFeedbackPrefillSentenceN(sentenceN || null);
              setFeedbackPrefillTime(sec);
              setFeedbackPrefillText("");
              setFeedbackAutoOpen(true);
              handleTabChange("gop-y");
            }}
            onGoToRevision={() => handleTabChange("de-xuat")}
          />
        )}

        {/* TAB 2: KỊCH BẢN CHI TIẾT (29 NHÓM SLIDE, ẢNH TỪNG CÂU, DỮ LIỆU NGUỒN THUẦN - P0a) */}
        {activeTab === "kich-ban-chi-tiet" && (
          <KichBanChiTietTab
            video={video}
            script={script}
            feedbacks={rawSourceFeedbacks}
            activeRunId={activeRunId}
            onGoToRevision={() => handleTabChange("de-xuat")}
            highlightSentenceN={targetSentenceN}
            onPlaySentence={(batDauGiay) => {
              setVideoSeekTime(batDauGiay);
              handleTabChange("xem-video");
            }}
            onAddFeedbackAtSentence={(sentenceN, slideId) => {
              setFeedbackPrefillSentenceN(sentenceN);
              setFeedbackPrefillTime(null);
              setFeedbackPrefillText("");
              setFeedbackAutoOpen(true);
              handleTabChange("gop-y");
            }}
            onFilterFeedbackBySentence={(sentenceN) => {
              setFeedbackSearchQuery(`câu ${sentenceN}`);
              handleTabChange("gop-y");
            }}
          />
        )}

        {/* TAB 3: GÓP Ý THEO PHIÊN BẢN */}
        {activeTab === "gop-y" && (
          <VideoFeedbackTab
            video={video}
            feedbacks={localFeedbacks}
            onAddNewFeedback={handleAddNewFeedback}
            onRefreshFeedbacks={() => {
              void mutateVideo();
            }}
            onTriggerAnalyze={handleTriggerAnalyze}
            isAnalyzing={isAnalyzing}
            analysisTimer={analysisTimer}
            analyzeError={analyzeError}
            canAnalyze={Boolean(script)}
            initialTimeSeconds={feedbackPrefillTime}
            initialSearchQuery={feedbackSearchQuery}
            initialAddFormOpen={feedbackAutoOpen}
            initialSentenceN={feedbackPrefillSentenceN}
            initialText={feedbackPrefillText}
            onSeekToTime={(time) => {
              setVideoSeekTime(time);
              handleTabChange("xem-video");
            }}
          />
        )}

        {/* TAB 4: ĐỀ XUẤT CHỈNH SỬA (REVISION PLANNER 3 CỘT TRONG NGỮ CẢNH VIDEO) */}
        {(activeTab === "de-xuat" || activeTab === "chinh-sua") && (
          <div className="flex-1 flex flex-col min-h-[620px] space-y-4">
            {/* SƠ ĐỒ PIPELINE CỐ ĐỊNH KIỂU DIFY (R0.6 & AR-01) */}
            <PipelineFlow
              runId={activeRunId}
              runMeta={runMeta}
              isAnalyzing={isAnalyzing}
              onFinished={() => {
                mutateRun();
              }}
              onRetry={() => void handleTriggerAnalyze()}
              onPartialCases={(newCases) => {
                setStreamingCases(newCases);
              }}
              onCaseOptionsReady={({ caseId, options }) => {
                setStreamingCases((prev) =>
                  prev
                    ? prev.map((c) =>
                        c.id === caseId
                          ? { ...c, options, status: "xong" as const }
                          : c,
                      )
                    : prev,
                );
              }}
            />

            {!activeRunId ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed space-y-4 bg-muted/10">
                <Sparkles className="size-10 text-primary animate-bounce" />
                <div className="space-y-1">
                  <h3 className="font-bold text-base text-foreground">
                    Chưa có đợt phân tích nào cho phiên bản{" "}
                    {video?.currentVersion ?? versionId}
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-md">
                    Bấm nút bên dưới để AI đối chiếu {localFeedbacks.length} góp
                    ý với{" "}
                    {script
                      ? `${script.cau.length} câu kịch bản`
                      : "kịch bản (chưa có)"}{" "}
                    của video này và tạo các hồ sơ quyết định sửa.
                  </p>
                  {activeRunId && runLoadError && (
                    <p className="text-xs text-destructive">{runLoadError}</p>
                  )}
                </div>
                {analyzeError && <AnalyzeErrorBox error={analyzeError} />}
                <Button
                  onClick={() => void handleTriggerAnalyze()}
                  disabled={
                    isAnalyzing || localFeedbacks.length === 0 || !script
                  }
                  className="gap-2 font-bold shadow-xs"
                >
                  <Sparkles className="size-4" />
                  {isAnalyzing
                    ? `Đang phân tích (${analysisTimer}s)...`
                    : `Bắt đầu phân tích góp ý v1`}
                </Button>
              </div>
            ) : cases.length === 0 &&
              (runMeta?.status === "dang-chay" || isAnalyzing) ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed space-y-3 bg-muted/5">
                <Loader2 className="size-8 text-primary animate-spin" />
                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-foreground">
                    Đang phân tích và lập hồ sơ vùng...
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-md">
                    Các hồ sơ vùng sẽ xuất hiện ngay khi bước &quot;Lập hồ sơ
                    vùng&quot; hoàn tất.
                  </p>
                </div>
              </div>
            ) : cases.length === 0 && runMeta?.status === "da-huy" ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed space-y-3 bg-amber-50/10">
                <AlertCircle className="size-8 text-amber-500" />
                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-foreground">
                    Đợt phân tích đã bị hủy
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-md">
                    Tiến trình đã được dừng theo yêu cầu của bạn.
                  </p>
                </div>
                <Button
                  onClick={() => void handleTriggerAnalyze()}
                  disabled={isAnalyzing}
                  className="gap-2 font-bold shadow-xs"
                >
                  <RefreshCw className="size-4" />
                  Bắt đầu phân tích lại
                </Button>
              </div>
            ) : cases.length === 0 && runMeta?.status === "loi" ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed space-y-3 bg-rose-50/10">
                <AlertCircle className="size-8 text-rose-500" />
                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-foreground">
                    Đợt phân tích gặp sự cố
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-md">
                    Vui lòng bấm nút &quot;Thử lại&quot; ở thanh tiến trình bên
                    trên để thực hiện lại.
                  </p>
                </div>
                <Button
                  onClick={() => void handleTriggerAnalyze()}
                  disabled={isAnalyzing}
                  className="gap-2 font-bold shadow-xs"
                >
                  <RefreshCw className="size-4" />
                  Chạy lại phân tích
                </Button>
              </div>
            ) : cases.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed space-y-4 bg-muted/10">
                <Sparkles className="size-10 text-primary" />
                <div className="space-y-1">
                  <h3 className="font-bold text-base text-foreground">
                    Không có đề xuất chỉnh sửa nào trong đợt này
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-md">
                    Toàn bộ góp ý đã được xử lý hoặc không phát hiện vấn đề cần
                    chỉnh sửa kịch bản.
                  </p>
                </div>
                <Button
                  onClick={() => void handleTriggerAnalyze()}
                  disabled={isAnalyzing || localFeedbacks.length === 0}
                  className="gap-2 font-bold shadow-xs"
                >
                  <Sparkles className="size-4" />
                  Chạy lại phân tích
                </Button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <RunBanner
                    runId={activeRunId}
                    run={runMeta}
                    isMock={Boolean(isMockRun)}
                    findingCount={result?.validation.findings.length ?? 0}
                  />

                  {/* CÔNG TẮC CHẾ ĐỘ: [DANH SÁCH] | [ĐỒ THỊ] (SPEC SECTION 5.3) */}
                  <div className="flex items-center gap-1 bg-muted/70 p-1 rounded-lg border text-xs">
                    <button
                      type="button"
                      onClick={() => setViewMode("danh-sach")}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                        viewMode === "danh-sach"
                          ? "bg-background text-foreground shadow-2xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <LayoutList className="size-3.5" />
                      <span>Danh sách (3 cột)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("do-thi")}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                        viewMode === "do-thi"
                          ? "bg-background text-foreground shadow-2xs font-semibold text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Network className="size-3.5 text-primary" />
                      <span>Đồ thị</span>
                    </button>
                  </div>
                </div>

                {viewMode === "do-thi" ? (
                  <RevisionGraphView
                    cases={cases}
                    selectedCaseId={selectedCase?.id || cases[0]?.id || ""}
                    onSelectCase={handleSelectCase}
                    decisions={bang}
                    onSelectOption={handleSelectOption}
                    onDeferCase={handleDeferCase}
                    onRejectCase={handleRejectCase}
                    onResetCase={handleResetCase}
                    script={script}
                    feedbacks={localFeedbacks}
                    allFeedback={allFeedback}
                    snapshot={snapshot}
                    onViewDetailedScript={handleViewDetailedScript}
                    onPlaySentence={(batDauGiay) => {
                      setVideoSeekTime(batDauGiay);
                      handleTabChange("xem-video");
                    }}
                  />
                ) : (
                  <div className="flex-1 grid grid-cols-1 lg:grid-cols-[310px_minmax(0,1fr)_330px] xl:grid-cols-[340px_minmax(0,1fr)_360px] gap-3 h-full">
                    {/* CỘT 1 (TRÁI): DANH SÁCH VÙNG SỬA */}
                    <div className="h-full overflow-hidden">
                      <CaseListColumn
                        cases={cases}
                        selectedCaseId={selectedCase?.id || ""}
                        onSelectCase={handleSelectCase}
                        decisions={bang}
                      />
                    </div>

                    {/* CỘT 2 (GIỮA): HỒ SƠ QUYẾT ĐỊNH 4 PHẦN */}
                    <div className="h-full overflow-hidden">
                      {selectedCase && script ? (
                        <DecisionDossier
                          currentCase={selectedCase}
                          script={script}
                          allFeedback={allFeedback}
                          currentDecision={bang[selectedCase.id]}
                          allDecisions={bang}
                          allCases={cases}
                          runId={activeRunId}
                          onSelectOption={handleSelectOption}
                          onDefer={handleDeferCase}
                          onReject={handleRejectCase}
                          onReset={handleResetCase}
                          onViewDetailedScript={handleViewDetailedScript}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full border rounded-xl bg-card text-muted-foreground text-xs">
                          Chọn một vùng sửa để xem hồ sơ.
                        </div>
                      )}
                    </div>

                    {/* CỘT 3 (PHẢI): ĐANG CHUẨN BỊ BẢN SỬA V2 THỜI GIAN THỰC */}
                    <div className="h-full overflow-hidden">
                      {snapshot && script ? (
                        <V2PreparationColumn
                          snapshot={snapshot}
                          script={script}
                          runId={activeRunId}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full border rounded-xl bg-card text-muted-foreground text-xs">
                          Đang tính toán khối lượng v2...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB 5: BẢN SỬA V2 & BÀN GIAO */}
        {(activeTab === "ban-sua" || activeTab === "ban-giao") && (
          <div className="space-y-6">
            {!snapshot || !script ? (
              <div className="p-12 text-center rounded-2xl border border-dashed space-y-4 text-muted-foreground text-xs">
                Chưa có đợt chỉnh sửa nào được hoàn tất để tạo bản sửa v2. Vui
                lòng duyệt phương án tại tab "Đợt chỉnh sửa" trước.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header Bản sửa v2: Chưa có video mới */}
                <div className="border-b pb-4 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-primary text-primary-foreground text-xs">
                        Bản sửa dự kiến cho v2 · Chưa có video v2
                      </Badge>
                      <Badge variant="outline" className="font-mono text-xs">
                        {snapshot.appliedOptionIds.length} phương án áp dụng
                      </Badge>
                      {isReleasePreview ? (
                        <Badge
                          variant="outline"
                          className="text-xs border-amber-500/50 text-amber-700 dark:text-amber-300"
                        >
                          Xem trước · quyết định chưa lưu lên server
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Đã lưu trên server
                        </Badge>
                      )}
                      {hasConflict && (
                        <Badge variant="destructive" className="text-xs">
                          Quyết định vừa được sửa ở nơi khác, đã tải lại
                        </Badge>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-foreground mt-1">
                      Gói bàn giao sản xuất phiên bản mới
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Tài liệu kỹ thuật sẵn sàng bàn giao cho phòng thu âm và
                      đội dựng. Video v2 sẽ được sản xuất theo tài liệu này.
                    </p>
                  </div>

                  <Button
                    onClick={handleExportAll}
                    disabled={
                      snapshot.conflicts.length > 0 || downloading !== null
                    }
                    className="gap-2 font-bold shadow-xs"
                  >
                    <Download className="size-4" />
                    {downloading === "all"
                      ? "Đang xuất toàn bộ..."
                      : "Xuất toàn bộ gói chỉnh sửa"}
                  </Button>
                </div>

                {/* 4 THỐNG KÊ KHỐI LƯỢNG */}
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="p-3.5 rounded-xl border bg-card flex items-center gap-3">
                    <Mic className="size-5 text-primary" />
                    <div>
                      <p className="font-bold text-xl">
                        {snapshot.summary.cauThuLai.length}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Câu cần thu âm lại
                      </p>
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl border bg-card flex items-center gap-3">
                    <Clapperboard className="size-5 text-primary" />
                    <div>
                      <p className="font-bold text-xl">
                        {snapshot.summary.soKyTuThuLai}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Ký tự thu mới
                      </p>
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl border bg-card flex items-center gap-3">
                    <Layers className="size-5 text-primary" />
                    <div>
                      <p className="font-bold text-xl">
                        {snapshot.summary.canhDungLai.length}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Cảnh dựng lại
                      </p>
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl border bg-card flex items-center gap-3">
                    <Subtitles className="size-5 text-primary" />
                    <div>
                      <p className="font-bold text-xl">
                        {snapshot.summary.phuDeSua.length}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Phụ đề cần sửa
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4 NÚT TẢI FILE BÀN GIAO */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    onClick={() => handleDownloadFile("kich-ban-v2.json")}
                    className="justify-start gap-3 h-auto py-3 px-3 text-xs bg-card"
                  >
                    <FileCode className="size-5 text-primary shrink-0" />
                    <div className="text-left">
                      <p className="font-semibold text-foreground">
                        kich-ban-v2.json
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        Kịch bản mới có lời thay thế, giữ cấu trúc 40 câu
                      </p>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => handleDownloadFile("kich-ban-v2.md")}
                    className="justify-start gap-3 h-auto py-3 px-3 text-xs bg-card"
                  >
                    <FileText className="size-5 text-primary shrink-0" />
                    <div className="text-left">
                      <p className="font-semibold text-foreground">
                        kich-ban-v2.md
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        Kịch bản Markdown in ấn cho phòng thu
                      </p>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => handleDownloadFile("viec-can-lam.csv")}
                    className="justify-start gap-3 h-auto py-3 px-3 text-xs bg-card"
                  >
                    <FileSpreadsheet className="size-5 text-primary shrink-0" />
                    <div className="text-left">
                      <p className="font-semibold text-foreground">
                        viec-can-lam.csv
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        Bảng phân công nhiệm vụ thu âm, dựng hình, phụ đề
                      </p>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => handleDownloadFile("truy-vet.json")}
                    className="justify-start gap-3 h-auto py-3 px-3 text-xs bg-card"
                  >
                    <Download className="size-5 text-primary shrink-0" />
                    <div className="text-left">
                      <p className="font-semibold text-foreground">
                        truy-vet.json
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        Báo cáo truy vết 100% từ quyết định tới góp ý gốc
                      </p>
                    </div>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: LỊCH SỬ PHIÊN BẢN */}
        {activeTab === "phien-ban" && (
          <VideoVersionsTab
            video={video}
            onGoToRevision={() => handleTabChange("de-xuat")}
          />
        )}
      </div>
    </PageWrapper>
  );
}

function AnalyzeErrorBox({ error }: { error: AnalyzeError }) {
  return (
    <div
      role="alert"
      className="max-w-lg w-full rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-left text-xs space-y-1"
    >
      <p className="font-semibold text-destructive flex items-center gap-1.5">
        <AlertCircle className="size-3.5" /> Phân tích thất bại · {error.code}
      </p>
      <p className="text-foreground break-words">{error.message}</p>
      {error.runId && (
        <p className="text-muted-foreground font-mono">runId: {error.runId}</p>
      )}
    </div>
  );
}

function RunBanner({
  runId,
  run,
  isMock,
  findingCount,
}: {
  runId: string;
  run?: RunMetadata;
  isMock: boolean;
  findingCount: number;
}) {
  const failedChecks = run?.checks
    ? Object.entries(run.checks).filter(([, ok]) => !ok).length
    : 0;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs">
      <Badge variant="outline" className="font-mono">
        {runId}
      </Badge>
      {run && <span className="text-muted-foreground">{run.modelId}</span>}
      {run && (
        <span className="text-muted-foreground">
          {new Date(run.createdAt).toLocaleString("vi-VN")}
        </span>
      )}
      <Badge variant="secondary" className="gap-1">
        <AlertCircle className="size-3" /> Kết quả AI, chưa được duyệt
      </Badge>
      {isMock && (
        <Badge className="bg-amber-100 text-amber-800 border border-amber-300">
          Kết quả giả lập
        </Badge>
      )}
      <span className="text-muted-foreground flex items-center gap-1">
        {failedChecks === 0 ? (
          <CheckCircle2 className="size-3.5 text-green-600" />
        ) : (
          <AlertCircle className="size-3.5 text-amber-600" />
        )}
        {failedChecks === 0
          ? "Kiểm tra bằng code: đạt"
          : `${failedChecks} nhóm kiểm tra không đạt`}
        {findingCount > 0 && ` · ${findingCount} ghi nhận`}
      </span>
    </div>
  );
}

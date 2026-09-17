"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Filter,
  HelpCircle,
  MapPin,
  MessageSquare,
  MessageSquarePlus,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Upload,
  Users,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { dinhDangPhut } from "@/lib/revision/format";
import type { NewFeedbackInput } from "@/lib/revision/types";
import { parseSurveyCsv, type CsvParseResult } from "@/lib/studio/csv-import";
import { revisionClient } from "@/lib/revision-client";
import type {
  LocationSource,
  StudioFeedback,
  StudioVideo,
} from "@/lib/studio/types";

type StatusFilter = "all" | "co-nhan-xet" | "chi-cham-diem" | "bi-loai";

function feedbackStatus(f: StudioFeedback): Exclude<StatusFilter, "all"> {
  if (f.isQuarantined) return "bi-loai";
  if (f.label === "chi-cham-diem") return "chi-cham-diem";
  return "co-nhan-xet";
}

interface VideoFeedbackTabProps {
  video: StudioVideo;
  feedbacks: StudioFeedback[];
  onSeekToTime?: (timeSeconds: number) => void;
  /** Trả về thông báo lỗi, hoặc null khi server đã lưu. */
  onAddNewFeedback: (fb: NewFeedbackInput) => Promise<string | null>;
  onRefreshFeedbacks?: () => Promise<void> | void;
  /** useCache: false gọi model cho mọi node, không dùng lại kết quả cũ. */
  onTriggerAnalyze: (options?: { useCache?: boolean }) => void;
  isAnalyzing: boolean;
  analysisTimer: number;
  analyzeError?: { code: string; message: string; runId?: string } | null;
  canAnalyze?: boolean;
  initialTimeSeconds?: number | null;
  initialSearchQuery?: string;
  initialAddFormOpen?: boolean;
  initialSentenceN?: number | null;
  initialText?: string;
}

export default function VideoFeedbackTab({
  video,
  feedbacks,
  onSeekToTime,
  onAddNewFeedback,
  onRefreshFeedbacks,
  onTriggerAnalyze,
  isAnalyzing,
  analysisTimer,
  analyzeError,
  canAnalyze = true,
  initialTimeSeconds,
  initialSearchQuery,
  initialAddFormOpen,
  initialSentenceN,
  initialText,
}: VideoFeedbackTabProps) {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || "");
  const [locationFilter, setLocationFilter] = useState<"all" | LocationSource>(
    "all",
  );
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form thêm góp ý
  const [showAddForm, setShowAddForm] = useState(!!initialAddFormOpen);
  const [newText, setNewText] = useState(initialText || "");
  const [newSender, setNewSender] = useState("");
  const [newChannel, setNewChannel] = useState<
    "binh-luan" | "tin-nhan" | "khao-sat"
  >("binh-luan");
  const [newSentenceN, setNewSentenceN] = useState<string>(
    initialSentenceN != null ? String(initialSentenceN) : "",
  );
  const [newTimeSeconds, setNewTimeSeconds] = useState<string>("");
  const [newDeHieu, setNewDeHieu] = useState<number | undefined>();
  const [newNhipDo, setNewNhipDo] = useState<number | undefined>();

  // Tải lên CSV khảo sát/bình luận
  const [showCsvPanel, setShowCsvPanel] = useState(false);
  const [csvResult, setCsvResult] = useState<CsvParseResult | null>(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [rawCsvText, setRawCsvText] = useState<string>("");
  const [duplicateCount, setDuplicateCount] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCsvFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        setCsvError("Chỉ hỗ trợ file .csv");
        return;
      }
      setCsvError(null);
      setCsvFileName(file.name);
      try {
        const text = await file.text();
        setRawCsvText(text);

        // Gọi dryRun trên server để xem trước, kiểm tra nạp trùng và làm sạch PII
        const data = await revisionClient.importVideoFeedback(
          video.id,
          text,
          true,
          video.currentVersion,
        );

        if (!data || data.error) {
          setCsvError(data?.error?.message ?? "Không thể phân tích file CSV");
          setCsvResult(null);
          return;
        }

        setDuplicateCount(data.duplicateCount || 0);
        setCsvResult({
          rows: data.preview,
          format: data.format,
          totalRows: data.totalRows,
          warnings: data.warnings,
        });
      } catch (err: unknown) {
        setCsvError(
          err instanceof Error ? err.message : "Không thể đọc file CSV",
        );
        setCsvResult(null);
      }
    },
    [video.id, video.currentVersion],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleCsvFile(file);
    },
    [handleCsvFile],
  );

  const handleResetCsv = () => {
    setCsvResult(null);
    setCsvFileName("");
    setCsvError(null);
    setRawCsvText("");
    setDuplicateCount(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleConfirmCsvImport = async () => {
    if (!rawCsvText) return;
    setIsImporting(true);
    setCsvError(null);
    try {
      // Lưu toàn bộ qua server trong một request duy nhất
      const data = await revisionClient.importVideoFeedback(
        video.id,
        rawCsvText,
        false,
        video.currentVersion,
      );

      if (!data || data.error) {
        setCsvError(data?.error?.message ?? "Không thể lưu góp ý từ file CSV");
        return;
      }

      handleResetCsv();
      setShowCsvPanel(false);
      await onRefreshFeedbacks?.();
    } catch (err: unknown) {
      setCsvError(err instanceof Error ? err.message : "Lỗi khi lưu góp ý");
    } finally {
      setIsImporting(false);
    }
  };

  // Synchronize when initial props change
  useEffect(() => {
    if (initialSearchQuery !== undefined) {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  useEffect(() => {
    if (initialAddFormOpen) {
      setShowAddForm(true);
    }
    if (initialSentenceN != null) {
      setNewSentenceN(String(initialSentenceN));
    }
    if (initialText) {
      setNewText(initialText);
    }
    if (initialTimeSeconds != null) {
      setNewTimeSeconds(String(Math.floor(initialTimeSeconds)));
    }
  }, [initialAddFormOpen, initialSentenceN, initialText, initialTimeSeconds]);

  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter((f) => {
      if (locationFilter !== "all" && f.locationSource !== locationFilter)
        return false;
      if (channelFilter !== "all" && f.channel !== channelFilter) return false;
      if (statusFilter !== "all" && feedbackStatus(f) !== statusFilter)
        return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchText = (f.sanitizedText || "").toLowerCase().includes(q);
        const matchSender = (f.sender || "").toLowerCase().includes(q);
        const matchId = f.id.toLowerCase().includes(q);
        if (!matchText && !matchSender && !matchId) return false;
      }

      return true;
    });
  }, [feedbacks, locationFilter, channelFilter, statusFilter, searchQuery]);

  const counts = useMemo(() => {
    let nguoiChon = 0;
    let aiDeXuat = 0;
    let chuaXacDinh = 0;

    for (const f of feedbacks) {
      if (f.locationSource === "nguoi-chon") nguoiChon++;
      else if (f.locationSource === "ai-de-xuat") aiDeXuat++;
      else chuaXacDinh++;
    }

    const byStatus = { "co-nhan-xet": 0, "chi-cham-diem": 0, "bi-loai": 0 };
    for (const f of feedbacks) byStatus[feedbackStatus(f)]++;
    return {
      total: feedbacks.length,
      senders: new Set(feedbacks.map((f) => f.sender)).size,
      nguoiChon,
      aiDeXuat,
      chuaXacDinh,
      ...byStatus,
    };
  }, [feedbacks]);

  const hasScore = newDeHieu !== undefined || newNhipDo !== undefined;
  const canSubmit =
    newText.trim().length > 0 || (newChannel === "khao-sat" && hasScore);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || isSaving) return;

    const sentenceN = newSentenceN.trim()
      ? parseInt(newSentenceN, 10)
      : undefined;
    const timeSeconds = newTimeSeconds.trim()
      ? parseInt(newTimeSeconds, 10)
      : undefined;

    setIsSaving(true);
    setSaveError(null);
    // Nhãn, cách ly và mã người gửi ẩn danh do server gán sau khi làm sạch.
    const error = await onAddNewFeedback({
      text: newText.trim(),
      channel: newChannel,
      sender: newSender.trim() || undefined,
      location:
        sentenceN != null || timeSeconds != null
          ? { sentenceN, timeSeconds }
          : undefined,
      survey:
        newChannel === "khao-sat" && hasScore
          ? { deHieu: newDeHieu, nhipDo: newNhipDo }
          : undefined,
    });
    setIsSaving(false);

    if (error) {
      // Giữ nguyên nội dung đang nhập để người dùng sửa lại.
      setSaveError(error);
      return;
    }

    setNewText("");
    setNewSender("");
    setNewSentenceN("");
    setNewTimeSeconds("");
    setNewDeHieu(undefined);
    setNewNhipDo(undefined);
    setShowAddForm(false);
  };

  return (
    <div className="space-y-4">
      {/* HEADER TỔNG QUAN & NÚT PHÂN TÍCH */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border bg-card shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs bg-muted">
              Phiên bản: {video.currentVersion}
            </Badge>
            <span className="font-bold text-sm text-foreground">
              {counts.total} góp ý từ {counts.senders} người
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Phản hồi gắn chặt với phiên bản nguồn {video.currentVersion}, tránh
            đem góp ý của v1 áp nhầm vào các bản sau.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setShowAddForm(!showAddForm);
              setShowCsvPanel(false);
            }}
            className="text-xs gap-1.5 h-8"
          >
            <MessageSquarePlus className="size-3.5" />
            {showAddForm ? "Đóng form" : "Thêm thủ công"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canAnalyze}
            title={
              canAnalyze
                ? undefined
                : "Video chưa có kịch bản và timecode nên chưa nhận góp ý"
            }
            onClick={() => {
              if (!showCsvPanel) handleResetCsv();
              setShowCsvPanel(!showCsvPanel);
              setShowAddForm(false);
            }}
            className="text-xs gap-1.5 h-8"
          >
            <FileSpreadsheet className="size-3.5" />
            {showCsvPanel ? "Đóng CSV" : "Tải lên file CSV"}
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={isAnalyzing || feedbacks.length === 0 || !canAnalyze}
            title={
              canAnalyze
                ? undefined
                : "Video chưa có kịch bản và timecode nên chưa phân tích được"
            }
            onClick={() => onTriggerAnalyze()}
            className="text-xs gap-1.5 h-8 font-semibold shadow-xs"
          >
            <Sparkles className="size-3.5" />
            {isAnalyzing
              ? `Đang phân tích (${analysisTimer}s)...`
              : `Phân tích góp ý cho ${video.currentVersion}`}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isAnalyzing || feedbacks.length === 0 || !canAnalyze}
            title="Gọi model cho mọi bước, không dùng lại kết quả của lần phân tích trước"
            onClick={() => {
              if (
                window.confirm(
                  "Phân tích lại từ đầu sẽ gọi model cho mọi bước (khoảng 1–3 phút và tốn token). Tiếp tục?",
                )
              ) {
                onTriggerAnalyze({ useCache: false });
              }
            }}
            className="text-xs gap-1.5 h-8"
          >
            <RotateCcw className="size-3.5" />
            Phân tích lại từ đầu
          </Button>
        </div>
      </div>

      {analyzeError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs space-y-1"
        >
          <p className="font-semibold text-destructive flex items-center gap-1.5">
            <AlertCircle className="size-3.5" /> Phân tích thất bại ·{" "}
            {analyzeError.code}
          </p>
          <p className="break-words">{analyzeError.message}</p>
          {analyzeError.runId && (
            <p className="font-mono text-muted-foreground">
              runId: {analyzeError.runId}
            </p>
          )}
        </div>
      )}

      {/* FORM THÊM GÓP Ý THỦ CÔNG */}
      {showAddForm && (
        <Card className="border-2 border-primary/20 shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/10">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <MessageSquarePlus className="size-4 text-primary" />
              Thêm góp ý / phản hồi cho phiên bản {video.currentVersion}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <form onSubmit={handleAddSubmit} className="space-y-3 text-xs">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">
                    Kênh tiếp nhận
                  </label>
                  <select
                    value={newChannel}
                    onChange={(e) => setNewChannel(e.target.value as any)}
                    className="w-full h-8 rounded-md border bg-background px-2.5 text-xs"
                  >
                    <option value="binh-luan">Bình luận bài học</option>
                    <option value="tin-nhan">Tin nhắn hỗ trợ</option>
                    <option value="khao-sat">Khảo sát cuối video</option>
                  </select>
                </div>

                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">
                    Người gửi
                  </label>
                  <Input
                    placeholder="hv-102 hoặc Nguyễn Văn A..."
                    value={newSender}
                    onChange={(e) => setNewSender(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-muted-foreground mb-1 font-medium">
                      Câu số (nếu có)
                    </label>
                    <Input
                      type="number"
                      placeholder="Ví dụ: 12"
                      value={newSentenceN}
                      onChange={(e) => setNewSentenceN(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground mb-1 font-medium">
                      Giây (nếu có)
                    </label>
                    <Input
                      type="number"
                      placeholder="Ví dụ: 85"
                      value={newTimeSeconds}
                      onChange={(e) => setNewTimeSeconds(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-medium">
                  Nội dung góp ý{" "}
                  {newChannel === "khao-sat"
                    ? "(tùy chọn nếu đã chấm điểm)"
                    : "*"}
                </label>
                <Textarea
                  placeholder="Nhập nội dung phàn nàn, nhận xét hoặc đề xuất..."
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  rows={3}
                  className="text-xs"
                />
              </div>

              {newChannel === "khao-sat" && (
                <div className="flex gap-4 p-2.5 rounded-lg border bg-muted/20">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      Điểm dễ hiểu (1–5):
                    </span>
                    <select
                      value={newDeHieu ?? ""}
                      onChange={(e) =>
                        setNewDeHieu(
                          e.target.value ? Number(e.target.value) : undefined,
                        )
                      }
                      className="h-7 rounded border bg-background px-2 text-xs"
                    >
                      <option value="">Không chấm</option>
                      {[1, 2, 3, 4, 5].map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      Điểm nhịp độ (1–5):
                    </span>
                    <select
                      value={newNhipDo ?? ""}
                      onChange={(e) =>
                        setNewNhipDo(
                          e.target.value ? Number(e.target.value) : undefined,
                        )
                      }
                      className="h-7 rounded border bg-background px-2 text-xs"
                    >
                      <option value="">Không chấm</option>
                      {[1, 2, 3, 4, 5].map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {saveError && (
                <p role="alert" className="text-destructive text-xs">
                  {saveError}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddForm(false)}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!canSubmit || isSaving}
                >
                  {isSaving ? "Đang lưu..." : "Lưu phản hồi"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* PANEL UPLOAD CSV */}
      {showCsvPanel && (
        <Card className="border-2 border-primary/20 shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/10">
            <CardTitle className="text-sm font-bold flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <FileSpreadsheet className="size-4 text-primary" />
                Tải lên file khảo sát CSV
              </span>
              {csvResult && (
                <button
                  type="button"
                  onClick={handleResetCsv}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {/* Hướng dẫn format */}
            <div className="rounded-lg border bg-muted/30 p-3 text-[11px] text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground text-xs">
                Định dạng CSV được hỗ trợ:
              </p>
              <p>
                • <strong>Khảo sát:</strong>{" "}
                <code className="bg-muted px-1 rounded">
                  ma_gop_y, nguoi_gui, de_hieu_1_5, nhip_do_1_5, y_kien_them
                </code>
              </p>
              <p>
                • <strong>Bình luận:</strong>{" "}
                <code className="bg-muted px-1 rounded">
                  id, nguoi_gui, noi_dung
                </code>{" "}
                (hoặc text, comment)
              </p>
              <p>
                Hệ thống tự nhận biết định dạng từ tên cột trong hàng đầu tiên.
              </p>
            </div>

            {/* Khu drag-and-drop */}
            {!csvResult && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors ${
                  isDragOver
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"
                }`}
              >
                <Upload
                  className={`size-8 ${isDragOver ? "text-primary" : "text-muted-foreground/50"}`}
                />
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">
                    {isDragOver
                      ? "Thả file vào đây"
                      : "Kéo thả file .csv vào đây"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    hoặc bấm để chọn file từ máy tính
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCsvFile(f);
                  }}
                />
              </div>
            )}

            {/* Lỗi đọc file */}
            {csvError && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-red-300 bg-red-50 text-red-700 text-xs dark:bg-red-950/40 dark:text-red-300">
                <AlertCircle className="size-4 shrink-0" />
                {csvError}
              </div>
            )}

            {/* Preview kết quả parse */}
            {csvResult && (
              <div className="space-y-3">
                {/* Tóm tắt */}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted border font-mono">
                    <FileSpreadsheet className="size-3" />
                    {csvFileName}
                  </span>
                  <Badge className="bg-green-50 text-green-700 border-green-200 border text-[11px] dark:bg-green-950 dark:text-green-300">
                    {csvResult.rows.length} dòng hợp lệ
                  </Badge>
                  {duplicateCount > 0 && (
                    <Badge className="bg-blue-50 text-blue-700 border-blue-200 border text-[11px] dark:bg-blue-950 dark:text-blue-300">
                      ℹ {duplicateCount} dòng đã có (bỏ qua)
                    </Badge>
                  )}
                  {csvResult.warnings.length > 0 && (
                    <Badge className="bg-amber-50 text-amber-700 border-amber-200 border text-[11px] dark:bg-amber-950 dark:text-amber-300">
                      ⚠ {csvResult.warnings.length} dòng cảnh báo
                    </Badge>
                  )}
                  <span className="text-muted-foreground">
                    Định dạng nhận diện:{" "}
                    <strong>
                      {csvResult.format === "khao-sat"
                        ? "Khảo sát"
                        : csvResult.format === "binh-luan"
                          ? "Bình luận"
                          : "Tự động"}
                    </strong>
                  </span>
                </div>

                {/* Cảnh báo dòng bị bỏ qua */}
                {csvResult.warnings.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-2.5 space-y-1 dark:bg-amber-950/20">
                    {csvResult.warnings.map((w) => (
                      <p
                        key={w.row}
                        className="text-[11px] text-amber-700 dark:text-amber-300"
                      >
                        <strong>Dòng {w.row}:</strong> {w.message}
                      </p>
                    ))}
                  </div>
                )}

                {/* Bảng preview */}
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-[11px]">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                          #
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                          Người gửi
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                          Nội dung góp ý
                        </th>
                        <th className="px-3 py-2 text-center font-semibold text-muted-foreground">
                          dễ hiểu
                        </th>
                        <th className="px-3 py-2 text-center font-semibold text-muted-foreground">
                          nhịp độ
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {csvResult.rows.slice(0, 10).map((fb, i) => (
                        <tr
                          key={`${fb.rowKey}-${i}`}
                          className="hover:bg-muted/20"
                        >
                          <td className="px-3 py-2 text-muted-foreground font-mono">
                            {i + 1}
                          </td>
                          <td className="px-3 py-2 font-mono">{fb.sender}</td>
                          <td className="px-3 py-2 max-w-xs">
                            <span className="line-clamp-2 text-foreground">
                              {fb.text || (
                                <span className="italic text-muted-foreground">
                                  (chỉ có điểm số)
                                </span>
                              )}
                            </span>
                            {"isQuarantined" in fb && fb.isQuarantined ? (
                              <span className="mt-1 block text-[10px] font-medium text-amber-700 dark:text-amber-300">
                                Giữ lại, không phân tích:{" "}
                                {"quarantineReason" in fb
                                  ? String(fb.quarantineReason)
                                  : "cần kiểm tra"}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {fb.survey?.deHieu != null ? (
                              <span className="font-bold text-amber-600">
                                {fb.survey.deHieu}/5
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {fb.survey?.nhipDo != null ? (
                              <span className="font-bold text-sky-600">
                                {fb.survey.nhipDo}/5
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvResult.rows.length > 10 && (
                    <div className="px-3 py-2 text-center text-[11px] text-muted-foreground border-t bg-muted/20">
                      ... và {csvResult.rows.length - 10} dòng nữa
                    </div>
                  )}
                </div>

                {/* Nút xác nhận */}
                <div className="flex items-center justify-between pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetCsv}
                    className="text-xs gap-1.5"
                  >
                    <X className="size-3.5" /> Chọn file khác
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleConfirmCsvImport}
                    disabled={csvResult.rows.length === 0 || isImporting}
                    className="text-xs gap-1.5 font-semibold"
                  >
                    <CheckCircle2 className="size-3.5" />
                    {isImporting
                      ? "Đang lưu..."
                      : `Lưu ${csvResult.rows.length} góp ý vào ${video.currentVersion}`}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* BỘ LỌC TRẠNG THÁI (C3-UI-01) */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-semibold text-muted-foreground mr-1">
          Trạng thái:
        </span>
        {(
          [
            ["all", `Tất cả (${counts.total})`],
            ["co-nhan-xet", `Có nhận xét (${counts["co-nhan-xet"]})`],
            ["chi-cham-diem", `Chỉ chấm điểm (${counts["chi-cham-diem"]})`],
            ["bi-loai", `Bị loại (${counts["bi-loai"]})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatusFilter(value)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              statusFilter === value
                ? "bg-primary text-primary-foreground"
                : "bg-background border text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* BỘ LỌC NGUỒN GỐC VỊ TRÍ (LOCATION PROVENANCE) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border bg-muted/20">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold text-muted-foreground mr-1">
            Vị trí:
          </span>
          <button
            type="button"
            onClick={() => setLocationFilter("all")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              locationFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-background border text-muted-foreground hover:text-foreground"
            }`}
          >
            Tất cả ({counts.total})
          </button>
          <button
            type="button"
            onClick={() => setLocationFilter("nguoi-chon")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
              locationFilter === "nguoi-chon"
                ? "bg-green-600 text-white"
                : "bg-background border text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="size-2 rounded-full bg-green-500 inline-block" />
            Người gửi đã chọn ({counts.nguoiChon})
          </button>
          <button
            type="button"
            onClick={() => setLocationFilter("ai-de-xuat")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
              locationFilter === "ai-de-xuat"
                ? "bg-amber-600 text-white"
                : "bg-background border text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="size-2 rounded-full bg-amber-500 inline-block" />
            AI đề xuất vị trí ({counts.aiDeXuat})
          </button>
          <button
            type="button"
            onClick={() => setLocationFilter("chua-xac-dinh")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
              locationFilter === "chua-xac-dinh"
                ? "bg-neutral-600 text-white"
                : "bg-background border text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="size-2 rounded-full bg-neutral-400 inline-block" />
            Chưa xác định ({counts.chuaXacDinh})
          </button>
        </div>

        <div className="relative w-full sm:w-60">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Tìm theo nội dung, người gửi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-background"
          />
        </div>
      </div>

      {/* DANH SÁCH PHẢN HỒI */}
      <div className="grid gap-3 md:grid-cols-2">
        {filteredFeedbacks.length === 0 ? (
          <div className="col-span-full p-8 text-center text-muted-foreground text-xs rounded-xl border border-dashed">
            Không tìm thấy phản hồi nào phù hợp bộ lọc.
          </div>
        ) : (
          filteredFeedbacks.map((f) => (
            <div
              key={f.id}
              className="rounded-xl border bg-card p-3.5 space-y-2 text-xs flex flex-col justify-between shadow-2xs hover:shadow-xs transition-all"
            >
              <div className="space-y-2">
                {/* Header người gửi & vị trí */}
                <div className="flex items-center justify-between gap-2 border-b pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-foreground">
                      {f.sender}
                    </span>
                    <Badge variant="outline" className="text-[10px] py-0">
                      {f.channel === "khao-sat"
                        ? "Khảo sát"
                        : f.channel === "binh-luan"
                          ? "Bình luận"
                          : "Tin nhắn"}
                    </Badge>
                  </div>

                  {/* Nhãn phân định nguồn gốc vị trí rõ ràng */}
                  {f.locationSource === "nguoi-chon" ? (
                    <Badge className="bg-green-50 text-green-700 border-green-300 border text-[10px] py-0 dark:bg-green-950 dark:text-green-300">
                      🟢 Người gửi chọn vị trí
                    </Badge>
                  ) : f.locationSource === "ai-de-xuat" ? (
                    <Badge className="bg-amber-50 text-amber-700 border-amber-300 border text-[10px] py-0 dark:bg-amber-950 dark:text-amber-300">
                      🟡 AI đề xuất vị trí
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-muted-foreground text-[10px] py-0"
                    >
                      ⚪ Chưa rõ vị trí
                    </Badge>
                  )}
                </div>

                {/* Nội dung */}
                <p className="text-foreground leading-relaxed italic bg-muted/20 p-2.5 rounded-lg border border-border/40">
                  {f.isQuarantined ? (
                    <span className="not-italic text-muted-foreground flex items-center gap-1.5">
                      <AlertTriangle className="size-3.5" />
                      {f.id} · Bị loại khỏi phân tích:{" "}
                      {f.quarantineReason ?? "nội dung không phù hợp"}
                    </span>
                  ) : f.sanitizedText ? (
                    `"${f.sanitizedText}"`
                  ) : (
                    <span className="text-muted-foreground">
                      (Không có lời nhận xét)
                    </span>
                  )}
                </p>

                {/* Điểm số khảo sát nếu có */}
                {f.survey &&
                  (f.survey.deHieu != null || f.survey.nhipDo != null) && (
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {f.survey.deHieu != null && (
                        <span className="text-amber-700 font-medium">
                          Dễ hiểu: {f.survey.deHieu}/5
                        </span>
                      )}
                      {f.survey.nhipDo != null && (
                        <span className="text-sky-700 font-medium">
                          Nhịp độ: {f.survey.nhipDo}/5
                        </span>
                      )}
                    </div>
                  )}
              </div>

              {/* Mốc câu & Nút nhảy video */}
              <div className="pt-2 flex items-center justify-between text-[11px] text-muted-foreground border-t mt-2">
                <div>
                  {f.sentenceN != null ? (
                    <span>
                      Gắn mốc: <strong>Câu {f.sentenceN}</strong>{" "}
                      {f.timeSeconds != null &&
                        `(${dinhDangPhut(f.timeSeconds)})`}
                    </span>
                  ) : f.timeSeconds != null ? (
                    <span>
                      Gắn mốc: <strong>{dinhDangPhut(f.timeSeconds)}</strong>
                    </span>
                  ) : (
                    <span className="italic">Nhận xét chung bài</span>
                  )}
                </div>

                {f.timeSeconds != null && onSeekToTime && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onSeekToTime(f.timeSeconds!)}
                    className="h-6 text-[11px] px-2 text-primary hover:bg-primary/10 gap-1"
                  >
                    <Play className="size-3 fill-current" /> Xem đoạn này
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

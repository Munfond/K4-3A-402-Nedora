"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Clock,
  ExternalLink,
  Eye,
  Film,
  Info,
  Layers,
  Maximize2,
  MessageSquare,
  MessageSquarePlus,
  Network,
  Play,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ScriptGraphView from "@/components/studio/script-graph-view";
import { dinhDangPhut } from "@/lib/revision/format";
import {
  getFullSlideGroups,
  getSlideMetaForSentence,
} from "@/lib/studio/slides";
import type { ScriptData, SentenceData } from "@/lib/revision/types";
import type { StudioFeedback, StudioVideo } from "@/lib/studio/types";

interface KichBanChiTietTabProps {
  video: StudioVideo;
  script?: ScriptData;
  feedbacks?: StudioFeedback[];
  activeRunId?: string;
  onGoToRevision?: () => void;
  highlightSentenceN?: number;
  onPlaySentence: (batDauGiay: number) => void;
  onAddFeedbackAtSentence: (sentenceN: number, slideId: string) => void;
  onFilterFeedbackBySentence?: (sentenceN: number) => void;
}

export default function KichBanChiTietTab({
  video,
  script,
  feedbacks = [],
  activeRunId,
  onGoToRevision,
  highlightSentenceN,
  onPlaySentence,
  onAddFeedbackAtSentence,
  onFilterFeedbackBySentence,
}: KichBanChiTietTabProps) {
  const [selectedSentence, setSelectedSentence] = useState<SentenceData | null>(
    null,
  );
  const [lightboxImage, setLightboxImage] = useState<{
    src: string;
    title: string;
  } | null>(null);
  const [activeSectionNum, setActiveSectionNum] = useState<number>(1);
  const [viewMode, setViewMode] = useState<"graph" | "cards">("graph");

  const slideGroups = useMemo(() => getFullSlideGroups(), []);

  const sentenceMap = useMemo(() => {
    return new Map<number, SentenceData>(
      (script?.cau || []).map((c) => [c.n, c]),
    );
  }, [script]);

  const sections = useMemo(() => {
    return (
      script?.phan || [
        { so: 1, ten: "Mở đầu — hai công cụ, hai nhiệm vụ" },
        { so: 2, ten: "Trí tuệ nhân tạo và học máy" },
        { so: 3, ten: "Tạo nội dung và xử lý ngôn ngữ" },
        { so: 4, ten: "Đặt ba ứng dụng lên bản đồ" },
        { so: 5, ten: "Tự kiểm tra và chốt bản đồ" },
      ]
    );
  }, [script]);

  // Chỉ lấy góp ý do người gửi chọn vị trí (P0a - không hiển thị vị trí do AI suy luận ở tab này)
  const senderFeedbacks = useMemo(() => {
    return feedbacks.filter((f) => f.locationSource !== "ai-de-xuat");
  }, [feedbacks]);

  // Đếm góp ý theo từng câu
  const feedbacksBySentence = useMemo(() => {
    const map = new Map<number, StudioFeedback[]>();
    for (const f of senderFeedbacks) {
      if (f.sentenceN != null) {
        const list = map.get(f.sentenceN) || [];
        list.push(f);
        map.set(f.sentenceN, list);
      }
    }
    return map;
  }, [senderFeedbacks]);

  // Cuộn đến câu nếu có highlightSentenceN
  useEffect(() => {
    if (highlightSentenceN) {
      const el = document.getElementById(`sentence-card-${highlightSentenceN}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [highlightSentenceN]);

  const scrollToSection = (sectionSo: number) => {
    setActiveSectionNum(sectionSo);
    // Tìm câu đầu tiên của phần đó
    const firstSentence = (script?.cau || []).find((c) => c.phan === sectionSo);
    if (firstSentence) {
      const el = document.getElementById(`sentence-card-${firstSentence.n}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. KHU VỰC ĐẦU TRANG: TÊN VIDEO, PHIÊN BẢN, MỤC TIÊU, SỐ CÂU, NHÓM SLIDE */}
      <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base sm:text-lg text-foreground">
              {video.title}
            </span>
            <Badge variant="outline" className="font-mono text-xs">
              Phiên bản: {video.currentVersion}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <span>{script?.cau.length || 40} câu</span>
              <span>·</span>
              <span>{slideGroups.length} nhóm slide (s01–s29)</span>
              <span>·</span>
              <span>{dinhDangPhut(video.durationSeconds)}</span>
            </div>

            {/* NÚT CHUYỂN ĐỔI CHẾ ĐỘ XEM: SƠ ĐỒ ĐỒ THỊ VS DANH SÁCH THẺ */}
            <div className="flex items-center gap-1 bg-muted/80 p-1 rounded-lg border text-xs">
              <button
                type="button"
                onClick={() => setViewMode("graph")}
                className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === "graph"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Network className="size-3.5 text-primary" />
                <span>Sơ đồ Đồ thị (Graph)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === "cards"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers className="size-3.5" />
                <span>Danh sách thẻ</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mục tiêu bài học */}
        {script?.mucTieu && (
          <div className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Mục tiêu đào tạo:</strong>{" "}
            {script.mucTieu}
          </div>
        )}

        {/* Thông báo trung tính khi có kết quả phân tích (P0a - C3) */}
        {activeRunId && onGoToRevision && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground flex items-center justify-between gap-3">
            <span className="font-mono text-muted-foreground">
              Có kết quả phân tích của đợt{" "}
              <strong className="text-foreground">{activeRunId}</strong>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onGoToRevision}
              className="h-7 px-2.5 text-[11px] gap-1 font-medium text-primary hover:bg-primary/10 shrink-0"
            >
              Mở tab Đề xuất chỉnh sửa <ExternalLink className="size-3" />
            </Button>
          </div>
        )}

        {/* Lưu ý ảnh cuối câu trung thực */}
        <div className="rounded-lg border border-muted bg-muted/30 p-3 text-xs text-foreground flex items-start gap-2.5">
          <Info className="size-4 text-primary shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Ảnh cuối câu:</strong> Mỗi hình ảnh bên dưới là khung hình
            trích xuất tại mốc kết thúc của câu đó, thể hiện trạng thái hiển thị
            đầy đủ nhất trên màn hình (tránh hiểu nhầm là hình tại thời điểm bắt
            đầu câu).
          </p>
        </div>
      </div>

      {/* CHẾ ĐỘ HIỂN THỊ: GRAPH VS CARDS */}
      {viewMode === "graph" ? (
        <ScriptGraphView
          video={video}
          script={script}
          feedbacks={senderFeedbacks}
          highlightSentenceN={highlightSentenceN}
          onPlaySentence={onPlaySentence}
          onAddFeedbackAtSentence={onAddFeedbackAtSentence}
          onFilterFeedbackBySentence={onFilterFeedbackBySentence}
        />
      ) : (
        /* 2. BỐ CỤC DANH SÁCH THẺ: MỤC LỤC BÊN TRÁI & NỘI DUNG NHÓM SLIDE BÊN PHẢI */
        <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6 items-start">
          {/* MỤC LỤC BÊN TRÁI (STICKY TOC) */}
          <div className="sticky top-20 rounded-xl border bg-card p-3.5 space-y-3 shadow-xs hidden lg:block">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                Mục lục kịch bản
              </span>
              <span className="text-[10px] text-muted-foreground">5 phần</span>
            </div>

            <div className="space-y-1 text-xs">
              {sections.map((sec) => {
                const isActive = activeSectionNum === sec.so;
                return (
                  <button
                    key={sec.so}
                    type="button"
                    onClick={() => scrollToSection(sec.so)}
                    className={`w-full text-left p-2 rounded-lg transition-all text-xs flex flex-col gap-0.5 ${
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <span className="font-mono text-[10px] opacity-80">
                      Phần {sec.so}
                    </span>
                    <span className="line-clamp-2 leading-snug">{sec.ten}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* NỘI DUNG CHÍNH: CÁC NHÓM SLIDE THEO THỨ TỰ */}
          <div className="space-y-6">
            {slideGroups.map((group) => {
              const startSec = group.tuGiay;
              const endSec = group.denGiay;
              const sentenceCount = group.cau.length;

              return (
                <div
                  key={group.id}
                  id={`slide-group-${group.id}`}
                  className="rounded-xl border bg-card p-4 space-y-4 shadow-xs"
                >
                  {/* TIÊU ĐỀ NHÓM SLIDE */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md">
                        Slide {group.id}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs font-semibold text-foreground">
                        Câu {group.cau[0]}
                        {sentenceCount > 1
                          ? `–${group.cau[sentenceCount - 1]}`
                          : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs font-mono text-muted-foreground">
                        {dinhDangPhut(startSec)}–{dinhDangPhut(endSec)}
                      </span>
                    </div>

                    <span className="text-[11px] text-muted-foreground">
                      {sentenceCount} câu kịch bản
                    </span>
                  </div>

                  {/* LƯỚI THẺ CÂU TRONG NHÓM SLIDE (MỖI CÂU LÀ MỘT THẺ ẢNH–KỊCH BẢN RIÊNG) */}
                  <div
                    className={`grid gap-4 ${sentenceCount > 1 ? "sm:grid-cols-2" : "grid-cols-1"}`}
                  >
                    {group.sentences.map((meta) => {
                      const sentence = sentenceMap.get(meta.sentenceN);
                      if (!sentence) return null;

                      const isSilence = Boolean(
                        sentence.dungGiay && !sentence.loi,
                      );
                      const sentenceFeedbacks =
                        feedbacksBySentence.get(meta.sentenceN) || [];
                      const isTarget = highlightSentenceN === meta.sentenceN;

                      return (
                        <Card
                          key={meta.sentenceN}
                          id={`sentence-card-${meta.sentenceN}`}
                          className={`flex flex-col justify-between overflow-hidden border-2 transition-all ${
                            isTarget
                              ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md"
                              : "border-border hover:border-muted-foreground/40 shadow-xs"
                          }`}
                        >
                          {/* 1. Ảnh riêng của câu */}
                          <div className="relative aspect-video w-full bg-black/5 overflow-hidden border-b group">
                            <img
                              src={meta.image}
                              alt={`Khung hình câu ${meta.sentenceN}`}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                              onClick={() =>
                                setLightboxImage({
                                  src: meta.image,
                                  title: `Câu ${meta.sentenceN} (Ảnh cuối câu tại ${dinhDangPhut(sentence.ketThucGiay)})`,
                                })
                              }
                            />

                            {/* Nhãn "Ảnh cuối câu" góc trái */}
                            <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-xs text-white text-[9px] px-1.5 py-0.5 rounded font-medium border border-white/20">
                              Ảnh cuối câu
                            </div>

                            {/* Nút phóng lớn */}
                            <button
                              type="button"
                              onClick={() =>
                                setLightboxImage({
                                  src: meta.image,
                                  title: `Câu ${meta.sentenceN} (Ảnh cuối câu tại ${dinhDangPhut(sentence.ketThucGiay)})`,
                                })
                              }
                              className="absolute top-2 right-2 size-7 rounded-md bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                              title="Phóng lớn xem chi tiết"
                            >
                              <Maximize2 className="size-3.5" />
                            </button>
                          </div>

                          {/* 2. Nội dung kịch bản & Thông tin câu */}
                          <CardContent className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between text-xs">
                            <div className="space-y-2">
                              {/* Tiêu đề câu & Timestamp */}
                              <div className="flex items-center justify-between gap-1 border-b pb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-xs bg-muted px-1.5 py-0.5 rounded">
                                    Câu {meta.sentenceN}
                                  </span>
                                  <span className="font-mono text-[11px] text-muted-foreground">
                                    Bắt đầu {dinhDangPhut(sentence.batDauGiay)}
                                  </span>
                                </div>

                                <span className="font-mono text-[10px] text-muted-foreground">
                                  Hết tiếng:{" "}
                                  {dinhDangPhut(sentence.ketThucTiengGiay)}
                                </span>
                              </div>

                              {/* Lời đọc */}
                              {isSilence ? (
                                <p className="italic text-amber-600 font-medium py-1">
                                  (khoảng lặng dừng {sentence.dungGiay} giây)
                                </p>
                              ) : (
                                <p className="text-foreground leading-relaxed text-xs">
                                  <strong>Lời đọc:</strong> “{sentence.loi}”
                                </p>
                              )}

                              {/* Nhãn liên kết góp ý hoặc đề xuất sửa */}
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                {sentenceFeedbacks.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onFilterFeedbackBySentence?.(
                                        meta.sentenceN,
                                      )
                                    }
                                    className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded text-[10px] font-medium hover:bg-amber-100 transition-colors dark:bg-amber-950 dark:text-amber-300"
                                  >
                                    <MessageSquare className="size-3" />
                                    <span>
                                      {sentenceFeedbacks.length} góp ý
                                    </span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* 3 Nút tương tác chính */}
                            <div className="pt-2 border-t flex items-center justify-between gap-1 text-xs">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedSentence(sentence)}
                                className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                              >
                                <Eye className="size-3" /> Xem chi tiết
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  onPlaySentence(sentence.batDauGiay)
                                }
                                className="h-7 px-2 text-[11px] gap-1 text-primary hover:bg-primary/5"
                              >
                                <Play className="size-3 fill-current" /> Phát
                                đoạn này
                              </Button>

                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  onAddFeedbackAtSentence(
                                    meta.sentenceN,
                                    group.id,
                                  )
                                }
                                className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                              >
                                <MessageSquarePlus className="size-3" /> Thêm
                                góp ý
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL CHI TIẾT CÂU ĐƯỢC CHỌN (ĐẦY ĐỦ 5 TRƯỜNG & THÔNG TIN RÀ SOÁT) */}
      {selectedSentence && (
        <Dialog
          open={Boolean(selectedSentence)}
          onOpenChange={() => setSelectedSentence(null)}
        >
          <DialogContent className="max-w-lg p-5 space-y-4">
            <DialogHeader className="border-b pb-2">
              <DialogTitle className="text-base font-bold flex items-center justify-between">
                <span>Chi tiết câu {selectedSentence.n}</span>
                <span className="font-mono text-xs font-normal text-muted-foreground">
                  Phần {selectedSentence.phan} ·{" "}
                  {dinhDangPhut(selectedSentence.batDauGiay)} –{" "}
                  {dinhDangPhut(selectedSentence.ketThucGiay)}
                </span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              {/* Lời đọc */}
              <div>
                <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block mb-1">
                  Lời đọc:
                </span>
                <div className="rounded-lg bg-muted/40 p-2.5 text-foreground leading-relaxed">
                  {selectedSentence.loi || (
                    <span className="italic text-muted-foreground">
                      (Không có lời đọc)
                    </span>
                  )}
                </div>
              </div>

              {/* Chữ trên màn hình */}
              <div>
                <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block mb-1">
                  Chữ trên màn hình:
                </span>
                <div className="rounded-lg bg-muted/30 p-2 text-foreground">
                  {selectedSentence.chuTrenManHinh || (
                    <span className="italic text-muted-foreground">
                      Không có chữ hiển thị
                    </span>
                  )}
                </div>
              </div>

              {/* Ý đồ hình */}
              <div>
                <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block mb-1">
                  Ý đồ hình:
                </span>
                <div className="rounded-lg bg-muted/30 p-2 text-foreground">
                  {selectedSentence.yDoHinh || (
                    <span className="italic text-muted-foreground">
                      Không có mô tả ý đồ hình
                    </span>
                  )}
                </div>
              </div>

              {/* Kiểu đọc & Khoảng dừng */}
              <div className="grid grid-cols-2 gap-3 p-2.5 rounded-lg border bg-muted/20">
                <div>
                  <span className="text-muted-foreground block text-[10px]">
                    Kiểu đọc / Khoảng dừng:
                  </span>
                  <span className="font-medium text-foreground">
                    {selectedSentence.dungGiay
                      ? `Dừng ${selectedSentence.dungGiay} giây`
                      : "Đọc liên tục"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">
                    Số ký tự phát âm:
                  </span>
                  <span className="font-mono font-medium text-foreground">
                    {selectedSentence.soKyTu || 0} ký tự
                  </span>
                </div>
              </div>

              {/* Mốc thời gian */}
              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg border bg-muted/20 text-center font-mono">
                <div>
                  <span className="text-[10px] text-muted-foreground block">
                    Bắt đầu
                  </span>
                  <span className="font-bold">
                    {dinhDangPhut(selectedSentence.batDauGiay)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">
                    Hết tiếng
                  </span>
                  <span className="font-bold">
                    {dinhDangPhut(selectedSentence.ketThucTiengGiay)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">
                    Hết cảnh
                  </span>
                  <span className="font-bold">
                    {dinhDangPhut(selectedSentence.ketThucGiay)}
                  </span>
                </div>
              </div>

              {/* Thông tin rà soát kỹ thuật (khác ảnh, giữ nét) */}
              {(() => {
                const meta = getSlideMetaForSentence(selectedSentence.n);
                return (
                  <div className="rounded-lg border border-border/80 bg-muted/10 p-2.5 text-[11px] text-muted-foreground space-y-1">
                    <span className="font-semibold text-foreground block">
                      Thông tin rà soát slide:
                    </span>
                    <div className="flex items-center justify-between text-[10px]">
                      <span>
                        Mã slide gom: <strong>{meta.slideId}</strong>
                      </span>
                      <span>
                        Độ khác ảnh: <strong>{meta.khacAnh}</strong>
                      </span>
                      <span>
                        Độ giữ nét: <strong>{meta.giuNet}</strong>
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onPlaySentence(selectedSentence.batDauGiay);
                  setSelectedSentence(null);
                }}
                className="gap-1 text-xs text-primary"
              >
                <Play className="size-3 fill-current" /> Phát đoạn video này
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setSelectedSentence(null)}
              >
                Đóng
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* LIGHTBOX PHÓNG TO ẢNH */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full text-white text-xs px-1">
              <span className="font-semibold">{lightboxImage.title}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLightboxImage(null)}
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
              >
                <X className="size-5" />
              </Button>
            </div>

            <img
              src={lightboxImage.src}
              alt={lightboxImage.title}
              className="max-h-[80vh] w-auto rounded-lg border border-white/20 shadow-2xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Film,
  Info,
  Layers,
  Maximize2,
  MessageSquarePlus,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Subtitles,
  Volume2,
  VolumeX,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { dinhDangPhut } from "@/lib/revision/format";
import type { ScriptData, SentenceData } from "@/lib/revision/types";

interface VideoPlayerSyncProps {
  videoUrl?: string;
  title: string;
  durationSeconds: number;
  script?: ScriptData;
  initialSeekTime?: number | null;
  onAddFeedbackAtTime?: (timeSeconds: number, sentenceN?: number) => void;
  onGoToRevision?: () => void;
}

export default function VideoPlayerSync({
  videoUrl = "/video/d1.mp4",
  title,
  durationSeconds,
  script,
  initialSeekTime,
  onAddFeedbackAtTime,
  onGoToRevision,
}: VideoPlayerSyncProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sentenceListRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialSeekTime || 0);
  const [duration, setDuration] = useState(durationSeconds || 251);
  const [isMuted, setIsMuted] = useState(false);
  const [activeSentenceN, setActiveSentenceN] = useState<number | null>(null);
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);

  const sentences = useMemo(() => script?.cau || [], [script]);

  // Handle external seek trigger
  useEffect(() => {
    if (initialSeekTime != null && videoRef.current) {
      videoRef.current.currentTime = Math.max(
        0,
        Math.min(initialSeekTime, duration),
      );
      setCurrentTime(initialSeekTime);
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => {
            // Autoplay policy may require user interaction
          });
      }
    }
  }, [initialSeekTime, duration]);

  // Đồng bộ câu đang phát theo currentTime
  useEffect(() => {
    if (sentences.length === 0) return;

    const currentSentence = sentences.find((s) => {
      return currentTime >= s.batDauGiay && currentTime < s.ketThucGiay;
    });

    if (currentSentence) {
      setActiveSentenceN(currentSentence.n);
      // Tự động cuộn danh sách đến câu đang phát
      const el = document.getElementById(`sentence-item-${currentSentence.n}`);
      if (el && sentenceListRef.current) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    } else {
      setActiveSentenceN(null);
    }
  }, [currentTime, sentences]);

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
  };

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.duration && !isNaN(v.duration) && v.duration > 0) {
      setDuration(v.duration);
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) {
      v.pause();
      setIsPlaying(false);
    } else {
      void v.play();
      setIsPlaying(true);
    }
  };

  const seekTo = (seconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(seconds, duration));
    setCurrentTime(v.currentTime);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    seekTo(ratio * duration);
  };

  return (
    <div className="flex flex-col space-y-4">
      {/* 2 CỘT CHÍNH: TRÌNH PHÁT VIDEO & KỊCH BẢN ĐỒNG BỘ */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {/* CỘT TRÁI: TRÌNH PHÁT VIDEO VÀ THANH ĐIỀU KHIỂN */}
        <div className="space-y-3 flex flex-col">
          <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border shadow-sm flex items-center justify-center group">
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                playsInline
                preload="metadata"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                className="w-full h-full object-contain cursor-pointer"
                onClick={togglePlay}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground text-xs">
                <Film className="size-10 text-muted-foreground/60" />
                <p className="font-semibold text-foreground">
                  Video nguồn chưa tải lên
                </p>
                <p>
                  Kịch bản và timecode vẫn được đồng bộ mô phỏng theo thời gian.
                </p>
              </div>
            )}

            {/* Overlay nút Play to khi dừng */}
            {!isPlaying && videoUrl && (
              <button
                type="button"
                onClick={togglePlay}
                className="absolute inset-0 m-auto size-14 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-xs hover:bg-black/80 hover:scale-105 transition-all shadow-lg"
              >
                <Play className="size-7 ml-1 fill-current" />
              </button>
            )}

            {/* Badge câu đang phát nổi trên video */}
            {activeSentenceN && (
              <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold text-white border border-white/20 shadow-xs">
                Đang phát: Câu {activeSentenceN}
              </div>
            )}
          </div>

          {/* BỘ ĐIỀU KHIỂN VIDEO */}
          <div className="rounded-xl border bg-card p-3 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={togglePlay}
                  className="h-8 px-3 gap-1.5 font-medium"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="size-3.5 fill-current" /> Dừng
                    </>
                  ) : (
                    <>
                      <Play className="size-3.5 fill-current" /> Phát
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => seekTo(0)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  title="Về đầu video"
                >
                  <RotateCcw className="size-3.5" />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={toggleMute}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                >
                  {isMuted ? (
                    <VolumeX className="size-3.5" />
                  ) : (
                    <Volume2 className="size-3.5" />
                  )}
                </Button>

                <span className="font-mono text-xs text-muted-foreground ml-1">
                  <strong className="text-foreground">
                    {dinhDangPhut(currentTime)}
                  </strong>{" "}
                  / {dinhDangPhut(duration)}
                </span>
              </div>

              {/* Nút hành động: Góp ý tại thời điểm này */}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  onAddFeedbackAtTime?.(
                    Math.round(currentTime),
                    activeSentenceN ?? undefined,
                  )
                }
                className="h-8 gap-1.5 text-xs text-primary font-medium"
              >
                <MessageSquarePlus className="size-3.5" />
                <span>Góp ý tại {dinhDangPhut(currentTime)}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: KỊCH BẢN & NỘI DUNG CẢNH ĐỒNG BỘ */}
        <div className="flex flex-col h-[460px] rounded-xl border bg-card overflow-hidden shadow-xs">
          <div className="p-3 border-b bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                Kịch bản & Nội dung cảnh
              </span>
              <Badge variant="secondary" className="text-[10px] font-mono">
                {sentences.length} câu
              </Badge>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Bấm vào câu để nhảy video
            </span>
          </div>

          {/* DANH SÁCH CÂU KỊCH BẢN CUỘN TỰ ĐỘNG */}
          <div
            ref={sentenceListRef}
            className="flex-1 overflow-y-auto divide-y divide-border p-1"
          >
            {sentences.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center text-muted-foreground text-xs space-y-2">
                <AlertCircle className="size-6 text-amber-500" />
                <p className="font-medium text-foreground">
                  Chưa có kịch bản & timecode
                </p>
                <p>
                  Video này đang ở trạng thái quay thô, chưa nạp tệp kịch bản.
                </p>
              </div>
            ) : (
              sentences.map((s) => {
                const isActive = activeSentenceN === s.n;
                const isSilence = Boolean(s.dungGiay && !s.loi);

                return (
                  <button
                    key={s.n}
                    id={`sentence-item-${s.n}`}
                    type="button"
                    onClick={() => seekTo(s.batDauGiay)}
                    className={`w-full text-left p-3 rounded-lg transition-all space-y-1.5 flex flex-col ${
                      isActive
                        ? "bg-primary/10 border-2 border-primary shadow-xs"
                        : "hover:bg-muted/40 border border-transparent"
                    }`}
                  >
                    {/* Header câu & Timecode */}
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded ${
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground"
                          }`}
                        >
                          Câu {s.n}
                        </span>
                        <Badge variant="outline" className="text-[10px] py-0">
                          Phần {s.phan}
                        </Badge>
                      </div>

                      <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                        <Clock className="size-3" />
                        <span>
                          {dinhDangPhut(s.batDauGiay)} –{" "}
                          {dinhDangPhut(s.ketThucGiay)}
                        </span>
                      </div>
                    </div>

                    {/* Lời đọc */}
                    {isSilence ? (
                      <p className="text-xs italic text-amber-600 font-medium">
                        (khoảng lặng dừng {s.dungGiay} giây)
                      </p>
                    ) : (
                      <p
                        className={`text-xs leading-relaxed ${
                          isActive
                            ? "text-foreground font-semibold text-sm"
                            : "text-foreground"
                        }`}
                      >
                        {s.loi}
                      </p>
                    )}

                    {/* Chữ màn hình & Ý đồ hình */}
                    {(s.chuTrenManHinh || s.yDoHinh) && (
                      <div className="pt-1 border-t border-border/50 text-[11px] text-muted-foreground space-y-0.5">
                        {s.chuTrenManHinh && (
                          <p className="truncate">
                            <strong className="text-foreground/80">
                              Màn hình:
                            </strong>{" "}
                            {s.chuTrenManHinh}
                          </p>
                        )}
                        {s.yDoHinh && (
                          <p className="truncate">
                            <strong className="text-foreground/80">
                              Ý đồ hình:
                            </strong>{" "}
                            {s.yDoHinh}
                          </p>
                        )}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* THANH THỜI GIAN TRỰC QUAN (TIMELINE BAR) */}
      <div className="rounded-xl border bg-card p-3.5 space-y-2 shadow-xs">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <Layers className="size-3.5 text-primary" />
            <span>Thanh thời gian phân bổ kịch bản theo phân cảnh</span>
          </div>
          <span className="text-[11px]">
            Rê chuột và bấm để tua video nhanh
          </span>
        </div>

        {/* Timeline track */}
        <div
          onClick={handleTimelineClick}
          className="relative h-6 w-full rounded-md bg-muted/60 cursor-pointer overflow-hidden border flex"
        >
          {sentences.map((s) => {
            const segDuration = s.ketThucGiay - s.batDauGiay;
            const widthPct = (segDuration / duration) * 100;
            const isCurrent = activeSentenceN === s.n;
            const isSilence = Boolean(s.dungGiay && !s.loi);

            return (
              <div
                key={s.n}
                style={{ width: `${widthPct}%` }}
                title={`Câu ${s.n}: ${dinhDangPhut(s.batDauGiay)}–${dinhDangPhut(s.ketThucGiay)} ${
                  isSilence ? "(Khoảng lặng)" : s.loi || ""
                }`}
                className={`h-full border-r border-border/40 transition-colors ${
                  isCurrent
                    ? "bg-primary text-primary-foreground font-bold"
                    : isSilence
                      ? "bg-amber-400/40 hover:bg-amber-400/60"
                      : "bg-muted hover:bg-primary/20"
                }`}
              />
            );
          })}

          {/* Kim chỉ thời gian phát (Playhead) */}
          <div
            style={{ left: `${(currentTime / duration) * 100}%` }}
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 shadow-sm pointer-events-none"
          />
        </div>

        {/* Ghi chú tính trung thực */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
          <span>
            ℹ️ Đồng bộ theo câu và mốc kịch bản đã thẩm định; hệ thống không vẽ
            waveform âm thanh hoặc frame giả lập.
          </span>
          {onGoToRevision && (
            <button
              type="button"
              onClick={onGoToRevision}
              className="text-primary hover:underline font-medium text-xs flex items-center gap-1"
            >
              <Sparkles className="size-3" /> Chuẩn bị bản sửa từ góp ý →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

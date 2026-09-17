"use client";

import { useRef, useState } from "react";
import { Play, Pause, Video, Clock, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VIDEO_SRC, dinhDangPhut } from "@/lib/revision/format";
import kichBanData from "@/data/kich-ban-d1.json";

interface Props {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialTime?: number;
}

export function VideoV1Dialog({
  trigger,
  open,
  onOpenChange,
  initialTime = 0,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialTime);

  const script = kichBanData;

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleSeek = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
              <Video className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Video bài giảng gốc (v1)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Phân biệt AI, học máy, tạo sinh và mô hình ngôn ngữ lớn · 04:11
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 bg-black">
          {/* Video Player */}
          <div className="md:col-span-2 relative aspect-video flex items-center justify-center bg-black">
            <video
              ref={videoRef}
              src={VIDEO_SRC}
              controls
              onTimeUpdate={handleTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className="w-full h-full object-contain"
              preload="metadata"
            >
              Trình duyệt của bạn không hỗ trợ phát video HTML5.
            </video>
          </div>

          {/* Chapters / Sentence Jump */}
          <div className="border-t md:border-t-0 md:border-l border-border/20 bg-background flex flex-col h-[280px] md:h-auto">
            <div className="p-3 border-b text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span>Mục lục phân cảnh (40 câu)</span>
              <span className="font-mono text-[11px] text-primary">
                {dinhDangPhut(currentTime)}
              </span>
            </div>
            <ScrollArea className="flex-1 p-2">
              <div className="space-y-1">
                {script.cau.map((c, idx) => {
                  // Giả lập mốc thời gian ước lượng dựa trên 251s chia đều hoặc timecode
                  const estTime = Math.round((idx / script.cau.length) * 251);
                  const isCurrent =
                    currentTime >= estTime &&
                    currentTime <
                      (idx < script.cau.length - 1
                        ? Math.round(((idx + 1) / script.cau.length) * 251)
                        : 999);

                  return (
                    <button
                      key={c.n}
                      type="button"
                      onClick={() => handleSeek(estTime)}
                      className={`w-full text-left p-2 rounded text-xs transition-colors flex items-center justify-between gap-2 ${
                        isCurrent
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="truncate">
                        <span className="font-mono font-semibold mr-1.5">
                          #{c.n}
                        </span>
                        <span>
                          {c.loi
                            ? c.loi.slice(0, 32) + "..."
                            : `Khoảng lặng ${c.dungGiay}s`}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                        {dinhDangPhut(estTime)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

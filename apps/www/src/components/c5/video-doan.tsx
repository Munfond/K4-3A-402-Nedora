"use client";

import { Play, RotateCcw, Film } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { dinhDangPhut, VIDEO_SRC } from "@/lib/revision/format";

interface Props {
  tuGiay: number;
  denGiay: number;
}

/**
 * Phát đúng đoạn của một vấn đề: nhảy tới `tuGiay` và tự dừng ở `denGiay`,
 * để người duyệt không phải tự tua. Chỉ gán src khi người dùng bấm phát để tránh
 * tải trước video nặng không cần thiết (C3-UI-03).
 */
export default function VideoDoan({ tuGiay, denGiay }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [dangPhat, setDangPhat] = useState(false);
  const [daKichHoatSrc, setDaKichHoatSrc] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !daKichHoatSrc) return;
    video.currentTime = tuGiay;
  }, [tuGiay, daKichHoatSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !daKichHoatSrc) return;

    const dungCuoiDoan = () => {
      if (video.currentTime >= denGiay) {
        video.pause();
        setDangPhat(false);
      }
    };

    video.addEventListener("timeupdate", dungCuoiDoan);
    return () => video.removeEventListener("timeupdate", dungCuoiDoan);
  }, [denGiay, daKichHoatSrc]);

  const phatLaiDoan = () => {
    if (!daKichHoatSrc) {
      setDaKichHoatSrc(true);
      setTimeout(() => {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = tuGiay;
        void video.play();
        setDangPhat(true);
      }, 50);
      return;
    }

    const video = videoRef.current;
    if (!video) return;
    video.currentTime = tuGiay;
    void video.play();
    setDangPhat(true);
  };

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-lg border bg-neutral-950">
        {!daKichHoatSrc ? (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
            <Film className="size-10 text-neutral-500" />
            <div>
              <p className="font-medium text-neutral-200 text-sm">
                Đoạn video {dinhDangPhut(tuGiay)} – {dinhDangPhut(denGiay)}
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                (Chế độ tiết kiệm tài nguyên — bấm nút để phát đoạn này)
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={phatLaiDoan}
              className="gap-2"
            >
              <Play className="size-4" />
              Tải và phát đoạn video
            </Button>
          </div>
        ) : (
          <video
            ref={videoRef}
            src={VIDEO_SRC}
            controls
            preload="metadata"
            className="aspect-video w-full"
            onPlay={() => setDangPhat(true)}
            onPause={() => setDangPhat(false)}
          />
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          Đoạn {dinhDangPhut(tuGiay)} – {dinhDangPhut(denGiay)} (
          {Math.max(1, Math.round(denGiay - tuGiay))} giây)
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={phatLaiDoan}
          className="gap-1.5"
        >
          {dangPhat ? (
            <RotateCcw className="size-3.5" />
          ) : (
            <Play className="size-3.5" />
          )}
          {dangPhat ? "Phát lại đoạn này" : "Phát đoạn này"}
        </Button>
      </div>
    </div>
  );
}

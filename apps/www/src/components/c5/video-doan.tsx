"use client";

import { Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { dinhDangPhut, VIDEO_SRC } from "@/lib/mock-data";

interface Props {
  tuGiay: number;
  denGiay: number;
}

/**
 * Phát đúng đoạn của một vấn đề: nhảy tới `tuGiay` và tự dừng ở `denGiay`,
 * để người duyệt không phải tự tua.
 */
export default function VideoDoan({ tuGiay, denGiay }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [dangPhat, setDangPhat] = useState(false);

  // Đổi vấn đề thì tua về đầu đoạn mới.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = tuGiay;
  }, [tuGiay]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const dungCuoiDoan = () => {
      if (video.currentTime >= denGiay) {
        video.pause();
        setDangPhat(false);
      }
    };

    video.addEventListener("timeupdate", dungCuoiDoan);
    return () => video.removeEventListener("timeupdate", dungCuoiDoan);
  }, [denGiay]);

  const phatLaiDoan = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = tuGiay;
    void video.play();
    setDangPhat(true);
  };

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border bg-black">
        {/* biome-ignore lint/a11y/useMediaCaption: bản chép lời hiển thị riêng bên dưới */}
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          controls
          preload="metadata"
          className="aspect-video w-full"
          onPlay={() => setDangPhat(true)}
          onPause={() => setDangPhat(false)}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          Đoạn {dinhDangPhut(tuGiay)} – {dinhDangPhut(denGiay)} (
          {Math.round(denGiay - tuGiay)} giây)
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
          Phát lại đoạn này
        </Button>
      </div>
    </div>
  );
}

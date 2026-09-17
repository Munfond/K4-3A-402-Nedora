"use client";

import {
  CheckCircle2,
  Clock,
  FileCode,
  Film,
  History,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StudioVideo } from "@/lib/studio/types";

interface VideoVersionsTabProps {
  video: StudioVideo;
  onGoToRevision?: () => void;
}

export default function VideoVersionsTab({
  video,
  onGoToRevision,
}: VideoVersionsTabProps) {
  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="p-4 rounded-xl border bg-card space-y-1 shadow-xs">
        <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
          <History className="size-4 text-primary" />
          Lịch sử phiên bản và tiến trình phát hành
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Phân biệt rành mạch giữa video đã sản xuất hoàn chỉnh và bản sửa kịch
          bản đang chuẩn bị gói bàn giao.
        </p>
      </div>

      {/* TIMELINE CÁC PHIÊN BẢN */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
        {/* Phiên bản 1: Video v1 đã có */}
        <div className="relative space-y-2">
          <div className="absolute -left-6 top-1.5 size-4 rounded-full bg-green-600 border-2 border-background" />
          <div className="rounded-xl border bg-card p-4 space-y-2 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">
                  Phiên bản v1 (Gốc)
                </span>
                <Badge className="bg-green-600 text-white text-[10px]">
                  Video đã sản xuất
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                10/03/2026
              </span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Video gốc đang phát hành trên thư viện. Đầy đủ 40 câu kịch bản,
              thời lượng 4 phút 11 giây, có tệp MP4 phát trực tiếp.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Film className="size-3 text-primary" /> Có tệp video phát được
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <FileCode className="size-3 text-primary" /> Kịch bản 40 câu
                chuẩn
              </span>
            </div>
          </div>
        </div>

        {/* Phiên bản 2: Bản sửa dự kiến cho v2 · Chưa có video v2 */}
        <div className="relative space-y-2">
          <div className="absolute -left-6 top-1.5 size-4 rounded-full bg-amber-500 border-2 border-background animate-pulse" />
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50/30 dark:bg-amber-950/20 p-4 space-y-2.5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">
                  Bản sửa dự kiến cho v2
                </span>
                <Badge className="bg-amber-600 text-white text-[10px]">
                  Đang duyệt kịch bản · Chưa có video v2
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                Hiện tại
              </span>
            </div>

            <p className="text-xs text-foreground leading-relaxed">
              Kế hoạch chỉnh sửa kịch bản dựa trên 22 phản hồi của người học. Đã
              gom vùng và chuẩn bị gói bàn giao cho phòng thu âm và đội dựng.
            </p>

            <div className="rounded-md bg-background/80 p-2.5 border text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">
                Quy trình tiếp theo sau khi xuất gói bàn giao:
              </p>
              <ul className="list-disc ml-4 space-y-0.5 text-[11px]">
                <li>
                  Phòng thu âm đọc lại các câu đổi lời (kèm câu ngữ cảnh nối
                  giọng).
                </li>
                <li>
                  Đội dựng video thay thế hình ảnh/chữ màn hình theo{" "}
                  <code>viec-can-lam.csv</code>.
                </li>
                <li>
                  Sau khi có file MP4 mới sẽ cập nhật trạng thái thành{" "}
                  <strong>Video v2 đã sản xuất</strong>.
                </li>
              </ul>
            </div>

            {onGoToRevision && (
              <div className="pt-1">
                <Button
                  size="sm"
                  onClick={onGoToRevision}
                  className="gap-1.5 text-xs"
                >
                  <Sparkles className="size-3.5" /> Mở bàn làm việc duyệt phương
                  án sửa
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Phiên bản 3 (Kế hoạch tương lai): Video v2 sản xuất */}
        <div className="relative space-y-2 opacity-60">
          <div className="absolute -left-6 top-1.5 size-4 rounded-full bg-muted-foreground border-2 border-background" />
          <div className="rounded-xl border border-dashed bg-muted/20 p-3.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-xs text-foreground">
                Video v2 (Đã sản xuất mới)
              </span>
              <Badge variant="outline" className="text-[10px]">
                Kế hoạch tương lai
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Chỉ gắn nhãn này khi phòng thu và đội dựng đã hoàn thành tệp video
              v2 thực tế.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

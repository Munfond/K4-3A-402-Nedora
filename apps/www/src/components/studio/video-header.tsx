"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  FileText,
  Video as VideoIcon,
  Sparkles,
  Layers,
  FileCheck2,
  History,
  ChevronRight,
  ExternalLink,
  Sliders,
  Film,
  ArrowLeft,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KichBanV1Dialog } from "./kich-ban-v1-dialog";
import { VideoV1Dialog } from "./video-v1-dialog";
import { getLastRunId } from "@/hooks/use-quyet-dinh";

export function VideoHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryRunId = searchParams.get("run");
  const [openKichBan, setOpenKichBan] = useState(false);
  const [openVideo, setOpenVideo] = useState(false);

  const activeRunId = queryRunId || getLastRunId();
  const runQuery = activeRunId ? `?run=${activeRunId}` : "";

  const isHome = pathname === "/";
  const isVideoPage = pathname.startsWith("/videos/");
  const isStep2 = pathname.startsWith("/van-de");
  const isStep3 = pathname === "/xuat";
  const isLichSu = pathname === "/lich-su";

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-xs">
      <div className="px-4 sm:px-6 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* BÊN TRÁI: ĐIỀU HƯỚNG BREADCRUMB */}
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link
              href="/"
              className="hover:text-foreground transition-colors font-bold flex items-center gap-1 text-primary"
            >
              <Film className="size-3.5" /> Video Studio
            </Link>

            <span>/</span>

            {isHome ? (
              <span className="font-semibold text-foreground">
                Thư viện video bài học
              </span>
            ) : isVideoPage || isStep2 || isStep3 ? (
              <div className="flex items-center gap-1.5">
                <Link
                  href="/"
                  className="hover:text-foreground text-muted-foreground"
                >
                  Thư viện
                </Link>
                <span>/</span>
                <span className="font-semibold text-foreground truncate max-w-[280px] sm:max-w-md">
                  Phân biệt AI, học máy, tạo sinh và mô hình ngôn ngữ lớn
                </span>
              </div>
            ) : (
              <span className="font-semibold text-foreground">
                Lịch sử phân tích
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isHome ? (
              <span>
                Hệ thống quản lý video và lập kế hoạch chỉnh sửa kịch bản
              </span>
            ) : (
              <>
                <span>Đang làm việc:</span>
                <Badge
                  variant="secondary"
                  className="font-mono text-[10px] h-4 px-1.5 font-bold"
                >
                  v1
                </Badge>
                <span>·</span>
                <span>40 câu</span>
                <span>·</span>
                <span>khoảng 4 phút 11 giây</span>
              </>
            )}
          </div>
        </div>

        {/* BÊN PHẢI: CÁC NÚT TIỆN ÍCH */}
        <div className="flex items-center gap-2 shrink-0">
          {!isHome && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpenKichBan(true)}
                className="h-8 text-xs gap-1.5 font-medium"
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">Kịch bản v1</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpenVideo(true)}
                className="h-8 text-xs gap-1.5 font-medium"
              >
                <VideoIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">Video v1</span>
              </Button>

              <div className="h-4 w-[1px] bg-border mx-0.5 hidden sm:block" />
            </>
          )}

          <Button
            asChild
            variant={isLichSu ? "secondary" : "ghost"}
            size="sm"
            className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Link href="/lich-su">
              <History className="h-3.5 w-3.5" />
              <span>Lịch sử đợt chạy</span>
            </Link>
          </Button>

          {isHome && (
            <Link href={"/videos/d1" as any}>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5 font-semibold text-primary border-primary/30"
              >
                <Sparkles className="size-3.5" />
                <span>Mở video mẫu D1</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* DIALOG XEM KỊCH BẢN V1 */}
      <KichBanV1Dialog open={openKichBan} onOpenChange={setOpenKichBan} />

      {/* DIALOG XEM VIDEO V1 */}
      <VideoV1Dialog open={openVideo} onOpenChange={setOpenVideo} />
    </header>
  );
}

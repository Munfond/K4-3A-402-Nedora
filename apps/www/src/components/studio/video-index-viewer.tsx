"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Image,
  Mic,
  Music,
  Subtitles,
  Timer,
  Type,
  Zap,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type {
  VideoIndex,
  SegmentIndex,
} from "@feedback/revision-core/video-index";

interface VideoIndexViewerProps {
  videoIndex: VideoIndex;
  onSeek?: (seconds: number) => void;
  className?: string;
}

type SortField =
  | "n"
  | "tocDo"
  | "khoangLangCuoi"
  | "khoangCachDb"
  | "kyTuMoiGiay";
type SortDir = "asc" | "desc";

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function cellColor(
  value: number | undefined,
  thresholds: [number, number],
): string {
  if (value === undefined) return "";
  if (value <= thresholds[0]) return "bg-emerald-50 dark:bg-emerald-950/20";
  if (value >= thresholds[1]) return "bg-red-50 dark:bg-red-950/20";
  return "bg-amber-50 dark:bg-amber-950/20";
}

export default function VideoIndexViewer({
  videoIndex,
  onSeek,
  className,
}: VideoIndexViewerProps) {
  const [expanded, setExpanded] = useState(true);
  const [sortField, setSortField] = useState<SortField>("n");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const segments = useMemo(() => {
    const sorted = [...videoIndex.segments];
    sorted.sort((a, b) => {
      let va: number;
      let vb: number;
      switch (sortField) {
        case "n":
          va = a.n;
          vb = b.n;
          break;
        case "tocDo":
          va = a.tocDo ?? 0;
          vb = b.tocDo ?? 0;
          break;
        case "khoangLangCuoi":
          va = a.khoangLangCuoi;
          vb = b.khoangLangCuoi;
          break;
        case "khoangCachDb":
          va = a.amThanh?.khoangCachDb ?? 0;
          vb = b.amThanh?.khoangCachDb ?? 0;
          break;
        case "kyTuMoiGiay":
          va = a.trangPhuDe?.[0]?.kyTuMoiGiay ?? 0;
          vb = b.trangPhuDe?.[0]?.kyTuMoiGiay ?? 0;
          break;
        default:
          va = a.n;
          vb = b.n;
      }
      return sortDir === "asc" ? va - vb : vb - va;
    });
    return sorted;
  }, [videoIndex.segments, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <button
      type="button"
      onClick={() => toggleSort(field)}
      className={`ml-0.5 inline-flex ${sortField === field ? "text-primary" : "text-muted-foreground/40"}`}
    >
      <ArrowUpDown className="size-2.5" />
    </button>
  );

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card
        className={`rounded-xl border shadow-sm overflow-hidden ${className ?? ""}`}
      >
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer p-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                <Zap className="size-3.5 text-primary" />
                Chỉ mục video
                <Badge
                  variant="secondary"
                  className="text-[9px] py-0 font-mono ml-1"
                >
                  {videoIndex.segments.length} câu
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-muted-foreground">
                  {fmt(videoIndex.tongThoiLuong)}
                </span>
                {expanded ? (
                  <ChevronUp className="size-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-0">
            {/* Summary stats */}
            <div className="flex items-center gap-3 px-3 py-2 bg-muted/20 border-y text-[9px] text-muted-foreground">
              <span>
                Tốc độ TB:{" "}
                <b className="text-foreground">
                  {videoIndex.tocDoGiong.trungBinh.toFixed(1)}
                </b>{" "}
                âm tiết/s
              </span>
              <span>·</span>
              <span>Độ lệch: ±{videoIndex.tocDoGiong.doLech.toFixed(2)}</span>
              {videoIndex.thieu.length > 0 && (
                <>
                  <span>·</span>
                  <span className="text-amber-600 dark:text-amber-400">
                    Thiếu: {videoIndex.thieu.join(", ")}
                  </span>
                </>
              )}
            </div>

            {/* Table */}
            <TooltipProvider delayDuration={150}>
              <ScrollArea className="max-h-[500px]">
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead className="bg-muted/30 sticky top-0 z-10">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-semibold w-8">
                          # <SortIcon field="n" />
                        </th>
                        <th className="px-2 py-1.5 text-left font-semibold w-12">
                          Phần
                        </th>
                        <th className="px-2 py-1.5 text-left font-semibold w-16">
                          Mốc
                        </th>
                        <th className="px-2 py-1.5 text-left font-semibold">
                          Kiểu
                        </th>
                        <th className="px-2 py-1.5 text-right font-semibold">
                          <Tooltip>
                            <TooltipTrigger>Tốc độ</TooltipTrigger>
                            <TooltipContent>Âm tiết/giây</TooltipContent>
                          </Tooltip>
                          <SortIcon field="tocDo" />
                        </th>
                        <th className="px-2 py-1.5 text-right font-semibold">
                          <Tooltip>
                            <TooltipTrigger>Lặng</TooltipTrigger>
                            <TooltipContent>
                              Khoảng lặng cuối (giây)
                            </TooltipContent>
                          </Tooltip>
                          <SortIcon field="khoangLangCuoi" />
                        </th>
                        <th className="px-2 py-1.5 text-right font-semibold">
                          <Tooltip>
                            <TooltipTrigger>dB</TooltipTrigger>
                            <TooltipContent>
                              Khoảng cách giọng–nhạc (dB)
                            </TooltipContent>
                          </Tooltip>
                          <SortIcon field="khoangCachDb" />
                        </th>
                        <th className="px-2 py-1.5 text-right font-semibold">
                          <Tooltip>
                            <TooltipTrigger>Ký tự/s</TooltipTrigger>
                            <TooltipContent>Ký tự/giây phụ đề</TooltipContent>
                          </Tooltip>
                          <SortIcon field="kyTuMoiGiay" />
                        </th>
                        <th className="px-2 py-1.5 text-left font-semibold">
                          Slide
                        </th>
                        <th className="px-2 py-1.5 text-right font-semibold">
                          <Tooltip>
                            <TooltipTrigger>Chữ MH</TooltipTrigger>
                            <TooltipContent>
                              Số ký tự trên màn hình
                            </TooltipContent>
                          </Tooltip>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {segments.map((seg) => {
                        const db = seg.amThanh?.khoangCachDb;
                        const cps = seg.trangPhuDe?.[0]?.kyTuMoiGiay;
                        const chuMH = seg.tinHieuHinh.doDaiChuManHinh;
                        return (
                          <tr
                            key={seg.n}
                            className="border-b border-muted/30 hover:bg-muted/20 cursor-pointer transition-colors"
                            onClick={() => onSeek?.(seg.batDau)}
                          >
                            <td className="px-2 py-1 font-mono font-bold text-primary">
                              {seg.n}
                            </td>
                            <td className="px-2 py-1 text-muted-foreground">
                              {seg.phanTen}
                            </td>
                            <td className="px-2 py-1 font-mono text-muted-foreground">
                              {fmt(seg.batDau)}–{fmt(seg.ketThuc)}
                            </td>
                            <td className="px-2 py-1">
                              <Badge
                                variant="outline"
                                className={`text-[8px] py-0 ${
                                  seg.kieu === "ke"
                                    ? "border-blue-300 text-blue-700 dark:text-blue-400"
                                    : seg.kieu === "hoi"
                                      ? "border-orange-300 text-orange-700 dark:text-orange-400"
                                      : seg.kieu === "nhan"
                                        ? "border-emerald-300 text-emerald-700 dark:text-emerald-400"
                                        : ""
                                }`}
                              >
                                {seg.kieu}
                              </Badge>
                            </td>
                            <td
                              className={`px-2 py-1 text-right font-mono ${
                                seg.tocDo !== undefined
                                  ? seg.tocDo >
                                    videoIndex.tocDoGiong.trungBinh +
                                      videoIndex.tocDoGiong.doLech * 2
                                    ? "text-red-600 dark:text-red-400 font-bold"
                                    : seg.tocDo <
                                        videoIndex.tocDoGiong.trungBinh -
                                          videoIndex.tocDoGiong.doLech * 2
                                      ? "text-blue-600 dark:text-blue-400"
                                      : ""
                                  : "text-muted-foreground"
                              }`}
                            >
                              {seg.tocDo?.toFixed(1) ?? "—"}
                            </td>
                            <td
                              className={`px-2 py-1 text-right font-mono ${
                                seg.khoangLangCuoi > 2
                                  ? "text-amber-600 dark:text-amber-400 font-bold"
                                  : ""
                              }`}
                            >
                              {seg.khoangLangCuoi.toFixed(1)}
                            </td>
                            <td
                              className={`px-2 py-1 text-right font-mono ${
                                db !== undefined && db < 20
                                  ? "text-red-600 dark:text-red-400 font-bold"
                                  : ""
                              }`}
                            >
                              {db?.toFixed(1) ?? "—"}
                            </td>
                            <td
                              className={`px-2 py-1 text-right font-mono ${
                                cps !== undefined && cps > 21
                                  ? "text-amber-600 dark:text-amber-400 font-bold"
                                  : ""
                              }`}
                            >
                              {cps?.toFixed(0) ?? "—"}
                            </td>
                            <td className="px-2 py-1">
                              {seg.slideId ? (
                                <Badge
                                  variant="outline"
                                  className="text-[8px] py-0 gap-0.5"
                                >
                                  <Image className="size-2" />
                                  {seg.slideId}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground/40">
                                  —
                                </span>
                              )}
                            </td>
                            <td
                              className={`px-2 py-1 text-right font-mono ${
                                chuMH > 40
                                  ? "text-amber-600 dark:text-amber-400 font-bold"
                                  : ""
                              }`}
                            >
                              {chuMH || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
            </TooltipProvider>

            {/* Glossary */}
            {videoIndex.glossary && videoIndex.glossary.length > 0 && (
              <div className="px-3 py-2 border-t bg-muted/10">
                <p className="text-[9px] font-semibold text-muted-foreground mb-1">
                  Thuật ngữ mới
                </p>
                <div className="flex flex-wrap gap-1">
                  {videoIndex.glossary.map((g) => (
                    <Tooltip key={g.thuatNgu}>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className="text-[8px] py-0 cursor-default"
                        >
                          {g.thuatNgu}
                          <span className="text-muted-foreground/50 ml-0.5">
                            @{g.xuatHienLanDau}
                          </span>
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs max-w-xs">
                        {g.dinhNghia ??
                          `Xuất hiện lần đầu tại câu ${g.xuatHienLanDau}`}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

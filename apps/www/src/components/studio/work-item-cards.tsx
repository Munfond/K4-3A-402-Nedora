"use client";

import { useMemo } from "react";
import {
  BookOpen,
  Film,
  Mic,
  Music,
  Subtitles,
  HelpCircle,
  Heart,
  Shield,
  ChevronRight,
  AlertTriangle,
  Users,
  MapPin,
  TrendingUp,
  FileText,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { RevisionBrief } from "@feedback/revision-core/types";
import type { PlanSimulation } from "@feedback/revision-core/timeline";

type Nhom = "bien-kich" | "thu-am" | "dung-hinh" | "am-thanh" | "phu-de";

interface WorkItemCardProps {
  brief: RevisionBrief;
  selectedWorkItemId?: string;
  onSelectWorkItem?: (id: string) => void;
  onSeek?: (seconds: number) => void;
}

const NHOM_CONFIG: Record<
  Nhom,
  {
    label: string;
    icon: typeof BookOpen;
    color: string;
    bg: string;
    border: string;
  }
> = {
  "bien-kich": {
    label: "Biên kịch",
    icon: BookOpen,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
  },
  "thu-am": {
    label: "Thu âm",
    icon: Mic,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
  },
  "dung-hinh": {
    label: "Dựng hình",
    icon: Film,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    border: "border-violet-200 dark:border-violet-800",
  },
  "am-thanh": {
    label: "Âm thanh",
    icon: Music,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  "phu-de": {
    label: "Phụ đề",
    icon: Subtitles,
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-950/30",
    border: "border-cyan-200 dark:border-cyan-800",
  },
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function WorkItemCards({
  brief,
  selectedWorkItemId,
  onSelectWorkItem,
  onSeek,
}: WorkItemCardProps) {
  // Nhóm các việc theo nhóm (5 vai trò)
  const grouped = useMemo(() => {
    const map = new Map<Nhom, typeof brief.viec>();
    for (const v of brief.viec) {
      const nhom = v.nhom as Nhom;
      if (!map.has(nhom)) map.set(nhom, []);
      map.get(nhom)!.push(v);
    }
    // Sắp xếp theo ưu tiên
    for (const [, items] of map) {
      items.sort((a, b) => a.uuTien - b.uuTien);
    }
    return map;
  }, [brief.viec]);

  const nhomOrder: Nhom[] = [
    "bien-kich",
    "thu-am",
    "dung-hinh",
    "am-thanh",
    "phu-de",
  ];

  if (brief.viec.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground text-sm border rounded-xl bg-card">
        <FileText className="size-5 mr-2 opacity-50" />
        Không có việc nào cần xử lý.
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        {/* Header tóm tắt */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">
              Danh sách việc theo vai trò
            </h3>
            <Badge variant="secondary" className="text-[10px] font-mono py-0">
              {brief.viec.length} việc
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            {nhomOrder.map((nhom) => {
              const count = grouped.get(nhom)?.length ?? 0;
              if (count === 0) return null;
              const cfg = NHOM_CONFIG[nhom];
              const Icon = cfg.icon;
              return (
                <Tooltip key={nhom}>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className={`text-[10px] gap-1 py-0 ${cfg.border}`}
                    >
                      <Icon className={`size-3 ${cfg.color}`} />
                      {count}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {cfg.label}: {count} việc
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* Danh sách theo nhóm */}
        {nhomOrder.map((nhom) => {
          const items = grouped.get(nhom);
          if (!items || items.length === 0) return null;
          const cfg = NHOM_CONFIG[nhom];
          const Icon = cfg.icon;

          return (
            <div key={nhom} className="space-y-1.5">
              {/* Thanh nhóm */}
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${cfg.bg} border ${cfg.border}`}
              >
                <Icon className={`size-3.5 ${cfg.color}`} />
                <span className={`text-xs font-semibold ${cfg.color}`}>
                  {cfg.label}
                </span>
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1 py-0 ml-auto"
                >
                  {items.length}
                </Badge>
              </div>

              {/* Từng việc */}
              {items.map((viec) => {
                const isSelected = selectedWorkItemId === viec.id;
                return (
                  <Card
                    key={viec.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      isSelected
                        ? `ring-2 ring-primary/40 shadow-md ${cfg.bg}`
                        : "hover:bg-muted/30"
                    }`}
                    onClick={() => onSelectWorkItem?.(viec.id)}
                  >
                    <CardContent className="p-3 space-y-2">
                      {/* Hàng 1: ID, ưu tiên, nguồn độc lập */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-mono py-0 ${cfg.border}`}
                          >
                            {viec.id}
                          </Badge>
                          <Badge
                            className={`text-[10px] py-0 ${
                              viec.uuTien === 1
                                ? "bg-red-500 text-white"
                                : viec.uuTien === 2
                                  ? "bg-amber-500 text-white"
                                  : "bg-slate-400 text-white"
                            }`}
                          >
                            ƯT {viec.uuTien}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Users className="size-3" />
                          {viec.nguoiDocLap} người
                          <span>·</span>
                          {viec.gopYIds.length} góp ý
                        </div>
                      </div>

                      {/* Hàng 2: Lý do ưu tiên */}
                      <p className="text-xs text-foreground/80 leading-relaxed">
                        {viec.lyDoUuTien}
                      </p>

                      {/* Hàng 3: Vị trí + bằng chứng đo */}
                      <div className="flex flex-wrap items-center gap-2 text-[10px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="flex items-center gap-1 text-primary hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (viec.viTri.v1) {
                                  onSeek?.(viec.viTri.v1[0]);
                                }
                              }}
                            >
                              <MapPin className="size-3" />
                              Câu {viec.viTri.ns.join(", ")}
                              <span className="text-muted-foreground">
                                ({formatTime(viec.viTri.v1[0])}–
                                {formatTime(viec.viTri.v1[1])})
                              </span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Bấm để phát đoạn này</TooltipContent>
                        </Tooltip>

                        {viec.bangChungDo && (
                          <>
                            <Separator orientation="vertical" className="h-3" />
                            <span className="text-muted-foreground flex items-center gap-1">
                              <TrendingUp className="size-3" />
                              {viec.bangChungDo}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Hàng 4: Chi phí ước tính (gọn) */}
                      <div className="flex items-center gap-2 pt-1 border-t border-dashed">
                        {viec.chiPhi.thuLai.length > 0 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 gap-1"
                          >
                            <Mic className="size-2.5 text-amber-500" />
                            {viec.chiPhi.thuLai.length} câu thu
                          </Badge>
                        )}
                        {viec.chiPhi.canhDungLai.length > 0 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 gap-1"
                          >
                            <Film className="size-2.5 text-violet-500" />
                            {viec.chiPhi.canhDungLai.length} cảnh
                          </Badge>
                        )}
                        {viec.chiPhi.deltaTong !== 0 && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] py-0 ${
                              Math.abs(viec.chiPhi.deltaTong) > 5
                                ? "border-amber-300 text-amber-700 dark:text-amber-400"
                                : ""
                            }`}
                          >
                            Δ{" "}
                            {viec.chiPhi.deltaTong > 0
                              ? `+${viec.chiPhi.deltaTong.toFixed(1)}`
                              : viec.chiPhi.deltaTong.toFixed(1)}
                            s
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          );
        })}

        {/* Câu hỏi cần xác nhận */}
        {brief.cauHoi.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
              <HelpCircle className="size-3.5 text-orange-600 dark:text-orange-400" />
              <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                Câu hỏi cần xác nhận
              </span>
              <Badge
                variant="secondary"
                className="text-[10px] px-1 py-0 ml-auto"
              >
                {brief.cauHoi.length}
              </Badge>
            </div>
            {brief.cauHoi.map((q) => (
              <Card
                key={q.id}
                className="border-orange-200/50 dark:border-orange-800/50"
              >
                <CardContent className="p-3 space-y-1.5">
                  <p className="text-xs font-medium text-foreground">
                    {q.noiDung}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {q.luaChon.map((opt, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="text-[10px] py-0"
                      >
                        {opt}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Vùng bảo vệ */}
        {brief.vungBaoVe.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <Shield className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Vùng bảo vệ (giữ nguyên)
              </span>
              <Badge
                variant="secondary"
                className="text-[10px] px-1 py-0 ml-auto"
              >
                {brief.vungBaoVe.length}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1.5 px-3 py-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900">
              {brief.vungBaoVe.map((zone, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-[10px] py-0 gap-1 border-emerald-300 dark:border-emerald-700"
                >
                  <Shield className="size-2.5 text-emerald-500" />
                  Câu {zone.ns.join(", ")}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Ghi nhận (khen, ý tưởng chung) */}
        {brief.ghiNhan.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
              <Heart className="size-3.5 text-rose-600 dark:text-rose-400" />
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                Ghi nhận
              </span>
              <Badge
                variant="secondary"
                className="text-[10px] px-1 py-0 ml-auto"
              >
                {brief.ghiNhan.length}
              </Badge>
            </div>
            {brief.ghiNhan.map((gn, i) => (
              <div
                key={i}
                className="px-3 py-2 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900 text-xs text-muted-foreground"
              >
                {gn.lyDo}
              </div>
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

"use client";

import { useMemo } from "react";
import { Clock, Layers, Mic, Shield, TrendingUp, Timer } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  ScriptData,
  SentenceData,
  RevisionBrief,
} from "@feedback/revision-core/types";

interface TimelineTracksProps {
  script: ScriptData;
  brief?: RevisionBrief;
  selectedCaseId?: string;
  currentTime?: number;
  totalDuration: number;
  onSeek: (seconds: number) => void;
  onSelectCase?: (caseId: string) => void;
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function TimelineTracks({
  script,
  brief,
  selectedCaseId,
  currentTime,
  totalDuration,
  onSeek,
  onSelectCase,
}: TimelineTracksProps) {
  const dur = totalDuration || 1;

  // Tính set câu thu lại và dựng lại
  const thuLaiSet = useMemo(
    () => new Set(brief?.keHoach?.thuLai ?? []),
    [brief],
  );
  const canhSet = useMemo(
    () => new Set(brief?.keHoach?.canhDungLai ?? []),
    [brief],
  );
  const baoVeNs = useMemo(
    () => new Set(brief?.vungBaoVe?.flatMap((z) => z.ns) ?? []),
    [brief],
  );

  // Mốc v2 map
  const mocV2Map = useMemo(() => {
    const m = new Map<
      number,
      { batDau: number; ketThuc: number; dai: [number, number] }
    >();
    for (const moc of brief?.keHoach?.mocV2 ?? []) {
      m.set(moc.n, moc);
    }
    return m;
  }, [brief]);

  // Budget progress
  const budgetPct = useMemo(() => {
    if (!brief) return 0;
    const used = brief.keHoach.thuLai.length;
    const limit = brief.nganSach.cauThuLai || 8;
    return Math.min((used / limit) * 100, 100);
  }, [brief]);

  const playheadPct = currentTime != null ? (currentTime / dur) * 100 : -1;

  const tracks = useMemo(() => {
    const t: Array<{
      id: string;
      label: string;
      icon: typeof Mic;
      color: string;
      segments: Array<{
        left: number;
        width: number;
        bg: string;
        tooltip: string;
        label?: string;
        onClick?: () => void;
      }>;
    }> = [];

    // Track 1: Câu v1
    t.push({
      id: "cau-v1",
      label: "Câu v1",
      icon: Clock,
      color: "text-slate-500",
      segments: script.cau.map((c) => {
        const left = (c.batDauGiay / dur) * 100;
        const w = ((c.ketThucGiay - c.batDauGiay) / dur) * 100;
        return {
          left,
          width: Math.max(w, 0.3),
          bg: "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600",
          tooltip: `Câu ${c.n}: ${(c.loi || "").slice(0, 50)}${(c.loi || "").length > 50 ? "…" : ""}`,
          label: String(c.n),
          onClick: () => onSeek(c.batDauGiay),
        };
      }),
    });

    // Track 2: Thu lại (chỉ hiện khi có brief)
    if (brief && thuLaiSet.size > 0) {
      const thuLaiCau = script.cau.filter((c) => thuLaiSet.has(c.n));
      // Gộp liên tiếp thành ranges
      const ranges: Array<{
        from: SentenceData;
        to: SentenceData;
        ns: number[];
      }> = [];
      let cur: (typeof ranges)[0] | null = null;
      for (const c of thuLaiCau) {
        if (cur && c.n <= cur.ns[cur.ns.length - 1] + 2) {
          cur.to = c;
          cur.ns.push(c.n);
        } else {
          if (cur) ranges.push(cur);
          cur = { from: c, to: c, ns: [c.n] };
        }
      }
      if (cur) ranges.push(cur);

      t.push({
        id: "thu-lai",
        label: "Thu lại",
        icon: Mic,
        color: "text-amber-500",
        segments: ranges.map((r) => ({
          left: (r.from.batDauGiay / dur) * 100,
          width: Math.max(
            ((r.to.ketThucGiay - r.from.batDauGiay) / dur) * 100,
            0.5,
          ),
          bg: "bg-amber-200/70 dark:bg-amber-800/50 border border-dashed border-amber-400 dark:border-amber-600 hover:bg-amber-300/70 dark:hover:bg-amber-700/60",
          tooltip: `Thu lại câu ${r.ns.join(", ")}`,
          label: `${r.ns.length} câu`,
          onClick: () => onSeek(r.from.batDauGiay),
        })),
      });
    }

    // Track 3: Dựng lại
    if (brief && canhSet.size > 0) {
      const canhCau = script.cau.filter((c) => canhSet.has(c.n));
      t.push({
        id: "dung-lai",
        label: "Dựng lại",
        icon: Layers,
        color: "text-violet-500",
        segments: canhCau.map((c) => ({
          left: (c.batDauGiay / dur) * 100,
          width: Math.max(((c.ketThucGiay - c.batDauGiay) / dur) * 100, 0.5),
          bg: "bg-violet-200/60 dark:bg-violet-800/50 hover:bg-violet-300/60 dark:hover:bg-violet-700/60",
          tooltip: `Dựng lại cảnh câu ${c.n}`,
          label: String(c.n),
          onClick: () => onSeek(c.batDauGiay),
        })),
      });
    }

    // Track 4: Vùng bảo vệ
    if (brief && baoVeNs.size > 0) {
      const bvCau = script.cau.filter((c) => baoVeNs.has(c.n));
      // Gộp thành ranges
      const ranges: Array<{
        from: SentenceData;
        to: SentenceData;
        ns: number[];
      }> = [];
      let cur2: (typeof ranges)[0] | null = null;
      for (const c of bvCau) {
        if (cur2 && c.n <= cur2.ns[cur2.ns.length - 1] + 1) {
          cur2.to = c;
          cur2.ns.push(c.n);
        } else {
          if (cur2) ranges.push(cur2);
          cur2 = { from: c, to: c, ns: [c.n] };
        }
      }
      if (cur2) ranges.push(cur2);

      t.push({
        id: "bao-ve",
        label: "Bảo vệ",
        icon: Shield,
        color: "text-emerald-500",
        segments: ranges.map((r) => ({
          left: (r.from.batDauGiay / dur) * 100,
          width: Math.max(
            ((r.to.ketThucGiay - r.from.batDauGiay) / dur) * 100,
            0.5,
          ),
          bg: "bg-emerald-200/60 dark:bg-emerald-800/50 hover:bg-emerald-300/60 dark:hover:bg-emerald-700/60",
          tooltip: `Vùng bảo vệ câu ${r.ns.join(", ")}`,
          label: `🛡 ${r.ns.length}`,
          onClick: () => onSeek(r.from.batDauGiay),
        })),
      });
    }

    // Track 5: Mốc v2 (dịch mốc)
    if (brief && mocV2Map.size > 0) {
      const shifted = script.cau.filter((c) => {
        const moc = mocV2Map.get(c.n);
        if (!moc) return false;
        const origDur = c.ketThucGiay - c.batDauGiay;
        const newDur = moc.ketThuc - moc.batDau;
        return Math.abs(newDur - origDur) > 0.1;
      });

      if (shifted.length > 0) {
        t.push({
          id: "moc-v2",
          label: "Mốc v2",
          icon: TrendingUp,
          color: "text-sky-500",
          segments: shifted.map((c) => {
            const moc = mocV2Map.get(c.n)!;
            const origDur = c.ketThucGiay - c.batDauGiay;
            const newDur = moc.ketThuc - moc.batDau;
            const delta = newDur - origDur;
            return {
              left: (c.batDauGiay / dur) * 100,
              width: Math.max(
                ((c.ketThucGiay - c.batDauGiay) / dur) * 100,
                0.5,
              ),
              bg:
                delta > 0
                  ? "bg-sky-200/60 dark:bg-sky-800/50 hover:bg-sky-300/60"
                  : "bg-orange-200/60 dark:bg-orange-800/50 hover:bg-orange-300/60",
              tooltip: `Câu ${c.n}: ${delta > 0 ? "+" : ""}${delta.toFixed(1)}s`,
              label: `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`,
              onClick: () => onSeek(c.batDauGiay),
            };
          }),
        });
      }
    }

    return t;
  }, [script, brief, thuLaiSet, canhSet, baoVeNs, mocV2Map, dur, onSeek]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="rounded-xl border bg-card shadow-sm mt-3 overflow-hidden">
        {/* Header */}
        <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-2">
          <Timer className="size-3.5 text-primary" />
          <span className="text-xs font-bold text-foreground">
            Dòng thời gian
          </span>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {fmt(totalDuration)}
          </span>
        </div>

        {/* Tracks */}
        <div className="px-1 py-1.5 space-y-0.5">
          {tracks.map((track) => {
            const Icon = track.icon;
            return (
              <div key={track.id} className="flex items-center h-7 gap-0">
                {/* Label */}
                <div className="w-[56px] shrink-0 flex items-center gap-1 px-1">
                  <Icon className={`size-3 ${track.color}`} />
                  <span className="text-[9px] font-medium text-muted-foreground truncate">
                    {track.label}
                  </span>
                </div>

                {/* Timeline bar */}
                <div className="relative flex-1 h-full bg-muted/20 rounded-sm overflow-hidden">
                  {/* Segments */}
                  {track.segments.map((seg, i) => (
                    <Tooltip key={i}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className={`absolute top-0.5 bottom-0.5 rounded-[3px] flex items-center justify-center cursor-pointer transition-colors ${seg.bg}`}
                          style={{
                            left: `${seg.left}%`,
                            width: `${seg.width}%`,
                            minWidth: "4px",
                          }}
                          onClick={seg.onClick}
                        >
                          {seg.label && seg.width > 1.5 && (
                            <span className="text-[7px] font-medium text-foreground/70 truncate px-0.5">
                              {seg.label}
                            </span>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs max-w-xs">
                        {seg.tooltip}
                      </TooltipContent>
                    </Tooltip>
                  ))}

                  {/* Playhead */}
                  {playheadPct >= 0 && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-red-500 z-10 pointer-events-none"
                      style={{ left: `${playheadPct}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {/* Budget strip */}
          {brief && (
            <div className="flex items-center h-4 gap-0">
              <div className="w-[56px] shrink-0 px-1">
                <span className="text-[8px] font-medium text-muted-foreground">
                  Ngân sách
                </span>
              </div>
              <div className="relative flex-1 h-2.5 bg-muted/30 rounded-full overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                    budgetPct <= 60
                      ? "bg-emerald-500"
                      : budgetPct <= 90
                        ? "bg-amber-500"
                        : "bg-red-500"
                  }`}
                  style={{ width: `${budgetPct}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold text-foreground/60">
                  {brief.keHoach.thuLai.length}/{brief.nganSach.cauThuLai} câu
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

"use client";

import { useMemo } from "react";
import { AlertTriangle, Film, Mic, Timer, TrendingDown } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { RevisionBrief } from "@feedback/revision-core/types";

interface BudgetImpactBarProps {
  brief?: RevisionBrief;
  className?: string;
}

/** SVG circular gauge */
function CircularGauge({
  value,
  max,
  label,
  unit,
  color,
}: {
  value: number;
  max: number;
  label: string;
  unit: string;
  color: "green" | "amber" | "red" | "blue";
}) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const r = 22;
  const circ = 2 * Math.PI * r;
  const stroke = circ * pct;
  const colorMap = {
    green: {
      ring: "stroke-emerald-500",
      text: "text-emerald-600 dark:text-emerald-400",
    },
    amber: {
      ring: "stroke-amber-500",
      text: "text-amber-600 dark:text-amber-400",
    },
    red: { ring: "stroke-red-500", text: "text-red-600 dark:text-red-400" },
    blue: { ring: "stroke-sky-500", text: "text-sky-600 dark:text-sky-400" },
  };
  const c = colorMap[color];

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-14 h-14">
        <svg viewBox="0 0 52 52" className="w-full h-full -rotate-90">
          <circle
            cx="26"
            cy="26"
            r={r}
            fill="none"
            strokeWidth="4"
            className="stroke-muted/30"
          />
          <circle
            cx="26"
            cy="26"
            r={r}
            fill="none"
            strokeWidth="4"
            strokeDasharray={`${stroke} ${circ}`}
            strokeLinecap="round"
            className={`${c.ring} transition-all duration-500`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-sm font-bold ${c.text}`}>{value}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[9px] font-medium text-muted-foreground leading-tight">
          {label}
        </p>
        <p className="text-[8px] text-muted-foreground/70">{unit}</p>
      </div>
    </div>
  );
}

export default function BudgetImpactBar({
  brief,
  className,
}: BudgetImpactBarProps) {
  if (!brief) {
    return (
      <Card className={`rounded-xl border shadow-sm ${className ?? ""}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-muted/40 animate-pulse" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3 w-24 bg-muted/40 rounded animate-pulse" />
              <div className="h-2 w-32 bg-muted/30 rounded animate-pulse" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const kh = brief.keHoach;
  const ns = brief.nganSach;

  const cauUsed = kh.thuLai.length;
  const cauLimit = ns.cauThuLai || 8;
  const cauPct = cauUsed / cauLimit;

  const deltaSec = kh.deltaTong;
  const deltaLimit = ns.deltaTongGiay || 10;
  const deltaOver = Math.abs(deltaSec) > deltaLimit;

  const cauColor: "green" | "amber" | "red" =
    cauPct <= 0.6 ? "green" : cauPct <= 0.9 ? "amber" : "red";

  const violations = kh.viPham ?? [];

  return (
    <Card
      className={`rounded-xl border shadow-sm overflow-hidden ${className ?? ""}`}
    >
      <CardHeader className="p-3 pb-0">
        <CardTitle className="text-xs font-bold flex items-center gap-1.5">
          <Timer className="size-3.5 text-primary" />
          Ngân sách sản xuất
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        {/* 4 metric gauges */}
        <TooltipProvider delayDuration={200}>
          <div className="grid grid-cols-4 gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <CircularGauge
                    value={cauUsed}
                    max={cauLimit}
                    label="Câu thu lại"
                    unit={`/ ${cauLimit} câu`}
                    color={cauColor}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                {cauUsed} / {cauLimit} câu cần thu âm lại
                {cauPct > 0.9 && " — SẮP VƯỢT NGÂN SÁCH!"}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <CircularGauge
                    value={kh.kyTuThuLai}
                    max={3700}
                    label="Ký tự thu"
                    unit={`${Math.round((kh.kyTuThuLai / 3700) * 100)}%`}
                    color="blue"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                {kh.kyTuThuLai} ký tự cần thu lại
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <CircularGauge
                    value={kh.canhDungLai.length}
                    max={20}
                    label="Cảnh dựng"
                    unit={`${kh.canhDungLai.length} cảnh`}
                    color="blue"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                {kh.canhDungLai.length} cảnh cần dựng lại
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center ${
                      deltaOver
                        ? "border-red-400 bg-red-50 dark:bg-red-950/30"
                        : "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                    }`}
                  >
                    <TrendingDown
                      className={`size-3 ${deltaOver ? "text-red-500" : "text-emerald-500"}`}
                    />
                    <span
                      className={`text-xs font-bold ${deltaOver ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}
                    >
                      {deltaSec > 0 ? "+" : ""}
                      {deltaSec.toFixed(1)}s
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-medium text-muted-foreground leading-tight">
                      Δ Thời lượng
                    </p>
                    <p className="text-[8px] text-muted-foreground/70">
                      giới hạn ±{deltaLimit}s
                    </p>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                Thay đổi tổng thời lượng: {deltaSec > 0 ? "+" : ""}
                {deltaSec.toFixed(1)}s{deltaOver && " — VƯỢT NGÂN SÁCH!"}
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        {/* Phễu tóm tắt dạng strip */}
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground bg-muted/20 rounded-md px-2 py-1">
          <span className="font-semibold">{brief.pheu.gopY}</span> góp ý
          <span>→</span>
          <span className="font-semibold">{brief.pheu.vanDe}</span> vấn đề
          <span>→</span>
          <span className="font-semibold">{brief.pheu.deXuat}</span> đề xuất
          <span>→</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            {brief.pheu.quaThamDinh}
          </span>{" "}
          qua thẩm định
        </div>

        {/* Vi phạm */}
        {violations.length > 0 && (
          <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-2 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-3" />
              {violations.length} vi phạm ràng buộc
            </div>
            {violations.map((v, i) => (
              <p
                key={i}
                className="text-[9px] text-amber-800 dark:text-amber-300"
              >
                <Badge
                  variant="outline"
                  className="text-[8px] py-0 mr-1 border-amber-400"
                >
                  {v.ma}
                </Badge>
                {v.chiTiet}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

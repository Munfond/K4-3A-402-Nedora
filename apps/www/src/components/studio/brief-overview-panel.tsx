"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Film,
  HelpCircle,
  Loader2,
  Mic,
  Music,
  Shield,
  ShieldAlert,
  Subtitles,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import BudgetImpactBar from "./budget-impact-bar";
import WorkItemCards from "./work-item-cards";
import QuarantineDrawer from "./quarantine-drawer";
import type {
  RevisionBrief,
  FeedbackItem,
  ScriptData,
  RevisionRunResult,
} from "@feedback/revision-core/types";

interface BriefOverviewPanelProps {
  result: RevisionRunResult;
  script: ScriptData;
  runId: string;
  onSeek?: (seconds: number) => void;
  onExportV3?: () => void;
  isExporting?: boolean;
}

export default function BriefOverviewPanel({
  result,
  script,
  runId,
  onSeek,
  onExportV3,
  isExporting,
}: BriefOverviewPanelProps) {
  const brief = result.brief;
  const [quarantineOpen, setQuarantineOpen] = useState(false);
  const [funnelExpanded, setFunnelExpanded] = useState(true);

  if (!brief) {
    return (
      <Card className="rounded-xl border shadow-sm">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          <BarChart3 className="size-8 mx-auto mb-2 opacity-30" />
          <p>
            Brief chưa có — đợt phân tích chưa hoàn tất hoặc đang dùng phiên bản
            cũ (revision@2).
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <ScrollArea className="h-[calc(100vh-260px)]">
        <div className="space-y-3 pr-3">
          {/* Phễu tóm tắt */}
          <Collapsible open={funnelExpanded} onOpenChange={setFunnelExpanded}>
            <Card className="rounded-xl border shadow-sm overflow-hidden">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                      <BarChart3 className="size-3.5 text-primary" />
                      Phễu phân tích
                    </CardTitle>
                    {funnelExpanded ? (
                      <ChevronUp className="size-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-3.5 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="p-3 pt-0">
                  <FunnelStrip pheu={brief.pheu} />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Thanh ngân sách */}
          <BudgetImpactBar brief={brief} />

          {/* Nút cách ly */}
          {(result.quarantinedFeedback.length > 0 ||
            result.unassignedFeedback.length > 0) && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-xs h-8"
              onClick={() => setQuarantineOpen(true)}
            >
              <ShieldAlert className="size-3.5 text-amber-500" />
              Cách ly & Chờ duyệt
              <Badge
                variant="secondary"
                className="text-[10px] py-0 font-mono ml-auto"
              >
                {result.quarantinedFeedback.length +
                  result.unassignedFeedback.length}
              </Badge>
            </Button>
          )}

          {/* Danh sách việc theo vai trò */}
          <WorkItemCards brief={brief} onSeek={onSeek} />

          {/* Nút xuất v3 */}
          {onExportV3 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-xs h-9"
              onClick={onExportV3}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              Xuất gói sản xuất v3
            </Button>
          )}
        </div>
      </ScrollArea>

      {/* Quarantine drawer */}
      <QuarantineDrawer
        quarantinedFeedback={result.quarantinedFeedback}
        unassignedFeedback={result.unassignedFeedback}
        brief={brief}
        open={quarantineOpen}
        onOpenChange={setQuarantineOpen}
      />
    </TooltipProvider>
  );
}

// =====================
// Sub-component: Phễu
// =====================

function FunnelStrip({ pheu }: { pheu: RevisionBrief["pheu"] }) {
  const steps = [
    { label: "Góp ý", value: pheu.gopY, color: "bg-slate-500" },
    { label: "Cách ly", value: pheu.cachLy, color: "bg-red-500" },
    { label: "Chờ duyệt", value: pheu.choDuyet, color: "bg-amber-500" },
    { label: "Có ý", value: pheu.y, color: "bg-blue-500" },
    { label: "Vấn đề", value: pheu.vanDe, color: "bg-indigo-500" },
    { label: "Đề xuất", value: pheu.deXuat, color: "bg-violet-500" },
    {
      label: "Qua thẩm định",
      value: pheu.quaThamDinh,
      color: "bg-emerald-500",
    },
  ];

  return (
    <div className="space-y-2">
      {/* Visual funnel */}
      <div className="flex items-center gap-1">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center gap-0.5">
                  <div
                    className={`h-5 rounded-sm ${step.color} flex items-center justify-center min-w-[28px] px-1`}
                    style={{
                      opacity: step.value > 0 ? 1 : 0.2,
                    }}
                  >
                    <span className="text-[9px] font-bold text-white">
                      {step.value}
                    </span>
                  </div>
                  <span className="text-[8px] text-muted-foreground leading-none whitespace-nowrap">
                    {step.label}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {step.label}: {step.value}
              </TooltipContent>
            </Tooltip>
            {i < steps.length - 1 && (
              <span className="text-[8px] text-muted-foreground/50 mt-[-8px]">
                →
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Nhóm theo loại vấn đề */}
      {Object.keys(pheu.theoNhom).length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1 border-t border-dashed">
          {Object.entries(pheu.theoNhom).map(([key, count]) => (
            <Badge
              key={key}
              variant="outline"
              className="text-[9px] py-0 gap-0.5"
            >
              {key}: {count}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

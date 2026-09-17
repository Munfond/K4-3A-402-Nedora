"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dinhDangPhut } from "@/lib/revision/format";
import type { DecisionCase, DecisionRecord } from "@/lib/revision/types";

interface CaseListColumnProps {
  cases: DecisionCase[];
  selectedCaseId: string;
  onSelectCase: (caseId: string) => void;
  decisions: Record<string, DecisionRecord>;
}

type FilterStatus = "all" | "pending" | "chosen" | "deferred" | "rejected";

export default function CaseListColumn({
  cases,
  selectedCaseId,
  onSelectCase,
  decisions,
}: CaseListColumnProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const dec = decisions[c.id];

      // Filter by status
      if (statusFilter === "pending" && dec?.type) return false;
      if (statusFilter === "chosen" && dec?.type !== "chon") return false;
      if (statusFilter === "deferred" && dec?.type !== "hoan") return false;
      if (statusFilter === "rejected" && dec?.type !== "bo") return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = c.id.toLowerCase().includes(q);
        const matchTitle = c.title.toLowerCase().includes(q);
        const matchSentence = c.sentenceNs.some(
          (n) => `câu ${n}`.includes(q) || `${n}` === q,
        );
        const matchIssue = c.issues.some((iss) =>
          iss.summary.toLowerCase().includes(q),
        );
        if (!matchId && !matchTitle && !matchSentence && !matchIssue) {
          return false;
        }
      }

      return true;
    });
  }, [cases, decisions, statusFilter, searchQuery]);

  const counts = useMemo(() => {
    let pending = 0;
    let chosen = 0;
    let deferred = 0;
    let rejected = 0;

    for (const c of cases) {
      const dec = decisions[c.id];
      if (!dec?.type) {
        pending++;
      } else if (dec.type === "chon") {
        chosen++;
      } else if (dec.type === "hoan") {
        deferred++;
      } else if (dec.type === "bo") {
        rejected++;
      }
    }

    return { total: cases.length, pending, chosen, deferred, rejected };
  }, [cases, decisions]);

  return (
    <div className="flex flex-col h-full bg-card border rounded-xl overflow-hidden shadow-xs">
      {/* HEADER & SEARCH */}
      <div className="p-3 border-b space-y-2.5 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs tracking-wider uppercase text-muted-foreground">
              Vùng sửa gom được
            </span>
            <Badge
              variant="secondary"
              className="text-[11px] font-mono px-1.5 py-0"
            >
              {filteredCases.length}/{cases.length}
            </Badge>
          </div>
          {counts.chosen > 0 && (
            <span className="text-[11px] text-green-600 font-medium">
              Đã chọn {counts.chosen}/{cases.length}
            </span>
          )}
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Tìm theo mã vùng, câu, từ khóa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-background"
          />
        </div>

        {/* Quick status filter pills */}
        <div className="flex flex-wrap items-center gap-1 text-[11px]">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
              statusFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Tất cả ({counts.total})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("pending")}
            className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
              statusFilter === "pending"
                ? "bg-amber-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Chờ ({counts.pending})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("chosen")}
            className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
              statusFilter === "chosen"
                ? "bg-green-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Đã chọn ({counts.chosen})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("deferred")}
            className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
              statusFilter === "deferred"
                ? "bg-amber-700 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Hoãn ({counts.deferred})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("rejected")}
            className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
              statusFilter === "rejected"
                ? "bg-neutral-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Giữ ({counts.rejected})
          </button>
        </div>
      </div>

      {/* CASE LIST */}
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {filteredCases.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-xs">
            Không tìm thấy vùng sửa nào phù hợp bộ lọc.
          </div>
        ) : (
          filteredCases.map((c) => {
            const isSelected = c.id === selectedCaseId;
            const dec = decisions[c.id];

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectCase(c.id)}
                className={`w-full text-left p-3.5 transition-all flex flex-col gap-2 ${
                  isSelected
                    ? "bg-primary/5 border-l-4 border-l-primary shadow-2xs"
                    : "hover:bg-muted/40"
                }`}
              >
                {/* ID & Status */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-xs bg-muted px-1.5 py-0.5 rounded border">
                      {c.id}
                    </span>
                    {c.type === "can-xac-nhan" ? (
                      <Badge
                        variant="outline"
                        className="bg-amber-50 text-amber-700 border-amber-300 text-[10px] px-1 py-0 dark:bg-amber-950 dark:text-amber-300"
                      >
                        Vị trí suy đoán
                      </Badge>
                    ) : c.type === "ky-thuat" ? (
                      <Badge
                        variant="outline"
                        className="bg-sky-50 text-sky-700 border-sky-300 text-[10px] px-1 py-0 dark:bg-sky-950 dark:text-sky-300"
                      >
                        Kỹ thuật
                      </Badge>
                    ) : null}
                  </div>

                  {/* Decision status badge */}
                  {dec?.type === "chon" ? (
                    <Badge className="bg-green-600 text-white text-[10px] px-1.5 py-0 font-medium">
                      Đã chọn {dec.optionId?.split("-").pop()?.toUpperCase()}
                    </Badge>
                  ) : dec?.type === "hoan" ? (
                    <Badge className="bg-amber-600 text-white text-[10px] px-1.5 py-0 font-medium">
                      Đã hoãn
                    </Badge>
                  ) : dec?.type === "bo" ? (
                    <Badge className="bg-neutral-600 text-white text-[10px] px-1.5 py-0 font-medium">
                      Giữ nguyên
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-muted-foreground text-[10px] px-1.5 py-0"
                    >
                      Chờ duyệt
                    </Badge>
                  )}
                </div>

                {/* Title */}
                <h4
                  className={`text-xs font-semibold line-clamp-2 leading-snug ${
                    isSelected ? "text-primary font-bold" : "text-foreground"
                  }`}
                >
                  {c.title}
                </h4>

                {/* Metadata: Sentences + Timecode */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3 shrink-0" />
                    Câu {c.sentenceNs.join(", ")} ({dinhDangPhut(c.tuGiay)}–
                    {dinhDangPhut(c.denGiay)})
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3 shrink-0" />
                    {c.independentSenders} người ({c.mentions} lượt)
                  </span>
                </div>

                {/* Disagreement / Highlight badge */}
                {c.hasDisagreement && (
                  <div className="pt-0.5">
                    <Badge
                      variant="outline"
                      className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0 dark:bg-amber-950 dark:text-amber-300"
                    >
                      ⚠️ Có ý kiến trái chiều
                    </Badge>
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

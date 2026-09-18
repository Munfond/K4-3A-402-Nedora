"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";
import {
  computeWordDiff,
  getDiffStats,
  type DiffPart,
} from "@/lib/studio/word-diff";

interface WordDiffDisplayProps {
  before: string;
  after: string;
  className?: string;
  showStats?: boolean;
}

export default function WordDiffDisplay({
  before,
  after,
  className,
  showStats = false,
}: WordDiffDisplayProps) {
  const parts = useMemo(() => computeWordDiff(before, after), [before, after]);
  const stats = useMemo(() => getDiffStats(parts), [parts]);

  if (stats.isUnchanged) {
    return (
      <div
        className={`flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 ${className ?? ""}`}
      >
        <Check className="size-3.5" />
        <span>Không thay đổi</span>
      </div>
    );
  }

  const deltaChars = stats.insertedChars - stats.deletedChars;

  return (
    <div className={className}>
      <div className="font-mono text-sm leading-relaxed">
        {parts.map((part, i) => {
          if (part.type === "equal") {
            return <span key={i}>{part.value}</span>;
          }
          if (part.type === "delete") {
            return (
              <span
                key={i}
                className="bg-red-100 dark:bg-red-900/40 line-through text-red-700 dark:text-red-300 rounded-sm px-0.5"
              >
                {part.value}
              </span>
            );
          }
          // insert
          return (
            <span
              key={i}
              className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-sm px-0.5"
            >
              {part.value}
            </span>
          );
        })}
      </div>

      {showStats && (
        <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
          {stats.insertedWords > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400">
              +{stats.insertedWords} từ thêm
            </span>
          )}
          {stats.deletedWords > 0 && (
            <span className="text-red-600 dark:text-red-400">
              −{stats.deletedWords} từ bớt
            </span>
          )}
          <span>
            Δ {deltaChars > 0 ? "+" : ""}
            {deltaChars} ký tự
          </span>
        </div>
      )}
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { Grid3X3 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { IssueItem } from "@feedback/revision-core/types";

interface RoutingMatrixProps {
  issues: IssueItem[];
  className?: string;
}

// Intent (Category) labels
const INTENT_LABELS: Record<string, string> = {
  "noi-dung-sai": "Nội dung sai",
  "kho-hieu": "Khó hiểu",
  "nhip-nhanh-cham": "Nhịp nhanh/chậm",
  "giong-doc": "Giọng đọc",
  "hinh-anh": "Hình ảnh",
  "loi-ky-thuat": "Lỗi kỹ thuật",
};

// Handler (nhom) labels from router
const HANDLER_LABELS: Record<string, string> = {
  "sua-loi": "Sửa lời",
  "nhip-toc-do": "Nhịp/tốc độ",
  "nhip-khoang-dung": "Khoảng dừng",
  "am-thanh": "Âm thanh",
  "hinh-anh": "Hình ảnh",
  "phu-de": "Phụ đề",
  "cau-hoi": "Câu hỏi",
  "khen-giu": "Khen/giữ",
  "de-nghi-chung": "Đề nghị chung",
  "ky-thuat": "Kỹ thuật",
};

export default function RoutingMatrix({
  issues,
  className,
}: RoutingMatrixProps) {
  // Build matrix: intent → handler → count
  const { matrix, intents, handlers } = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    const intentSet = new Set<string>();
    const handlerSet = new Set<string>();

    for (const issue of issues) {
      const intent = issue.category;
      // Infer handler from issue key prefix
      const handler = issue.key.split(":")[0] || intent;
      intentSet.add(intent);
      handlerSet.add(handler);

      if (!m.has(intent)) m.set(intent, new Map());
      const row = m.get(intent)!;
      row.set(handler, (row.get(handler) ?? 0) + 1);
    }

    return {
      matrix: m,
      intents: Array.from(intentSet),
      handlers: Array.from(handlerSet),
    };
  }, [issues]);

  if (issues.length === 0) {
    return null;
  }

  return (
    <Card
      className={`rounded-xl border shadow-sm overflow-hidden ${className ?? ""}`}
    >
      <CardHeader className="p-3 pb-0">
        <CardTitle className="text-xs font-bold flex items-center gap-1.5">
          <Grid3X3 className="size-3.5 text-primary" />
          Ma trận định tuyến
          <Badge variant="secondary" className="text-[9px] py-0 font-mono ml-1">
            {issues.length} vấn đề
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <TooltipProvider delayDuration={150}>
          <div className="overflow-x-auto">
            <table className="w-full text-[9px]">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">
                    Intent ↓ / Bộ xử lý →
                  </th>
                  {handlers.map((h) => (
                    <th
                      key={h}
                      className="px-2 py-1.5 text-center font-semibold"
                    >
                      <Tooltip>
                        <TooltipTrigger className="cursor-default">
                          {HANDLER_LABELS[h] ?? h}
                        </TooltipTrigger>
                        <TooltipContent>{h}</TooltipContent>
                      </Tooltip>
                    </th>
                  ))}
                  <th className="px-2 py-1.5 text-center font-semibold text-muted-foreground">
                    Σ
                  </th>
                </tr>
              </thead>
              <tbody>
                {intents.map((intent) => {
                  const row = matrix.get(intent);
                  const rowTotal = handlers.reduce(
                    (s, h) => s + (row?.get(h) ?? 0),
                    0,
                  );
                  return (
                    <tr
                      key={intent}
                      className="border-b border-muted/30 hover:bg-muted/20"
                    >
                      <td className="px-2 py-1.5 font-medium">
                        {INTENT_LABELS[intent] ?? intent}
                      </td>
                      {handlers.map((h) => {
                        const count = row?.get(h) ?? 0;
                        return (
                          <td key={h} className="px-2 py-1.5 text-center">
                            {count > 0 ? (
                              <Badge
                                className={`text-[8px] px-1.5 py-0 ${
                                  count >= 3
                                    ? "bg-red-500 text-white"
                                    : count >= 2
                                      ? "bg-amber-500 text-white"
                                      : "bg-primary/80 text-primary-foreground"
                                }`}
                              >
                                {count}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground/20">
                                ·
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-2 py-1.5 text-center font-bold text-muted-foreground">
                        {rowTotal}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2">
                  <td className="px-2 py-1.5 font-semibold text-muted-foreground">
                    Σ
                  </td>
                  {handlers.map((h) => {
                    const colTotal = intents.reduce(
                      (s, i) => s + (matrix.get(i)?.get(h) ?? 0),
                      0,
                    );
                    return (
                      <td
                        key={h}
                        className="px-2 py-1.5 text-center font-bold text-muted-foreground"
                      >
                        {colTotal}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-center font-bold text-primary">
                    {issues.length}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}

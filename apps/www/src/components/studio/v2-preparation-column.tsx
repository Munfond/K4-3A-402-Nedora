"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clapperboard,
  FileCode,
  FileText,
  HelpCircle,
  Info,
  Layers,
  Mic,
  Subtitles,
  Volume2,
  X,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ReleaseSnapshot, ScriptData } from "@/lib/revision/types";

interface V2PreparationColumnProps {
  snapshot: ReleaseSnapshot;
  script: ScriptData;
  runId: string;
}

export default function V2PreparationColumn({
  snapshot,
  script,
  runId,
}: V2PreparationColumnProps) {
  const [showSentenceDetailDialog, setShowSentenceDetailDialog] =
    useState(false);

  // Câu đổi lời trực tiếp (không tính câu ngữ cảnh)
  const cauDoiLoi = useMemo(() => {
    const origMap = new Map(script.cau.map((c) => [c.n, c]));
    return snapshot.draftSentences.filter((draft) => {
      const orig = origMap.get(draft.n);
      if (!orig) return false;
      return (draft.loi || "").trim() !== (orig.loi || "").trim();
    });
  }, [script, snapshot]);

  // Phân tích lý do từng câu cần thu lại (đổi trực tiếp vs nối giọng ±1)
  const chiTietCauThuLai = useMemo(() => {
    const directSet = new Set(cauDoiLoi.map((c) => c.n));
    const origMap = new Map(script.cau.map((c) => [c.n, c]));
    const draftMap = new Map(snapshot.draftSentences.map((c) => [c.n, c]));

    return snapshot.summary.cauThuLai
      .slice()
      .sort((a, b) => a - b)
      .map((n) => {
        const isDirect = directSet.has(n);
        const draft = draftMap.get(n);
        const orig = origMap.get(n);

        // Tìm lý do từ work items
        const wi = snapshot.workItems.find((w) => w.key === `thu-lai:${n}`);
        const reasons = wi?.reasons.map((r) => r.text) || [];

        return {
          n,
          isDirect,
          draftText: draft?.loi || "",
          origText: orig?.loi || "",
          charCount: draft?.soKyTu || 0,
          reasons:
            reasons.length > 0
              ? reasons
              : [
                  isDirect
                    ? "Đổi lời trực tiếp từ phương án duyệt"
                    : "Ngữ cảnh trước/sau để nối giọng tự nhiên",
                ],
        };
      });
  }, [cauDoiLoi, script, snapshot]);

  const tiLeKyTu =
    snapshot.summary.tongKyTuGoc > 0
      ? Math.round(
          (snapshot.summary.soKyTuThuLai / snapshot.summary.tongKyTuGoc) * 100,
        )
      : 0;

  const hasConflicts = snapshot.conflicts.length > 0;

  return (
    <div className="flex flex-col h-full bg-card border rounded-xl overflow-hidden shadow-xs">
      {/* HEADER */}
      <div className="p-3.5 border-b bg-muted/20 space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-xs tracking-wider uppercase text-muted-foreground">
            Đang chuẩn bị bản sửa v2
          </span>
          <Badge
            variant="outline"
            className="text-[10px] bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 font-mono"
          >
            Thời gian thực
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">
          Cập nhật tức thì theo từng quyết định duyệt ở cột giữa, tự động tính
          dồn và loại bỏ việc trùng lặp.
        </p>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs">
        {/* CẢNH BÁO XUNG ĐỘT NẾU CÓ (CONFLICT_SAME_FIELD) */}
        {hasConflicts && (
          <div className="rounded-lg border-2 border-red-500 bg-red-50/90 p-3 text-red-950 dark:bg-red-950/60 dark:text-red-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-xs text-red-700 dark:text-red-400">
              <AlertTriangle className="size-4 shrink-0" />
              <span>Xung đột ghi đè ({snapshot.conflicts.length})</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Các phương án dưới đây cùng sửa một vị trí với câu từ khác nhau.
              Hệ thống đã chặn áp dụng để tránh lỗi sản xuất:
            </p>
            <div className="space-y-1.5">
              {snapshot.conflicts.map((cf, i) => (
                <div
                  key={i}
                  className="rounded bg-background p-2 text-[11px] border border-red-300 dark:border-red-900 space-y-1"
                >
                  <p className="font-bold font-mono text-foreground">
                    Câu {cf.n}, trường '{cf.field}':
                  </p>
                  <ul className="list-disc ml-4 space-y-0.5 text-muted-foreground">
                    {cf.values.map((v, idx) => (
                      <li key={idx}>
                        Vùng <strong>{v.caseId}</strong> (Phương án {v.optionId}
                        ): "{v.value}"
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4 THỐNG KÊ CÔNG VIỆC CHÍNH */}
        <div className="space-y-2">
          <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
            Khối lượng sản xuất dự kiến
          </span>

          <div className="grid gap-2">
            {/* 1. Câu đổi lời trực tiếp */}
            <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-foreground">
                    Câu đổi lời trực tiếp
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Nội dung thay đổi trên kịch bản
                  </p>
                </div>
              </div>
              <span className="font-bold font-mono text-base text-foreground">
                {cauDoiLoi.length}
              </span>
            </div>

            {/* 2. Câu cần thu lại (kèm nút xem chi tiết lý do) */}
            <div className="p-2.5 rounded-lg border bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mic className="size-4 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">
                      Câu cần thu âm lại
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Gồm cả ngữ cảnh ±1 nối giọng
                    </p>
                  </div>
                </div>
                <span className="font-bold font-mono text-base text-foreground">
                  {snapshot.summary.cauThuLai.length}
                </span>
              </div>

              {/* Nút xem chi tiết lý do */}
              {snapshot.summary.cauThuLai.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSentenceDetailDialog(true)}
                  className="w-full text-[11px] h-7 gap-1 bg-background"
                >
                  <Info className="size-3 text-primary" /> Xem danh sách câu &
                  lý do thu
                </Button>
              )}
            </div>

            {/* 3. Cảnh cần cập nhật hình ảnh */}
            <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20">
              <div className="flex items-center gap-2">
                <Clapperboard className="size-4 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-foreground">
                    Cảnh cần cập nhật
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Chữ màn hình hoặc ý đồ dựng
                  </p>
                </div>
              </div>
              <span className="font-bold font-mono text-base text-foreground">
                {snapshot.summary.canhDungLai.length}
              </span>
            </div>

            {/* 4. Đoạn phụ đề cần xử lý */}
            <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20">
              <div className="flex items-center gap-2">
                <Subtitles className="size-4 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-foreground">
                    Phụ đề cần xử lý
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Khớp lại timecode và text
                  </p>
                </div>
              </div>
              <span className="font-bold font-mono text-base text-foreground">
                {snapshot.summary.phuDeSua.length}
              </span>
            </div>
          </div>
        </div>

        {/* THỐNG KÊ PHẦN VIỆC TĂNG THÊM (KHÔNG TÍNH TRÙNG) */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-green-600" /> Thống kê gói
            sửa không trùng việc
          </span>
          <div className="space-y-1 text-[11px] text-muted-foreground leading-relaxed">
            <p>
              • Tổng ký tự thu mới:{" "}
              <strong>{snapshot.summary.soKyTuThuLai}</strong> /{" "}
              {snapshot.summary.tongKyTuGoc} ({tiLeKyTu}% kịch bản).
            </p>
            <p>
              • Phương án áp dụng:{" "}
              <strong>{snapshot.appliedOptionIds.length}</strong> phương án.
            </p>
            <p className="text-[10px] text-muted-foreground/80 italic border-t pt-1">
              Hệ thống tự động hợp nhất các câu liền kề hoặc chồng lấn giữa các
              vùng sửa, đảm bảo mỗi câu chỉ giao thu âm đúng 1 lần.
            </p>
          </div>
        </div>

        {/* GHI CHÚ KỸ THUẬT */}
        <div className="rounded-lg border border-border/80 p-2.5 text-[10px] text-muted-foreground leading-snug">
          <strong>Lưu ý:</strong> Độ dài các câu thu lại sẽ đổi và mốc phía sau
          cần dịch; bản v2 này chuẩn bị sẵn kịch bản và danh sách việc để chuyển
          sang phòng thu.
        </div>
      </div>

      {/* FOOTER ACTION: NÚT XEM BẢN SỬA V2 */}
      <div className="p-3 border-t bg-muted/20">
        <Link href={`/xuat?run=${runId}` as any}>
          <Button
            className="w-full gap-2 text-xs font-semibold h-9 shadow-xs"
            disabled={hasConflicts}
          >
            <span>Xem bản sửa v2</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </Link>
        {hasConflicts && (
          <p className="text-[10px] text-red-600 mt-1 text-center font-medium">
            Cần giải quyết xung đột ở cột giữa trước khi chuyển tiếp
          </p>
        )}
      </div>

      {/* DIALOG CHI TIẾT CÂU CẦN THU LẠI & LÝ DO */}
      {showSentenceDetailDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="max-w-xl w-full max-h-[80vh] flex flex-col p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Mic className="size-4 text-primary" />
                Danh sách câu cần thu lại ({chiTietCauThuLai.length} câu)
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowSentenceDetailDialog(false)}
                className="h-7 w-7 p-0"
              >
                <X className="size-4" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Bao gồm các câu có lời mới trực tiếp và các câu liền kề (ngữ cảnh
              trước/sau) cần đọc lại để giữ âm sắc và nối giọng tự nhiên:
            </p>

            <div className="flex-1 overflow-y-auto divide-y rounded-lg border text-xs">
              {chiTietCauThuLai.map((item) => (
                <div key={item.n} className="p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground">
                        Câu {item.n}
                      </span>
                      {item.isDirect ? (
                        <Badge className="bg-green-600 text-white text-[10px] py-0">
                          Đổi lời trực tiếp
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0 bg-muted"
                        >
                          Ngữ cảnh nối giọng
                        </Badge>
                      )}
                      <span className="text-muted-foreground text-[11px]">
                        ({item.charCount} ký tự)
                      </span>
                    </div>
                  </div>

                  <p className="text-foreground bg-muted/30 p-2 rounded text-[11px]">
                    "{item.draftText}"
                  </p>

                  <div className="text-[10px] text-muted-foreground">
                    <span className="font-semibold">Lý do: </span>
                    {item.reasons.join("; ")}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                size="sm"
                onClick={() => setShowSentenceDetailDialog(false)}
              >
                Đóng
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

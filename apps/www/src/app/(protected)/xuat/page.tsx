"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  AlertTriangle,
  Clapperboard,
  Download,
  FileCode,
  FileSpreadsheet,
  FileText,
  Layers,
  Mic,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import PageWrapper from "@/components/page-wrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getLastRunId, useQuyetDinh } from "@/hooks/use-quyet-dinh";
import { computeReleaseSnapshot } from "@/lib/revision/engine";
import type { RevisionRunResult, RunMetadata } from "@/lib/revision/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function XuatPage() {
  const searchParams = useSearchParams();
  const queryRunId = searchParams.get("run");
  const [activeRunId, setActiveRunId] = useState<string>(queryRunId || "");

  useEffect(() => {
    if (queryRunId) {
      setActiveRunId(queryRunId);
    } else {
      const last = getLastRunId();
      if (last) setActiveRunId(last);
    }
  }, [queryRunId]);

  const { bang, xoaHet, isStorageFailed } = useQuyetDinh(activeRunId);

  const { data, isLoading } = useSWR<{
    run: RunMetadata;
    result?: RevisionRunResult;
  }>(activeRunId ? `/api/revisions/runs/${activeRunId}` : null, fetcher);

  const result = data?.result;
  const script = result?.script;
  const cases = result?.cases || [];

  const [downloading, setDownloading] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Tính toán release snapshot từ script, cases và decisions trong hook
  const snapshot =
    script && cases.length > 0
      ? computeReleaseSnapshot({
          runId: activeRunId,
          inputHash: result?.inputHash || "",
          script,
          cases,
          decisions: bang,
        })
      : null;

  const handleDownloadFile = async (
    fileType:
      | "kich-ban-v2.json"
      | "kich-ban-v2.md"
      | "viec-can-lam.csv"
      | "truy-vet.json",
  ) => {
    if (!activeRunId) return;
    setDownloading(fileType);
    setExportError(null);

    try {
      const res = await fetch(`/api/revisions/runs/${activeRunId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decisions: bang,
          file: fileType,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(
          data.error?.message || `Lỗi xuất file (HTTP ${res.status})`,
        );
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileType;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(null);
    }
  };

  if (isLoading) {
    return (
      <PageWrapper className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground text-sm">
          Đang tải gói phát hành...
        </p>
      </PageWrapper>
    );
  }

  if (!result || !script || !snapshot) {
    return (
      <PageWrapper className="p-10 text-center space-y-4">
        <p className="text-muted-foreground">
          Chưa có lượt phân tích nào được chọn.
        </p>
        <Link href="/">
          <Button size="sm" className="gap-2">
            <Sparkles className="size-4" /> Đến trang phân tích
          </Button>
        </Link>
      </PageWrapper>
    );
  }

  const tiLeKyTu =
    snapshot.summary.tongKyTuGoc > 0
      ? Math.round(
          (snapshot.summary.soKyTuThuLai / snapshot.summary.tongKyTuGoc) * 100,
        )
      : 0;

  const hasConflicts = snapshot.conflicts.length > 0;

  return (
    <PageWrapper className="overflow-y-auto pb-24">
      <div className="mx-auto mt-6 w-full max-w-5xl space-y-6 px-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-bold text-2xl dark:text-neutral-50 sm:text-3xl">
              Gói bàn giao phiên bản mới
            </h1>
            <p className="mt-1 text-muted-foreground text-sm">
              Tự động tính lại toàn bộ kịch bản và khối lượng công việc sau các
              quyết định duyệt.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={xoaHet}
              className="gap-1.5 text-xs text-muted-foreground"
            >
              <RotateCcw className="size-3.5" /> Xóa mọi quyết định của lượt này
            </Button>
          </div>
        </div>

        {/* CẢNH BÁO STORAGE THẤT BẠI C3-STO-03 */}
        {isStorageFailed && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-800 text-xs dark:bg-amber-950/40 dark:text-amber-300">
            Chưa lưu vào trình duyệt (localStorage bị chặn) — tải lại trang sẽ
            mất các quyết định!
          </div>
        )}

        {/* KHỐI CẢNH BÁO XUNG ĐỘT (C3-ENG-03, C3-EXP-01) */}
        {hasConflicts && (
          <div className="rounded-lg border-2 border-red-500 bg-red-50 p-4 text-red-950 dark:bg-red-950/50 dark:text-red-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-red-700 dark:text-red-400">
              <AlertTriangle className="size-5 shrink-0" />
              <span>
                CẢNH BÁO: Có {snapshot.conflicts.length} xung đột ghi đè chưa
                được giải quyết!
              </span>
            </div>
            <p className="text-xs">
              Các phương án dưới đây đang cùng ghi vào một trường của cùng một
              câu với giá trị khác nhau. Mọi phương án liên quan bị chặn áp dụng
              cho tới khi người duyệt điều chỉnh lại lựa chọn:
            </p>
            <div className="space-y-1.5 pt-1">
              {snapshot.conflicts.map((cf, i) => (
                <div
                  key={i}
                  className="rounded bg-background/80 p-2.5 text-xs border border-red-200 dark:border-red-900 space-y-1"
                >
                  <p className="font-mono font-bold">
                    Câu {cf.n}, trường '{cf.field}':
                  </p>
                  <ul className="list-disc ml-4 space-y-0.5">
                    {cf.values.map((v, idx) => (
                      <li key={idx}>
                        Hồ sơ <strong>{v.caseId}</strong> (Phương án{" "}
                        {v.optionId}): "{v.value}"
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LỖI XUẤT */}
        {exportError && (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-red-800 text-xs dark:bg-red-950/40 dark:text-red-300">
            {exportError}
          </div>
        )}

        {/* THẺ TỔNG CÔNG VIỆC C3-ENG-06 */}
        <div className="grid gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Mic className="size-5 text-primary" />
              <div>
                <p className="font-semibold text-2xl">
                  {snapshot.summary.cauThuLai.length}
                </p>
                <p className="text-muted-foreground text-xs">
                  Câu thu lại giọng
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Clapperboard className="size-5 text-primary" />
              <div>
                <p className="font-semibold text-2xl">
                  {snapshot.summary.soKyTuThuLai}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    / {snapshot.summary.tongKyTuGoc}
                  </span>
                </p>
                <p className="text-muted-foreground text-xs">
                  Ký tự lời mới ({tiLeKyTu}%)
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Layers className="size-5 text-primary" />
              <div>
                <p className="font-semibold text-2xl">
                  {snapshot.summary.canhDungLai.length}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    / {snapshot.summary.tongCanh}
                  </span>
                </p>
                <p className="text-muted-foreground text-xs">Cảnh dựng lại</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <FileText className="size-5 text-primary" />
              <div>
                <p className="font-semibold text-2xl">
                  {snapshot.summary.phuDeSua.length}
                </p>
                <p className="text-muted-foreground text-xs">Phụ đề cần sửa</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* GHI CHÚ BẮT BUỘC C3-ENG-07 */}
        <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          <strong>Ghi chú kỹ thuật:</strong> Độ dài các câu thu lại sẽ đổi và
          mốc phía sau cần dịch; bản CP3 chưa tính phần này.
        </div>

        {/* 4 NÚT TẢI FILE BÀN GIAO THẬT (C3-EXP) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Tải gói bàn giao cho sản xuất</span>
              <span className="text-xs font-normal text-muted-foreground font-mono">
                {snapshot.appliedOptionIds.length} phương án áp dụng
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                disabled={hasConflicts || downloading !== null}
                onClick={() => handleDownloadFile("kich-ban-v2.json")}
                className="justify-start gap-2 h-auto py-3 text-xs"
              >
                <FileCode className="size-4 text-primary shrink-0" />
                <div className="text-left">
                  <p className="font-semibold">kich-ban-v2.json</p>
                  <p className="text-muted-foreground text-[11px]">
                    Kịch bản mới có lời thay thế, giữ cấu trúc 40 câu
                  </p>
                </div>
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={hasConflicts || downloading !== null}
                onClick={() => handleDownloadFile("kich-ban-v2.md")}
                className="justify-start gap-2 h-auto py-3 text-xs"
              >
                <FileText className="size-4 text-primary shrink-0" />
                <div className="text-left">
                  <p className="font-semibold">kich-ban-v2.md</p>
                  <p className="text-muted-foreground text-[11px]">
                    Kịch bản Markdown định dạng chuẩn theo mẫu
                  </p>
                </div>
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={hasConflicts || downloading !== null}
                onClick={() => handleDownloadFile("viec-can-lam.csv")}
                className="justify-start gap-2 h-auto py-3 text-xs"
              >
                <FileSpreadsheet className="size-4 text-primary shrink-0" />
                <div className="text-left">
                  <p className="font-semibold">viec-can-lam.csv</p>
                  <p className="text-muted-foreground text-[11px]">
                    Bảng phân công: câu thu lại, ký tự, cảnh, phụ đề, lý do
                  </p>
                </div>
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={hasConflicts || downloading !== null}
                onClick={() => handleDownloadFile("truy-vet.json")}
                className="justify-start gap-2 h-auto py-3 text-xs"
              >
                <Download className="size-4 text-primary shrink-0" />
                <div className="text-left">
                  <p className="font-semibold">truy-vet.json</p>
                  <p className="text-muted-foreground text-[11px]">
                    Báo cáo truy vết 100% từ quyết định tới góp ý gốc
                  </p>
                </div>
              </Button>
            </div>

            {hasConflicts && (
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                Vui lòng giải quyết các xung đột ghi đè trước khi tải gói xuất.
              </p>
            )}
          </CardContent>
        </Card>

        {/* SO SÁNH TRƯỚC / SAU THEO CÂU */}
        <div className="space-y-3">
          <h2 className="font-semibold text-base">
            Nội dung thay đổi trên kịch bản (Trước / Sau)
          </h2>
          {snapshot.appliedOptionIds.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-xs">
              Chưa có phương án nào được chọn để áp dụng. Kịch bản giữ nguyên
              bản gốc.
            </p>
          ) : (
            <div className="rounded-lg border bg-card divide-y text-xs">
              {snapshot.draftSentences
                .filter((draft) => {
                  const orig = script.cau.find((c) => c.n === draft.n);
                  if (!orig) return false;
                  return (
                    (draft.loi || "") !== (orig.loi || "") ||
                    (draft.chuTrenManHinh || "") !==
                      (orig.chuTrenManHinh || "") ||
                    (draft.yDoHinh || "") !== (orig.yDoHinh || "")
                  );
                })
                .map((draft) => {
                  const orig = script.cau.find((c) => c.n === draft.n)!;
                  return (
                    <div key={draft.n} className="p-4 space-y-2">
                      <span className="font-bold text-sm text-foreground">
                        Câu {draft.n}:
                      </span>
                      {draft.loi !== orig.loi && (
                        <div className="space-y-1">
                          <span className="text-muted-foreground font-medium">
                            Lời đọc:
                          </span>
                          <div className="rounded bg-red-50 dark:bg-red-950/30 p-2 border-l-2 border-red-500 text-red-900 dark:text-red-300">
                            <strong>Gốc:</strong> {orig.loi}
                          </div>
                          <div className="rounded bg-green-50 dark:bg-green-950/30 p-2 border-l-2 border-green-500 text-green-900 dark:text-green-300">
                            <strong>Mới:</strong> {draft.loi}
                          </div>
                        </div>
                      )}
                      {draft.chuTrenManHinh !== orig.chuTrenManHinh && (
                        <div className="space-y-1">
                          <span className="text-muted-foreground font-medium">
                            Chữ màn hình:
                          </span>
                          <div className="rounded bg-red-50 dark:bg-red-950/30 p-2 border-l-2 border-red-500">
                            <strong>Gốc:</strong> {orig.chuTrenManHinh}
                          </div>
                          <div className="rounded bg-green-50 dark:bg-green-950/30 p-2 border-l-2 border-green-500">
                            <strong>Mới:</strong> {draft.chuTrenManHinh}
                          </div>
                        </div>
                      )}
                      {draft.yDoHinh !== orig.yDoHinh && (
                        <div className="space-y-1">
                          <span className="text-muted-foreground font-medium">
                            Ý đồ hình:
                          </span>
                          <div className="rounded bg-red-50 dark:bg-red-950/30 p-2 border-l-2 border-red-500">
                            <strong>Gốc:</strong> {orig.yDoHinh}
                          </div>
                          <div className="rounded bg-green-50 dark:bg-green-950/30 p-2 border-l-2 border-green-500">
                            <strong>Mới:</strong> {draft.yDoHinh}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* DANH SÁCH CÔNG VIỆC CẦN LÀM */}
        <div className="space-y-3">
          <h2 className="font-semibold text-base">
            Danh sách việc cần làm ({snapshot.workItems.length})
          </h2>
          <Card>
            <CardContent className="p-0 divide-y text-xs max-h-80 overflow-y-auto">
              {snapshot.workItems.length === 0 ? (
                <p className="p-6 text-center text-muted-foreground">
                  Không có công việc nào cần làm lại.
                </p>
              ) : (
                snapshot.workItems.map((w, idx) => (
                  <div
                    key={idx}
                    className="p-3 flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          Câu {w.n}
                        </Badge>
                        <span className="font-semibold text-foreground">
                          {w.kind === "thu-lai"
                            ? "Thu lại giọng"
                            : w.kind === "dung-canh"
                              ? "Dựng lại cảnh"
                              : w.kind === "sua-phu-de"
                                ? "Sửa chữ phụ đề"
                                : "Xem lại video"}
                        </span>
                        {w.charCount != null && (
                          <span className="text-muted-foreground">
                            ({w.charCount} ký tự)
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground">
                        Lý do: {w.reasons.map((r) => r.text).join("; ")}
                      </p>
                    </div>
                    {w.newContent && (
                      <div className="text-right text-muted-foreground truncate max-w-xs italic">
                        "{w.newContent}"
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* DANH SÁCH QUYẾT ĐỊNH VÀ TRẠNG THÁI CÁC HỒ SƠ */}
        <div className="space-y-3">
          <h2 className="font-semibold text-base">
            Trạng thái duyệt các hồ sơ
          </h2>
          <div className="rounded-lg border bg-card divide-y text-xs">
            {cases.map((c) => {
              const dec = bang[c.id];
              return (
                <div
                  key={c.id}
                  className="p-3 flex items-center justify-between gap-4"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground">
                        {c.id}
                      </span>
                      <span>·</span>
                      <span className="font-medium">{c.title}</span>
                    </div>
                    <p className="text-muted-foreground">
                      Câu {c.sentenceNs.join(", ")} · {c.independentSenders}{" "}
                      người
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {dec?.type === "chon" ? (
                      <Badge className="bg-green-600 text-white">
                        Đã chọn {dec.optionId?.split("-").pop()}
                      </Badge>
                    ) : dec?.type === "hoan" ? (
                      <Badge className="bg-amber-600 text-white">
                        Hoãn ({dec.reason})
                      </Badge>
                    ) : dec?.type === "bo" ? (
                      <Badge className="bg-neutral-600 text-white">
                        Bỏ ({dec.reason})
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-muted-foreground"
                      >
                        Chờ duyệt
                      </Badge>
                    )}
                    <Link href={`/van-de/${c.id}?run=${activeRunId}`}>
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
                        Sửa
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}

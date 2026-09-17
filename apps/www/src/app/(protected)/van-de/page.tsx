"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flag,
  HelpCircle,
  Layers,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";

import PageWrapper from "@/components/page-wrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NhanLoaiVanDe, NhanNghiemTrong } from "@/components/c5/nhan";
import { dinhDangPhut } from "@/lib/revision/format";
import { getLastRunId, useQuyetDinh } from "@/hooks/use-quyet-dinh";
import type {
  DecisionCase,
  RevisionRunResult,
  RunMetadata,
} from "@/lib/revision/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DanhSachVanDePage() {
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

  const { layQuyetDinh } = useQuyetDinh(activeRunId);

  // Lấy dữ liệu run
  const { data, isLoading, error } = useSWR<{
    run: RunMetadata;
    result?: RevisionRunResult;
  }>(activeRunId ? `/api/revisions/runs/${activeRunId}` : null, fetcher);

  const result = data?.result;
  const run = data?.run;
  const cases = result?.cases || [];

  // Phân nhóm cases
  const vungCases = cases.filter((c) => c.type === "vung");
  const canXacNhanCases = cases.filter((c) => c.type === "can-xac-nhan");
  const kyThuatCases = cases.filter((c) => c.type === "ky-thuat");

  const [showFindings, setShowFindings] = useState(false);

  return (
    <PageWrapper className="flex flex-col overflow-y-auto pb-24">
      {/* HEADER */}
      <div className="mx-auto mt-6 w-full max-w-5xl shrink-0 px-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-bold text-2xl dark:text-neutral-50 sm:text-3xl">
              Hồ sơ quyết định sửa
            </h1>
            <p className="mt-1 text-muted-foreground text-sm">
              Góp ý được gom theo vùng câu chồng lấn hoặc liền kề. Người duyệt
              chọn phương án độc lập cho từng vùng.
            </p>
          </div>
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Sparkles className="size-3.5" />
              Chạy đợt phân tích mới
            </Button>
          </Link>
        </div>

        {/* BANNER RUN & CHECKS C3-UI-02 */}
        {run && (
          <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-foreground">
                  Run: {run.runId}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  Model: {run.modelId}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  {new Date(run.createdAt).toLocaleString("vi-VN")}
                </span>
              </div>
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
              >
                Kết quả AI · Chưa được duyệt
              </Badge>
            </div>

            {/* CỜ KIỂM TRA CHECKS C3-VAL-10 */}
            {result?.validation && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium text-muted-foreground">
                    Cờ kiểm tra:
                  </span>
                  <span className="inline-flex items-center gap-1">
                    {result.validation.checks.schemaOk ? (
                      <CheckCircle2 className="size-3.5 text-green-600" />
                    ) : (
                      <AlertCircle className="size-3.5 text-red-600" />
                    )}
                    Schema
                  </span>
                  <span className="inline-flex items-center gap-1">
                    {result.validation.checks.feedbackCoverageOk ? (
                      <CheckCircle2 className="size-3.5 text-green-600" />
                    ) : (
                      <AlertCircle className="size-3.5 text-red-600" />
                    )}
                    Phủ góp ý
                  </span>
                  <span className="inline-flex items-center gap-1">
                    {result.validation.checks.evidenceOk ? (
                      <CheckCircle2 className="size-3.5 text-green-600" />
                    ) : (
                      <AlertCircle className="size-3.5 text-red-600" />
                    )}
                    Bằng chứng
                  </span>
                  <span className="inline-flex items-center gap-1">
                    {result.validation.checks.locationsOk ? (
                      <CheckCircle2 className="size-3.5 text-green-600" />
                    ) : (
                      <AlertCircle className="size-3.5 text-red-600" />
                    )}
                    Vị trí
                  </span>
                  <span className="inline-flex items-center gap-1">
                    {result.validation.checks.patchesOk ? (
                      <CheckCircle2 className="size-3.5 text-green-600" />
                    ) : (
                      <AlertCircle className="size-3.5 text-red-600" />
                    )}
                    Patch
                  </span>
                </div>

                {result.validation.findings.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowFindings(!showFindings)}
                    className="text-primary hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>
                      {result.validation.findings.length} ghi nhận kiểm tra
                    </span>
                    <span className="text-xs">{showFindings ? "▲" : "▼"}</span>
                  </button>
                )}
              </div>
            )}

            {/* DANH SÁCH FINDINGS NẾU MỞ */}
            {showFindings && result?.validation.findings && (
              <div className="rounded border bg-muted/30 p-2.5 max-h-48 overflow-y-auto space-y-1 text-xs font-mono">
                {result.validation.findings.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 py-0.5 border-b border-muted/50 last:border-0"
                  >
                    <span
                      className={
                        f.level === "loi"
                          ? "text-red-600 font-bold"
                          : f.level === "canh-bao"
                            ? "text-amber-600"
                            : "text-muted-foreground"
                      }
                    >
                      [{f.code}]
                    </span>
                    <span className="text-foreground">{f.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* THÔNG BÁO NẾU CHƯA CÓ RUN */}
        {!activeRunId && !isLoading && (
          <div className="rounded-lg border border-dashed p-10 text-center space-y-3">
            <p className="text-muted-foreground text-sm">
              Chưa có lượt phân tích nào được chọn. Hãy chạy một đợt phân tích
              mới trên trang Tổng quan.
            </p>
            <Link href="/">
              <Button size="sm" className="gap-2">
                <Sparkles className="size-4" />
                Đến trang phân tích
              </Button>
            </Link>
          </div>
        )}

        {/* LIÊN KẾT PHỤ C3-CASE-05 */}
        {result && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              Tổng <strong>{result.cases.length}</strong> hồ sơ duyệt (
              {vungCases.length} vùng · {canXacNhanCases.length} cần xác nhận ·{" "}
              {kyThuatCases.length} kỹ thuật)
            </span>
            <span>·</span>
            <Link
              href={`/gop-y?run=${activeRunId}`}
              className="hover:text-foreground hover:underline"
            >
              {result.unassignedFeedback.length} góp ý không thành vấn đề
            </Link>
            <span>·</span>
            <Link
              href={`/gop-y/gan-co?run=${activeRunId}`}
              className="text-red-600 hover:underline dark:text-red-400"
            >
              {result.quarantinedFeedback.length} góp ý cách ly
            </Link>
          </div>
        )}
      </div>

      {/* DANH SÁCH HỒ SƠ DUYỆT */}
      {result && (
        <div className="mx-auto mt-6 w-full max-w-5xl px-4 space-y-6">
          {/* NHÓM 1: VÙNG SỬA */}
          {vungCases.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-primary" />
                <h2 className="font-semibold text-sm uppercase tracking-wider text-foreground">
                  Vùng sửa ({vungCases.length})
                </h2>
              </div>
              <div className="space-y-2.5">
                {vungCases.map((c) => (
                  <CaseCard
                    key={c.id}
                    c={c}
                    runId={activeRunId}
                    layQuyetDinh={layQuyetDinh}
                  />
                ))}
              </div>
            </div>
          )}

          {/* NHÓM 2: CẦN XÁC NHẬN VỊ TRÍ */}
          {canXacNhanCases.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <HelpCircle className="size-4" />
                <h2 className="font-semibold text-sm uppercase tracking-wider">
                  Cần xác nhận vị trí ({canXacNhanCases.length})
                </h2>
              </div>
              <div className="space-y-2.5">
                {canXacNhanCases.map((c) => (
                  <CaseCard
                    key={c.id}
                    c={c}
                    runId={activeRunId}
                    layQuyetDinh={layQuyetDinh}
                  />
                ))}
              </div>
            </div>
          )}

          {/* NHÓM 3: KỸ THUẬT */}
          {kyThuatCases.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400">
                <Wrench className="size-4" />
                <h2 className="font-semibold text-sm uppercase tracking-wider">
                  Kỹ thuật ({kyThuatCases.length})
                </h2>
              </div>
              <div className="space-y-2.5">
                {kyThuatCases.map((c) => (
                  <CaseCard
                    key={c.id}
                    c={c}
                    runId={activeRunId}
                    layQuyetDinh={layQuyetDinh}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </PageWrapper>
  );
}

function CaseCard({
  c,
  runId,
  layQuyetDinh,
}: {
  c: DecisionCase;
  runId: string;
  layQuyetDinh: (caseId: string) => any;
}) {
  const dec = layQuyetDinh(c.id);
  const mainIssue = c.issues[0];

  return (
    <Link
      href={`/van-de/${c.id}?run=${runId}`}
      className="block transition-all"
    >
      <Card className="hover:border-primary/50 hover:bg-muted/30 transition-colors p-4">
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-bold text-xs bg-muted px-2 py-0.5 rounded border">
                {c.id}
              </span>
              {mainIssue && (
                <>
                  <NhanNghiemTrong muc={mainIssue.impact.level} />
                  <NhanLoaiVanDe loai={mainIssue.category} />
                </>
              )}
              {c.hasDisagreement && (
                <Badge
                  variant="outline"
                  className="bg-amber-50 text-amber-700 border-amber-200 text-xs dark:bg-amber-950 dark:text-amber-300"
                >
                  Trái chiều
                </Badge>
              )}
            </div>

            {/* Trạng thái quyết định */}
            {dec ? (
              <Badge
                className={
                  dec.type === "chon"
                    ? "bg-green-600 text-white"
                    : dec.type === "hoan"
                      ? "bg-amber-500 text-white"
                      : "bg-neutral-500 text-white"
                }
              >
                {dec.type === "chon"
                  ? `Đã chọn ${dec.optionId?.split("-").pop() || ""}`
                  : dec.type === "hoan"
                    ? "Đã hoãn"
                    : "Đã bỏ"}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-muted-foreground text-xs"
              >
                Chờ duyệt
              </Badge>
            )}
          </div>

          <h3 className="font-semibold text-sm text-foreground">{c.title}</h3>

          <div className="space-y-1">
            {c.issues.map((iss) => (
              <p
                key={iss.id}
                className="text-xs text-muted-foreground line-clamp-1"
              >
                • {iss.summary}
              </p>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-1 border-t text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" />
              Câu {c.sentenceNs.join(", ")} · {dinhDangPhut(c.tuGiay)}–
              {dinhDangPhut(c.denGiay)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" />
              {c.independentSenders} người ({c.mentions} góp ý)
            </span>
            <span className="inline-flex items-center gap-1 text-primary font-medium ml-auto">
              Xem hồ sơ và duyệt <ArrowRight className="size-3" />
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

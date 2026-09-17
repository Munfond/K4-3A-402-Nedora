"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";

import PageWrapper from "@/components/page-wrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import CaseListColumn from "@/components/studio/case-list-column";
import DecisionDossier from "@/components/studio/decision-dossier";
import V2PreparationColumn from "@/components/studio/v2-preparation-column";
import { getLastRunId, useQuyetDinh } from "@/hooks/use-quyet-dinh";
import { computeReleaseSnapshot } from "@/lib/revision/engine";
import type {
  DecisionCase,
  FeedbackItem,
  RevisionOption,
  RevisionRunResult,
  RunMetadata,
} from "@/lib/revision/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DanhSachVanDePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryRunId = searchParams.get("run");
  const queryCaseId = searchParams.get("case");

  const [activeRunId, setActiveRunId] = useState<string>(queryRunId || "");
  const [selectedCaseId, setSelectedCaseId] = useState<string>(
    queryCaseId || "",
  );

  useEffect(() => {
    if (queryRunId) {
      setActiveRunId(queryRunId);
    } else {
      const last = getLastRunId();
      if (last) setActiveRunId(last);
    }
  }, [queryRunId]);

  const { bang, dat, xoa, isStorageFailed } = useQuyetDinh(activeRunId);

  // Lấy dữ liệu run
  const { data, isLoading, error } = useSWR<{
    run: RunMetadata;
    result?: RevisionRunResult;
  }>(activeRunId ? `/api/revisions/runs/${activeRunId}` : null, fetcher);

  const result = data?.result;
  const run = data?.run;
  const cases = useMemo(() => result?.cases || [], [result]);
  const script = result?.script;
  const allFeedback = useMemo(() => result?.feedback || [], [result]);

  // Set initial selected case
  useEffect(() => {
    if (queryCaseId) {
      setSelectedCaseId(queryCaseId);
    } else if (cases.length > 0 && !selectedCaseId) {
      setSelectedCaseId(cases[0].id);
    }
  }, [queryCaseId, cases, selectedCaseId]);

  const handleSelectCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    // Update URL query param quietly without full reload
    const url = new URL(window.location.href);
    url.searchParams.set("case", caseId);
    if (activeRunId) url.searchParams.set("run", activeRunId);
    window.history.replaceState(null, "", url.toString());
  };

  const selectedCase = useMemo(() => {
    return cases.find((c) => c.id === selectedCaseId) || cases[0];
  }, [cases, selectedCaseId]);

  // Tính snapshot phát hành v2 theo thời gian thực
  const snapshot = useMemo(() => {
    if (!script || cases.length === 0) return null;
    return computeReleaseSnapshot({
      runId: activeRunId,
      inputHash: result?.inputHash || "default",
      script,
      cases,
      decisions: bang,
    });
  }, [activeRunId, result, script, cases, bang]);

  // Decision actions
  const handleSelectOption = (option: RevisionOption) => {
    if (!selectedCase) return;
    if (option.status === "khong-hop-le" || option.status === "ngoai-pham-vi")
      return;

    dat(selectedCase.id, {
      type: "chon",
      optionId: option.id,
      at: new Date().toISOString(),
    });
  };

  const handleDeferCase = (reason: string) => {
    if (!selectedCase) return;
    dat(selectedCase.id, {
      type: "hoan",
      reason,
      at: new Date().toISOString(),
    });
  };

  const handleRejectCase = (reason: string) => {
    if (!selectedCase) return;
    dat(selectedCase.id, {
      type: "bo",
      reason,
      at: new Date().toISOString(),
    });
  };

  const handleResetCase = () => {
    if (!selectedCase) return;
    xoa(selectedCase.id);
  };

  if (isLoading) {
    return (
      <PageWrapper className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-2 text-muted-foreground text-sm">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Đang tải hồ sơ quyết định sửa...</span>
        </div>
      </PageWrapper>
    );
  }

  if (!result || !script || cases.length === 0) {
    return (
      <PageWrapper className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center space-y-4">
        <p className="text-muted-foreground">
          Chưa có lượt phân tích nào hoặc không tìm thấy dữ liệu run{" "}
          <code>{activeRunId || "hiện tại"}</code>.
        </p>
        <Link href="/">
          <Button size="sm" className="gap-2">
            <Sparkles className="size-4" /> Về bước 1: Góp ý & Phân tích
          </Button>
        </Link>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="flex flex-col h-[calc(100vh-64px)] overflow-hidden p-3 sm:p-4">
      {/* STORAGE WARNING */}
      {isStorageFailed && (
        <div className="mb-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-amber-800 text-xs dark:bg-amber-950/40 dark:text-amber-300">
          Lưu ý: Bộ nhớ trình duyệt (localStorage) đang bị chặn — tải lại trang
          có thể làm mất các lựa chọn duyệt chưa xuất.
        </div>
      )}

      {/* 3-COLUMN WORKSPACE CONTAINER */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[310px_minmax(0,1fr)_330px] xl:grid-cols-[340px_minmax(0,1fr)_360px] gap-3 h-full overflow-hidden">
        {/* CỘT 1 (TRÁI): DANH SÁCH CÁC VÙNG SỬA */}
        <div className="h-full overflow-hidden">
          <CaseListColumn
            cases={cases}
            selectedCaseId={selectedCase?.id || ""}
            onSelectCase={handleSelectCase}
            decisions={bang}
          />
        </div>

        {/* CỘT 2 (GIỮA): HỒ SƠ QUYẾT ĐỊNH (4 PHẦN A, B, C, D) */}
        <div className="h-full overflow-hidden">
          {selectedCase ? (
            <DecisionDossier
              currentCase={selectedCase}
              script={script}
              allFeedback={allFeedback}
              currentDecision={bang[selectedCase.id]}
              allDecisions={bang}
              allCases={cases}
              runId={activeRunId}
              onSelectOption={handleSelectOption}
              onDefer={handleDeferCase}
              onReject={handleRejectCase}
              onReset={handleResetCase}
            />
          ) : (
            <div className="flex items-center justify-center h-full border rounded-xl bg-card text-muted-foreground text-xs">
              Chọn một vùng sửa từ cột bên trái để xem hồ sơ.
            </div>
          )}
        </div>

        {/* CỘT 3 (PHẢI): ĐANG CHUẨN BỊ BẢN SỬA V2 THỜI GIAN THỰC */}
        <div className="h-full overflow-hidden">
          {snapshot ? (
            <V2PreparationColumn
              snapshot={snapshot}
              script={script}
              runId={activeRunId}
            />
          ) : (
            <div className="flex items-center justify-center h-full border rounded-xl bg-card text-muted-foreground text-xs">
              Đang tính toán khối lượng v2...
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}

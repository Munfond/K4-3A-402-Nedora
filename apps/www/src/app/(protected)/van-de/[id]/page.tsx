"use client";

import { use, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getLastRunId } from "@/hooks/use-quyet-dinh";

export default function ChiTietVanDeRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: caseId } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryRunId = searchParams.get("run");

  useEffect(() => {
    const runId = queryRunId || getLastRunId() || "";
    const targetUrl = runId
      ? `/van-de?run=${encodeURIComponent(runId)}&case=${encodeURIComponent(caseId)}`
      : `/van-de?case=${encodeURIComponent(caseId)}`;

    router.replace(targetUrl as any);
  }, [caseId, queryRunId, router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-8 text-center text-muted-foreground text-sm">
      <div className="flex flex-col items-center gap-2">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span>Đang chuyển đến bàn làm việc 3 cột...</span>
      </div>
    </div>
  );
}

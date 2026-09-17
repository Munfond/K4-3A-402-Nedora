"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, ShieldAlert } from "lucide-react";

import GopYItem from "@/components/c5/gop-y-item";
import PageWrapper from "@/components/page-wrapper";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getLastRunId } from "@/hooks/use-quyet-dinh";
import { nhanCanhBao } from "@/lib/revision/format";
import type { RevisionRunResult, RunMetadata } from "@/lib/revision/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function GanCoPage() {
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

  const { data, isLoading } = useSWR<{
    run: RunMetadata;
    result?: RevisionRunResult;
  }>(activeRunId ? `/api/revisions/runs/${activeRunId}` : null, fetcher);

  const result = data?.result;
  const ganCo = result?.quarantinedFeedback || [];

  const theoLoai = new Map<string, number>();
  for (const gy of ganCo) {
    theoLoai.set(gy.label, (theoLoai.get(gy.label) ?? 0) + 1);
  }

  return (
    <PageWrapper className="overflow-y-auto pb-16">
      <div className="mx-auto mt-6 w-full max-w-4xl space-y-6 px-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-bold text-2xl dark:text-neutral-50 sm:text-3xl">
              Góp ý gắn cờ cách ly
            </h1>
            <p className="mt-1 text-muted-foreground text-sm">
              Bị giữ lại trước khi đưa vào phân tích lập phương án. Nội dung
              công kích cá nhân và cài lệnh ẩn được cách ly hoàn toàn.
            </p>
          </div>
          <Link href={`/gop-y?run=${activeRunId}`}>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <ArrowLeft className="size-3.5" /> Góp ý gốc
            </Button>
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          {[...theoLoai.entries()].map(([loai, soLuong]) => (
            <span
              key={loai}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-1.5 font-medium text-red-700 text-xs ring-1 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-900"
            >
              <ShieldAlert className="size-3.5" />
              {nhanCanhBao[loai] || loai}: {soLuong}
            </span>
          ))}
        </div>

        {ganCo.length === 0 && !isLoading ? (
          <p className="rounded-lg border border-dashed p-12 text-center text-muted-foreground text-sm">
            Không có góp ý nào bị gắn cờ trong lượt này.
          </p>
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {ganCo.map((gy) => (
                <GopYItem key={gy.id} gopY={gy} />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}

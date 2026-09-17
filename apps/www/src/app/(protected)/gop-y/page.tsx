"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";

import GopYItem from "@/components/c5/gop-y-item";
import PageWrapper from "@/components/page-wrapper";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getLastRunId } from "@/hooks/use-quyet-dinh";
import type {
  FeedbackItem,
  RevisionRunResult,
  RunMetadata,
} from "@/lib/revision/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function GopYPage() {
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
  const feedbackList = result?.feedback || [];

  const issueFeedbackMap = new Map<string, string[]>();
  for (const iss of result?.issues || []) {
    for (const fid of iss.feedbackIds) {
      const list = issueFeedbackMap.get(fid) || [];
      list.push(iss.id);
      issueFeedbackMap.set(fid, list);
    }
  }

  const daGom = feedbackList.filter(
    (g) => !g.isQuarantined && (issueFeedbackMap.get(g.id)?.length ?? 0) > 0,
  );
  const chuaGom = feedbackList.filter(
    (g) => !g.isQuarantined && !(issueFeedbackMap.get(g.id)?.length ?? 0),
  );
  const ganCo = feedbackList.filter((g) => g.isQuarantined);

  return (
    <PageWrapper className="overflow-y-auto pb-16">
      <div className="mx-auto mt-6 w-full max-w-4xl space-y-6 px-4">
        <div>
          <h1 className="font-bold text-2xl dark:text-neutral-50 sm:text-3xl">
            Góp ý gốc
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">
            {feedbackList.length} góp ý trong lượt phân tích (
            {activeRunId || "hiện tại"}) · {daGom.length} đã gom vào vấn đề ·{" "}
            {chuaGom.length} không tạo vấn đề ·{" "}
            <Link
              href={`/gop-y/gan-co?run=${activeRunId}`}
              className="underline text-red-600 dark:text-red-400"
            >
              {ganCo.length} gắn cờ cách ly
            </Link>
          </p>
        </div>

        {feedbackList.length === 0 && !isLoading && (
          <div className="rounded-lg border border-dashed p-8 text-center space-y-3">
            <p className="text-muted-foreground text-sm">
              Chưa có dữ liệu góp ý của lượt chạy này.
            </p>
            <Link href="/">
              <Button size="sm">Đến trang phân tích</Button>
            </Link>
          </div>
        )}

        {daGom.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold text-sm uppercase tracking-wide">
              Đã gom vào vấn đề ({daGom.length})
            </h2>
            <Card>
              <CardContent className="divide-y p-0">
                {daGom.map((gy) => {
                  const linkedIssues = issueFeedbackMap.get(gy.id) || [];
                  return (
                    <div key={gy.id}>
                      <GopYItem gopY={gy} />
                      {linkedIssues.length > 0 && (
                        <div className="px-4 pb-3 flex flex-wrap gap-2 text-xs">
                          <span className="text-muted-foreground">
                            Thuộc vấn đề:
                          </span>
                          {linkedIssues.map((iid) => (
                            <span
                              key={iid}
                              className="font-mono bg-muted px-2 py-0.5 rounded border"
                            >
                              {iid}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </section>
        )}

        {chuaGom.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold text-sm uppercase tracking-wide">
              Không thành vấn đề sửa ({chuaGom.length})
            </h2>
            <p className="text-muted-foreground text-xs">
              Góp ý khen ngợi, chỉ có điểm số, hoặc không có yêu cầu chỉnh sửa
              kịch bản.
            </p>
            <Card>
              <CardContent className="divide-y p-0">
                {chuaGom.map((gy) => (
                  <GopYItem key={gy.id} gopY={gy} />
                ))}
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </PageWrapper>
  );
}

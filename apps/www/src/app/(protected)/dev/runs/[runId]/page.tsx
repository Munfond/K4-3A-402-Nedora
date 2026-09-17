import { notFound } from "next/navigation";
import { getRunById } from "@/lib/revision/trace";
import { getAllNodesDebugData, readRunEvents } from "@/lib/revision/events";
import RunInspectorClient from "./run-inspector-client";

export const dynamic = "force-dynamic";

export default async function DevRunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  // AP-06: chỉ mở khi bật cờ ở server.
  if (process.env.REVISION_DEBUG_UI !== "1") {
    notFound();
  }

  const { runId } = await params;
  const item = getRunById(runId);
  if (!item) {
    notFound();
  }

  return (
    <RunInspectorClient
      runId={runId}
      run={item.run}
      result={item.result}
      nodes={getAllNodesDebugData(runId)}
      events={readRunEvents(runId)}
    />
  );
}

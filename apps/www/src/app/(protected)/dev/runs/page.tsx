import { notFound } from "next/navigation";
import { getRunList } from "@/lib/revision/trace";
import DevRunsClient from "./dev-runs-client";

export const dynamic = "force-dynamic";

export default async function DevRunsPage() {
  // AP-06: REVISION_DEBUG_UI tắt -> trả 404
  if (process.env.REVISION_DEBUG_UI !== "1") {
    notFound();
  }

  const runs = getRunList();
  return <DevRunsClient initialRuns={runs} />;
}

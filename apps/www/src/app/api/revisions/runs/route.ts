import { NextResponse } from "next/server";
import { getRunList } from "@/lib/revision/trace";
import type { RunMetadata } from "@/lib/revision/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const videoId = params.get("videoId");
    const versionId = params.get("versionId");
    const includeMock = params.get("includeMock") === "1";
    const runs = getRunList().filter((r) => {
      // Run trước studio không có videoId/versionId: đều là D1 v1.
      if (videoId && (r.videoId ?? "d1") !== videoId) return false;
      if (versionId && (r.versionId ?? "v1") !== versionId) return false;
      if (!includeMock && isMockRun(r)) return false;
      return true;
    });
    return NextResponse.json({ runs });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: { code: "RUNS_FETCH_FAILED", message: msg } },
      { status: 500 },
    );
  }
}

function isMockRun(run: RunMetadata): boolean {
  return run.mode === "gia-lap" || run.modelId.startsWith("mock");
}

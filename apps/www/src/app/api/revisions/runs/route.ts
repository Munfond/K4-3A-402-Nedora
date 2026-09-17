import { NextResponse } from "next/server";
import { getRunList } from "@/lib/revision/trace";

export const runtime = "nodejs";

export async function GET() {
  try {
    const runs = getRunList();
    return NextResponse.json({ runs });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: { code: "RUNS_FETCH_FAILED", message: msg } },
      { status: 500 },
    );
  }
}

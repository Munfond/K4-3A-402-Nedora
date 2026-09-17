import { NextResponse } from "next/server";
import { getRunTraceCombined } from "@/lib/revision/trace";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await params;
    const trace = getRunTraceCombined(runId);

    if (!trace) {
      return NextResponse.json(
        {
          error: {
            code: "RUN_NOT_FOUND",
            message: `Không tìm thấy trace của run ${runId}`,
          },
        },
        { status: 404 },
      );
    }

    return new NextResponse(JSON.stringify(trace, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="trace-${runId}.json"`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: { code: "TRACE_FETCH_FAILED", message: msg } },
      { status: 500 },
    );
  }
}

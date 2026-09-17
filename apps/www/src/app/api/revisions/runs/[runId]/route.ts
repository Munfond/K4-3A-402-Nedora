import { NextResponse } from "next/server";
import { getRunById } from "@/lib/revision/trace";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await params;
    const item = getRunById(runId);

    if (!item) {
      return NextResponse.json(
        {
          error: {
            code: "RUN_NOT_FOUND",
            message: `Không tìm thấy run ${runId}`,
          },
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      run: item.run,
      result: item.result,
      script: item.result?.script,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: { code: "RUN_FETCH_FAILED", message: msg } },
      { status: 500 },
    );
  }
}

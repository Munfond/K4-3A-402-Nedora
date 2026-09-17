import { NextRequest, NextResponse } from "next/server";
import { cancelRevisionRun } from "@/lib/revision/background-runner";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const success = cancelRevisionRun(runId);

  return NextResponse.json({
    success,
    runId,
    status: "loi",
    code: "RUN_CANCELLED",
    message: success
      ? "Đã hủy đợt phân tích thành công"
      : "Run không tồn tại hoặc đã kết thúc",
  });
}

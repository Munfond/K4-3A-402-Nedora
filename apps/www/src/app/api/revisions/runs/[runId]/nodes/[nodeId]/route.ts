import { NextRequest, NextResponse } from "next/server";
import { getNodeDebugData } from "@/lib/revision/events";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string; nodeId: string }> },
) {
  const { runId, nodeId } = await params;
  const data = getNodeDebugData(runId, nodeId);

  if (!data) {
    return NextResponse.json(
      {
        error: {
          code: "NODE_NOT_FOUND",
          message: `Không tìm thấy thông tin node ${nodeId}`,
        },
      },
      { status: 404 },
    );
  }

  return NextResponse.json(data);
}

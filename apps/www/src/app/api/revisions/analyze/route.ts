import { NextResponse } from "next/server";
import { analyzeRevision } from "@/lib/revision/service";
import type { AnalyzeInput } from "@/lib/revision/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AnalyzeInput;

    if (!body || body.scriptId !== "d1") {
      return NextResponse.json(
        {
          error: {
            code: "INPUT_INVALID",
            message: "scriptId bắt buộc phải là 'd1'",
          },
        },
        { status: 400 },
      );
    }

    const response = await analyzeRevision(body);

    if (response.status === "loi") {
      const errCode = response.error?.code || "MODEL_CALL_FAILED";
      let statusCode = 502;
      if (errCode === "MODEL_NOT_CONFIGURED") statusCode = 503;
      else if (errCode === "MODEL_TIMEOUT") statusCode = 504;
      else if (errCode === "INPUT_INVALID") statusCode = 400;

      return NextResponse.json(
        {
          error: {
            code: errCode,
            message: response.error?.message || "Lỗi khi gọi model phân tích",
            runId: response.runId,
          },
        },
        { status: statusCode },
      );
    }

    return NextResponse.json(response);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isInputErr = msg.includes("INPUT_INVALID") || msg.includes("C3-IN");

    return NextResponse.json(
      {
        error: {
          code: isInputErr ? "INPUT_INVALID" : "INTERNAL_ERROR",
          message: msg,
        },
      },
      { status: isInputErr ? 400 : 500 },
    );
  }
}

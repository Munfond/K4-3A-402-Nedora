import { NextResponse } from "next/server";
import { analyzeRevision } from "@/lib/revision/service";
import { startBackgroundRevision } from "@/lib/revision/background-runner";
import type { AnalyzeInput } from "@/lib/revision/types";
import { loadStoredFeedback } from "@/lib/studio/feedback-store";

export const runtime = "nodejs";
// Chạy nền trả 202 ngay; hỗ trợ sync=1 nếu cần đồng bộ
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const isSync = url.searchParams.get("sync") === "1";

    const body = (await req.json()) as AnalyzeInput;
    if (!body) {
      return inputError("Body phải là JSON");
    }

    // Từ trang video: { videoId, versionId }. Từ eval runner cũ: { scriptId: "d1", ... }.
    const videoId = body.videoId ?? (body.scriptId === "d1" ? "d1" : undefined);
    const versionId = body.versionId ?? "v1";
    if (!videoId) {
      return inputError("Cần videoId (hoặc scriptId: 'd1')");
    }
    if (videoId !== "d1") {
      return NextResponse.json(
        {
          error: {
            code: "VIDEO_NOT_ANALYZABLE",
            message:
              "Video này chưa có kịch bản và timecode hợp lệ nên chưa phân tích được",
          },
        },
        { status: 400 },
      );
    }

    const fromStudio = body.videoId !== undefined;
    const input: AnalyzeInput = fromStudio
      ? {
          videoId,
          versionId,
          includeD1Feedback: versionId === "v1",
          feedbackIds: body.feedbackIds,
        }
      : { ...body, videoId, versionId };

    const stored = fromStudio ? loadStoredFeedback(videoId, versionId) : [];
    const storedSelected = body.feedbackIds?.length
      ? stored.filter((f) => body.feedbackIds!.includes(f.id))
      : stored;

    // Chạy đồng bộ nếu có cờ ?sync=1
    if (isSync) {
      const response = await analyzeRevision(
        input,
        undefined,
        undefined,
        storedSelected,
      );

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
    }

    // MẶC ĐỊNH (P0b - C3): Khởi chạy nền, trả về 202 Accepted ngay trong < 1 giây
    const bgRun = await startBackgroundRevision(
      input,
      undefined,
      undefined,
      storedSelected,
    );

    return NextResponse.json(
      {
        runId: bgRun.runId,
        status: "dang-chay",
        message: "Đã bắt đầu đợt phân tích trong tiến trình nền",
      },
      { status: 202 },
    );
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

function inputError(message: string) {
  return NextResponse.json(
    { error: { code: "INPUT_INVALID", message } },
    { status: 400 },
  );
}

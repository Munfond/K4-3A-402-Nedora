import { NextRequest, NextResponse } from "next/server";
import {
  readRunEvents,
  subscribeRunEvents,
  type RunEvent,
} from "@/lib/revision/events";
import { getRunById } from "@/lib/revision/trace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const afterSeq = parseInt(req.nextUrl.searchParams.get("after") || "0", 10);
  const format = req.nextUrl.searchParams.get("format");
  const accept = req.headers.get("accept") || "";

  // 1. Nếu client yêu cầu JSON polling (fallback)
  if (format === "json" || accept.includes("application/json")) {
    const events = readRunEvents(runId, afterSeq);
    const runData = getRunById(runId);
    return NextResponse.json({
      runId,
      status: runData?.run.status ?? "chua-chay",
      events,
    });
  }

  // 2. Server-Sent Events (SSE Streaming)
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendEvent = (event: RunEvent) => {
    try {
      const data = `id: ${event.seq}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
      writer.write(encoder.encode(data));
    } catch {
      // bỏ qua nếu socket đóng
    }
  };

  // Phát lại toàn bộ các sự kiện đã có sau mốc afterSeq
  const existingEvents = readRunEvents(runId, afterSeq);
  for (const ev of existingEvents) {
    sendEvent(ev);
  }

  // Kiểm tra run đã xong hoặc lỗi chưa
  const currentRun = getRunById(runId);
  const isFinished =
    currentRun?.run.status === "xong" || currentRun?.run.status === "loi";

  if (isFinished) {
    // Đóng luồng nếu đã hoàn tất
    setTimeout(() => {
      try {
        writer.close();
      } catch {}
    }, 100);
  } else {
    // Nếu vẫn đang chạy, đăng ký lắng nghe sự kiện mới
    const unsubscribe = subscribeRunEvents(runId, (event) => {
      sendEvent(event);
      if (event.type === "run.finished" || event.type === "run.failed") {
        unsubscribe();
        setTimeout(() => {
          try {
            writer.close();
          } catch {}
        }, 200);
      }
    });

    // Gửi heartbeat mỗi 15s để giữ kết nối
    const heartbeatInterval = setInterval(() => {
      try {
        writer.write(encoder.encode(": heartbeat\n\n"));
      } catch {
        clearInterval(heartbeatInterval);
        unsubscribe();
      }
    }, 15000);

    req.signal.addEventListener("abort", () => {
      clearInterval(heartbeatInterval);
      unsubscribe();
      try {
        writer.close();
      } catch {}
    });
  }

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

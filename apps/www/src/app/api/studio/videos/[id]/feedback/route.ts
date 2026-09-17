import { NextResponse } from "next/server";
import { buildNewFeedbackItems, loadScriptD1 } from "@/lib/revision/load";
import type { NewFeedbackInput } from "@/lib/revision/types";
import {
  appendStoredFeedback,
  loadStoredFeedback,
  nextStoredFeedbackIndex,
} from "@/lib/studio/feedback-store";
import { getVideoFeedback } from "@/lib/studio/video-store";

export const runtime = "nodejs";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const versionId = new URL(req.url).searchParams.get("version") || "v1";
  try {
    const feedback = getVideoFeedback(id, versionId);
    return NextResponse.json({ feedback, counts: countFeedback(feedback) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorResponse("FEEDBACK_FETCH_FAILED", msg, 500);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: { versionId?: string; items?: NewFeedbackInput[] };
  try {
    body = await req.json();
  } catch {
    return errorResponse("INPUT_INVALID", "Body phải là JSON", 400);
  }

  const versionId = body.versionId || "v1";
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0 || items.length > 20) {
    return errorResponse("INPUT_INVALID", "Mỗi lần lưu cần 1–20 góp ý", 400);
  }

  // Chỉ D1 có kịch bản để kiểm tra câu/mốc (C3-IN-06 trong CP3).
  if (id !== "d1") {
    return errorResponse(
      "VIDEO_NOT_ANALYZABLE",
      "Video này chưa có kịch bản và timecode hợp lệ nên chưa nhận góp ý để phân tích",
      400,
    );
  }

  try {
    const script = loadScriptD1();
    // Chỉ nhận các trường người dùng được nhập; nhãn/cách ly do server gán.
    const allowed: NewFeedbackInput[] = items.map((it) => ({
      text: typeof it.text === "string" ? it.text : "",
      channel: it.channel,
      sender: it.sender,
      survey: it.survey,
      location: it.location,
      time: new Date().toISOString(),
    }));
    const existing = loadStoredFeedback(id, versionId);
    const built = buildNewFeedbackItems(
      allowed,
      script,
      "gy-u",
      nextStoredFeedbackIndex(existing),
    );
    const saved = appendStoredFeedback(id, versionId, built);
    return NextResponse.json({ feedback: saved }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isInput = msg.includes("C3-IN") || msg.includes("INPUT_INVALID");
    return errorResponse(
      isInput ? "INPUT_INVALID" : "FEEDBACK_SAVE_FAILED",
      msg,
      isInput ? 400 : 500,
    );
  }
}

function countFeedback(
  feedback: Array<{ sender: string; isQuarantined: boolean; label: string }>,
) {
  const biLoai = feedback.filter((f) => f.isQuarantined).length;
  const chiChamDiem = feedback.filter(
    (f) => !f.isQuarantined && f.label === "chi-cham-diem",
  ).length;
  return {
    total: feedback.length,
    senders: new Set(feedback.map((f) => f.sender)).size,
    coNhanXet: feedback.length - biLoai - chiChamDiem,
    chiChamDiem,
    biLoai,
  };
}

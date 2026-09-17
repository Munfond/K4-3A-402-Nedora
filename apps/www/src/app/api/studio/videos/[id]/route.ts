import { NextResponse } from "next/server";
import {
  attachServiceFeedback,
  getInitialVideos,
} from "@/lib/studio/video-store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const video = getInitialVideos().find((v) => v.id === id);

  if (!video) {
    return NextResponse.json(
      { error: `Không tìm thấy video có mã: ${id}` },
      { status: 404 },
    );
  }

  return NextResponse.json({ video: await attachServiceFeedback(video) });
}

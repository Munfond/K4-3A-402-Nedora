import { NextResponse } from "next/server";
import {
  attachServiceFeedback,
  getInitialVideos,
} from "@/lib/studio/video-store";
import type { StudioVideo } from "@/lib/studio/types";

// In-memory registry for session
const customVideos: StudioVideo[] = [];

export async function GET() {
  const initial = await Promise.all(
    getInitialVideos().map(attachServiceFeedback),
  );
  // Strip heavy script details from list view for optimal performance
  const list = [...initial, ...customVideos].map((v) => ({
    id: v.id,
    title: v.title,
    description: v.description,
    durationSeconds: v.durationSeconds,
    currentVersion: v.currentVersion,
    isSample: v.isSample,
    thumbnailUrl: v.thumbnailUrl,
    videoUrl: v.videoUrl,
    createdAt: v.createdAt,
    hasScript: v.hasScript,
    hasTimecodes: v.hasTimecodes,
    hasVideoFile: v.hasVideoFile,
    feedbackCount: v.feedbackCount,
    feedbackError: v.feedbackError,
    activeRunId: v.activeRunId,
    versions: v.versions,
  }));

  return NextResponse.json({ videos: list });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const title = (body.title || "").trim();
    if (!title) {
      return NextResponse.json(
        { error: "Tên video không được để trống" },
        { status: 400 },
      );
    }

    const id = (body.id || `video-${Date.now().toString(36)}`).toLowerCase();
    const durationSeconds = parseInt(body.durationSeconds, 10) || 180;
    const hasScript = Boolean(
      body.script && body.script.cau && body.script.cau.length > 0,
    );
    const hasTimecodes = Boolean(
      body.hasTimecodes ||
        (hasScript && body.script.cau.some((c: any) => c.batDauGiay != null)),
    );
    const hasVideoFile = Boolean(
      body.videoUrl && body.videoUrl.trim().length > 0,
    );

    const newVideo: StudioVideo = {
      id,
      title,
      description: (body.description || "").trim(),
      durationSeconds,
      currentVersion: "v1",
      isSample: false,
      videoUrl: body.videoUrl || "",
      thumbnailUrl: body.thumbnailUrl || "",
      createdAt: new Date().toISOString(),
      hasScript,
      hasTimecodes,
      hasVideoFile,
      feedbackCount: 0,
      activeRunId: null,
      script: body.script || undefined,
      feedbacks: [],
      versions: [
        {
          versionId: "v1",
          name: "Phiên bản v1 (Khởi tạo)",
          status: "current",
          releaseStatus: "has_video",
          createdAt: new Date().toISOString(),
          description: "Phiên bản khởi tạo từ tệp tải lên.",
          durationSeconds,
          sentenceCount: hasScript ? body.script.cau.length : 0,
        },
      ],
    };

    customVideos.unshift(newVideo);

    return NextResponse.json({ video: newVideo }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

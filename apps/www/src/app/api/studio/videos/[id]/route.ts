import { NextResponse } from "next/server";
import { getInitialVideos } from "@/lib/studio/video-store";
import { loadScriptD1 } from "@/lib/revision/load";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const initial = getInitialVideos();
  const video = initial.find((v) => v.id === id);

  if (!video) {
    return NextResponse.json(
      { error: `Không tìm thấy video có mã: ${id}` },
      { status: 404 },
    );
  }

  // Nếu là D1, bảo đảm script được nạp đầy đủ 40 câu
  if (id === "d1" && !video.script) {
    try {
      video.script = loadScriptD1();
    } catch (e) {
      // bỏ qua
    }
  }

  return NextResponse.json({ video });
}

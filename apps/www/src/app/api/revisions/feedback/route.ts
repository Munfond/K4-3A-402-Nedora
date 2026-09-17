import { NextResponse } from "next/server";
import { loadD1RawFeedback } from "@/lib/revision/load";

export async function GET() {
  try {
    const feedback = loadD1RawFeedback();
    return NextResponse.json({
      feedback,
      total: feedback.length,
      senders: new Set(feedback.map((f) => f.sender)).size,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Không thể nạp dữ liệu góp ý D1", message: error.message },
      { status: 500 },
    );
  }
}

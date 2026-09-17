import { NextResponse } from "next/server";
import {
  REVISION_HIEU_SYSTEM_PROMPT,
  REVISION_PHUONG_AN_SYSTEM_PROMPT,
  RevisionHieuOutput,
  RevisionPhuongAnOutput,
  runRevisionStep,
} from "@feedback/ai/agents/revision";
import { getNodeDebugData } from "@/lib/revision/events";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Chạy lại đúng một node bằng input đã lưu (plan §6, P3).
 * KHÔNG ghi đè run gốc: kết quả chỉ trả về cho màn Debug để đối chiếu.
 * Bỏ qua cache để thấy model thật sự trả gì lần này.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ runId: string; nodeId: string }> },
) {
  if (process.env.REVISION_DEBUG_UI !== "1") {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Không có" } },
      { status: 404 },
    );
  }

  const { runId, nodeId } = await params;
  const node = getNodeDebugData(runId, nodeId);
  if (!node) {
    return NextResponse.json(
      {
        error: {
          code: "NODE_NOT_FOUND",
          message: `Không tìm thấy node ${nodeId} của run ${runId}`,
        },
      },
      { status: 404 },
    );
  }

  const isHieu = node.nodeType === "N4_PHAN_LOAI";
  const isPhuongAn = node.nodeType === "N8_LAP_PHUONG_AN";
  if (!isHieu && !isPhuongAn) {
    return NextResponse.json(
      {
        error: {
          code: "NODE_NOT_REPLAYABLE",
          message: `Node ${nodeId} không gọi model nên không cần chạy lại`,
        },
      },
      { status: 400 },
    );
  }

  // Input đã lưu của N4 chỉ là số đếm (để trace gọn), không đủ để gọi lại.
  const input = node.input as Record<string, unknown>;
  const hasFullInput = isHieu
    ? Array.isArray(input?.script) && Array.isArray(input?.feedback)
    : Array.isArray(input?.sentences) && Array.isArray(input?.issues);

  if (!hasFullInput) {
    return NextResponse.json(
      {
        error: {
          code: "NODE_INPUT_NOT_STORED",
          message:
            "Node này chưa lưu đủ dữ liệu vào để chạy lại. Chạy một đợt phân tích mới rồi thử lại.",
        },
      },
      { status: 409 },
    );
  }

  const started = Date.now();
  const res = isHieu
    ? await runRevisionStep({
        systemPrompt: REVISION_HIEU_SYSTEM_PROMPT,
        userPayload: input,
        schema: RevisionHieuOutput,
        stepLabel: `chạy lại ${nodeId}`,
      })
    : await runRevisionStep({
        systemPrompt: REVISION_PHUONG_AN_SYSTEM_PROMPT,
        userPayload: input,
        schema: RevisionPhuongAnOutput,
        stepLabel: `chạy lại ${nodeId}`,
      });

  return NextResponse.json({
    runId,
    nodeId,
    replayOf: nodeId,
    ok: res.ok,
    ms: Date.now() - started,
    msGoc: node.ms,
    tokens: res.totalTokens,
    attempts: res.attempts,
    promptHash: res.promptHash,
    promptHashGoc: node.promptHash,
    output: res.output,
    outputGoc: node.output,
    error: res.error,
  });
}

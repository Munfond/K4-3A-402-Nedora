import { NextResponse } from "next/server";
import { getRunById } from "@/lib/revision/trace";
import { computeReleaseSnapshot } from "@/lib/revision/engine";
import { generateAllExports } from "@/lib/revision/export";
import type { DecisionRecord } from "@/lib/revision/types";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await params;
    const item = getRunById(runId);

    if (!item || !item.result) {
      return NextResponse.json(
        {
          error: {
            code: "RUN_NOT_FOUND",
            message: `Không tìm thấy kết quả của run ${runId}`,
          },
        },
        { status: 404 },
      );
    }

    const body = (await req.json()) as {
      decisions: Record<string, DecisionRecord>;
      file:
        | "kich-ban-v2.json"
        | "kich-ban-v2.md"
        | "viec-can-lam.csv"
        | "truy-vet.json";
    };

    const decisions = body.decisions || {};
    const requestedFile = body.file || "kich-ban-v2.json";

    const snapshot = computeReleaseSnapshot({
      runId,
      inputHash: item.run.inputHash,
      script: item.result.script,
      cases: item.result.cases,
      decisions,
    });

    // C3-EXP-01: Chặn xuất nếu có xung đột cứng
    if (snapshot.conflicts.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: "EXPORT_BLOCKED_CONFLICT",
            message: `Có ${snapshot.conflicts.length} xung đột ghi đè chưa được giải quyết`,
            conflicts: snapshot.conflicts,
          },
        },
        { status: 409 },
      );
    }

    const exportPkg = generateAllExports({
      script: item.result.script,
      snapshot,
      cases: item.result.cases,
      issues: item.result.issues,
      feedback: item.result.feedback,
      metadata: {
        modelId: item.run.modelId,
        promptVersion: item.run.promptVersion,
        schemaVersion: item.run.schemaVersion,
        policyVersion: item.run.policyVersion,
      },
    });

    let content: string;
    let contentType: string;
    let filename: string;

    switch (requestedFile) {
      case "kich-ban-v2.json":
        content = exportPkg.kichBanJson;
        contentType = "application/json; charset=utf-8";
        filename = "kich-ban-v2.json";
        break;
      case "kich-ban-v2.md":
        content = exportPkg.kichBanMd;
        contentType = "text/markdown; charset=utf-8";
        filename = "kich-ban-v2.md";
        break;
      case "viec-can-lam.csv":
        content = exportPkg.viecCanLamCsv;
        contentType = "text/csv; charset=utf-8";
        filename = "viec-can-lam.csv";
        break;
      case "truy-vet.json":
        content = exportPkg.truyVetJson;
        contentType = "application/json; charset=utf-8";
        filename = "truy-vet.json";
        break;
      default:
        return NextResponse.json(
          {
            error: {
              code: "FILE_TYPE_INVALID",
              message: `Loại file không hợp lệ: ${requestedFile}`,
            },
          },
          { status: 400 },
        );
    }

    return new NextResponse(content, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isConflict = msg.includes("EXPORT_BLOCKED_CONFLICT");
    const isSelfCheck = msg.includes("Self-check failed");

    return NextResponse.json(
      {
        error: {
          code: isConflict
            ? "EXPORT_BLOCKED_CONFLICT"
            : isSelfCheck
              ? "EXPORT_SELF_CHECK_FAILED"
              : "INTERNAL_ERROR",
          message: msg,
        },
      },
      { status: isConflict ? 409 : isSelfCheck ? 500 : 500 },
    );
  }
}

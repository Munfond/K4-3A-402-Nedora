import { NextResponse } from "next/server";
import { getRunById } from "@/lib/revision/trace";
import { readRunEvents } from "@/lib/revision/events";
import { loadScriptD1 } from "@/lib/revision/load";
import type { DecisionCase, RevisionRunResult } from "@/lib/revision/types";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await params;
    const item = getRunById(runId);

    if (!item) {
      return NextResponse.json(
        {
          error: {
            code: "RUN_NOT_FOUND",
            message: `Không tìm thấy run ${runId}`,
          },
        },
        { status: 404 },
      );
    }

    // Nếu run đang chạy và chưa có result.json, kiểm tra xem đã có partial cases.ready chưa
    let result = item.result;
    if (!result && item.run.status === "dang-chay") {
      const events = readRunEvents(runId);
      for (const ev of events) {
        if (ev.type === "partial" && ev.kind === "cases.ready") {
          const partialCases = ev.payload as DecisionCase[];
          let scriptData;
          try {
            scriptData = loadScriptD1();
          } catch {
            scriptData = {
              id: "d1",
              tieuDe: "Video d1",
              mucTieu: "",
              thoiLuongDuKienGiay: 251,
              phan: [],
              cau: [],
            };
          }
          result = {
            runId,
            inputHash: item.run.inputHash || "",
            script: scriptData,
            feedback: [],
            issues: [],
            cases: partialCases,
            validation: {
              findings: [],
              checks: {
                schemaOk: true,
                feedbackCoverageOk: false,
                evidenceOk: false,
                locationsOk: false,
                patchesOk: false,
              },
            },
            unassignedFeedback: [],
            quarantinedFeedback: [],
          };
          break;
        }
      }
    }

    return NextResponse.json({
      run: item.run,
      result,
      script: result?.script,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: { code: "RUN_FETCH_FAILED", message: msg } },
      { status: 500 },
    );
  }
}

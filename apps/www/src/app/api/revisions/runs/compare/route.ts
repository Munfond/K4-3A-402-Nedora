import { NextResponse } from "next/server";
import { getAllNodesDebugData } from "@/lib/revision/events";
import { getRunById } from "@/lib/revision/trace";
import type { RevisionRunResult, RunMetadata } from "@/lib/revision/types";

export const runtime = "nodejs";

interface SoSanhNode {
  nodeId: string;
  msA?: number;
  msB?: number;
  tokensA?: number;
  tokensB?: number;
  trangThaiA?: string;
  trangThaiB?: string;
  chiCoO?: "A" | "B";
}

function tomTat(run: RunMetadata, result?: RevisionRunResult) {
  let phuongAnHopLe = 0;
  let vungCoPhuongAn = 0;
  for (const c of result?.cases ?? []) {
    if (c.options.length > 0) vungCoPhuongAn++;
    for (const o of c.options) if (o.status === "hop-le") phuongAnHopLe++;
  }
  return {
    runId: run.runId,
    modelId: run.modelId,
    createdAt: run.createdAt,
    status: run.status,
    mode: run.mode ?? "that",
    inputHash: run.inputHash,
    promptHash: run.promptHash,
    graphVersion: run.graphVersion,
    durationMs: run.durationMs,
    soVanDe: result?.issues.length ?? 0,
    soVung: result?.cases.length ?? 0,
    vungCoPhuongAn,
    phuongAnHopLe,
    soGopY: result?.feedback.length ?? 0,
    soFindings: result?.validation.findings.length ?? 0,
  };
}

/**
 * AP-10: so sánh hai run theo node. Chỉ có nghĩa khi cùng `inputHash`;
 * khác inputHash vẫn so được nhưng trả cờ cảnh báo để không đọc nhầm.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const a = url.searchParams.get("a");
  const b = url.searchParams.get("b");

  if (!a || !b) {
    return NextResponse.json(
      { error: { code: "INPUT_INVALID", message: "Cần tham số a và b" } },
      { status: 400 },
    );
  }

  const itemA = getRunById(a);
  const itemB = getRunById(b);
  if (!itemA || !itemB) {
    return NextResponse.json(
      {
        error: {
          code: "RUN_NOT_FOUND",
          message: `Không tìm thấy run ${!itemA ? a : b}`,
        },
      },
      { status: 404 },
    );
  }

  const nodesA = new Map(
    getAllNodesDebugData(a).map((n) => [n.nodeId, n] as const),
  );
  const nodesB = new Map(
    getAllNodesDebugData(b).map((n) => [n.nodeId, n] as const),
  );

  const allIds = [...new Set([...nodesA.keys(), ...nodesB.keys()])].sort();
  const nodes: SoSanhNode[] = allIds.map((nodeId) => {
    const na = nodesA.get(nodeId);
    const nb = nodesB.get(nodeId);
    return {
      nodeId,
      msA: na?.ms,
      msB: nb?.ms,
      tokensA: na
        ? (na.tokens?.input ?? 0) + (na.tokens?.output ?? 0)
        : undefined,
      tokensB: nb
        ? (nb.tokens?.input ?? 0) + (nb.tokens?.output ?? 0)
        : undefined,
      trangThaiA: na?.status,
      trangThaiB: nb?.status,
      ...(na && !nb ? { chiCoO: "A" as const } : {}),
      ...(!na && nb ? { chiCoO: "B" as const } : {}),
    };
  });

  const tomTatA = tomTat(itemA.run, itemA.result);
  const tomTatB = tomTat(itemB.run, itemB.result);

  return NextResponse.json({
    a: tomTatA,
    b: tomTatB,
    cungInputHash: tomTatA.inputHash === tomTatB.inputHash,
    cungPromptHash: tomTatA.promptHash === tomTatB.promptHash,
    nodes,
  });
}

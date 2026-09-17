"use client";

import { useMemo } from "react";
import type { NodeDebugData } from "@/lib/revision/events";

interface Props {
  nodes: NodeDebugData[];
  selectedNodeId?: string;
  onSelectNode?: (nodeId: string) => void;
}

interface Placed {
  node: NodeDebugData;
  x: number;
  y: number;
}

const BOX_W = 190;
const BOX_H = 62;
const GAP_X = 70;
const GAP_Y = 16;

/** Node tuần tự trước nhánh song song, theo đúng đồ thị §3.2 của plan. */
const CHAIN_BEFORE = [
  "N1_BAT_DAU",
  "N2_NAP_NGU_CANH",
  "N3_LAM_SACH_CHAN",
  "N4_PHAN_LOAI",
  "MODEL_PHAN_TICH",
];
const CHAIN_AFTER = [
  "V_KIEM_TRA_VA_GOM_VUNG",
  "N10_GOP_KET_QUA",
  "N11_KET_THUC",
];

const NHAN: Record<string, string> = {
  N1_BAT_DAU: "Bắt đầu đợt",
  N2_NAP_NGU_CANH: "Nạp ngữ cảnh",
  N3_LAM_SACH_CHAN: "Làm sạch & chặn",
  N4_PHAN_LOAI: "Phân loại góp ý",
  MODEL_PHAN_TICH: "Gọi model",
  V_KIEM_TRA_VA_GOM_VUNG: "Kiểm tra & chia vùng",
  N10_GOP_KET_QUA: "Gộp kết quả",
  N11_KET_THUC: "Kết thúc",
};

function mauTheoTrangThai(status: string) {
  if (status === "loi") {
    return {
      vien: "var(--destructive)",
      nen: "color-mix(in oklab, var(--destructive) 12%, transparent)",
    };
  }
  if (status === "dang-chay") {
    return {
      vien: "var(--primary)",
      nen: "color-mix(in oklab, var(--primary) 12%, transparent)",
    };
  }
  if (status === "xong") {
    return { vien: "var(--border)", nen: "var(--card)" };
  }
  return { vien: "var(--border)", nen: "transparent" };
}

/**
 * Sơ đồ pipeline: node nối nhau bằng cạnh cong, nhánh N8 tỏa ra song song
 * rồi hợp lại. Bố cục tự tính, không kéo thả (tránh lưu vị trí vô nghĩa).
 */
export default function PipelineGraph({
  nodes,
  selectedNodeId,
  onSelectNode,
}: Props) {
  const { placed, edges, width, height } = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.nodeId, n] as const));
    const truoc = CHAIN_BEFORE.filter((id) => byId.has(id));
    const sau = CHAIN_AFTER.filter((id) => byId.has(id));
    const nhanh = nodes
      .filter((n) => n.nodeId.startsWith("N8_LAP_PHUONG_AN"))
      .sort((a, b) => {
        const na = Number(a.nodeId.split("_").pop()) || 0;
        const nb = Number(b.nodeId.split("_").pop()) || 0;
        return na - nb;
      });

    const placed: Placed[] = [];
    const edges: Array<{ from: string; to: string }> = [];

    const laneH = Math.max(1, nhanh.length) * (BOX_H + GAP_Y);
    const midY = laneH / 2 - BOX_H / 2;

    let col = 0;
    for (const id of truoc) {
      placed.push({ node: byId.get(id)!, x: col * (BOX_W + GAP_X), y: midY });
      col++;
    }

    const colNhanh = col;
    nhanh.forEach((n, i) => {
      placed.push({
        node: n,
        x: colNhanh * (BOX_W + GAP_X),
        y: i * (BOX_H + GAP_Y),
      });
    });
    if (nhanh.length > 0) col++;

    for (const id of sau) {
      placed.push({ node: byId.get(id)!, x: col * (BOX_W + GAP_X), y: midY });
      col++;
    }

    // Cạnh: chuỗi tuần tự, rồi tỏa ra nhánh và hợp lại.
    for (let i = 0; i < truoc.length - 1; i++) {
      edges.push({ from: truoc[i], to: truoc[i + 1] });
    }
    const cuoiTruoc = truoc.at(-1);
    const dauSau = sau[0];
    if (nhanh.length > 0) {
      for (const n of nhanh) {
        if (cuoiTruoc) edges.push({ from: cuoiTruoc, to: n.nodeId });
        if (dauSau) edges.push({ from: n.nodeId, to: dauSau });
      }
    } else if (cuoiTruoc && dauSau) {
      edges.push({ from: cuoiTruoc, to: dauSau });
    }
    for (let i = 0; i < sau.length - 1; i++) {
      edges.push({ from: sau[i], to: sau[i + 1] });
    }

    return {
      placed,
      edges,
      width: col * (BOX_W + GAP_X) + BOX_W,
      height: Math.max(laneH, BOX_H) + 20,
    };
  }, [nodes]);

  const viTri = useMemo(
    () => new Map(placed.map((p) => [p.node.nodeId, p] as const)),
    [placed],
  );

  if (placed.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Run này chạy trước khi có ghi nhận theo node.
      </p>
    );
  }

  return (
    <div className="overflow-auto rounded-lg border bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:16px_16px]">
      <svg
        width={width}
        height={height}
        className="min-w-full"
        role="img"
        aria-label="Sơ đồ pipeline node"
      >
        <defs>
          <marker
            id="mui-ten"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--muted-foreground)" />
          </marker>
        </defs>

        {edges.map((e, i) => {
          const a = viTri.get(e.from);
          const b = viTri.get(e.to);
          if (!a || !b) return null;
          const x1 = a.x + BOX_W;
          const y1 = a.y + BOX_H / 2;
          const x2 = b.x;
          const y2 = b.y + BOX_H / 2;
          const mx = (x1 + x2) / 2;
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke="var(--muted-foreground)"
              strokeOpacity={0.45}
              strokeWidth={1.5}
              markerEnd="url(#mui-ten)"
            />
          );
        })}

        {placed.map(({ node, x, y }) => {
          const mau = mauTheoTrangThai(node.status);
          const chon = node.nodeId === selectedNodeId;
          const nhan =
            NHAN[node.nodeId] ??
            (node.nodeId.startsWith("N8_LAP_PHUONG_AN")
              ? `Lập phương án ${node.nodeId.split("_").pop()}`
              : node.nodeId);
          return (
            <g
              key={node.nodeId}
              transform={`translate(${x}, ${y})`}
              onClick={() => onSelectNode?.(node.nodeId)}
              className="cursor-pointer"
            >
              <rect
                width={BOX_W}
                height={BOX_H}
                rx={10}
                fill={mau.nen}
                stroke={chon ? "var(--primary)" : mau.vien}
                strokeWidth={chon ? 2 : 1}
              />
              <text
                x={12}
                y={22}
                className="fill-foreground"
                style={{ fontSize: 12, fontWeight: 600 }}
              >
                {nhan.length > 24 ? `${nhan.slice(0, 23)}…` : nhan}
              </text>
              <text
                x={12}
                y={40}
                className="fill-muted-foreground"
                style={{ fontSize: 10, fontFamily: "monospace" }}
              >
                {((node.ms || 0) / 1000).toFixed(1)}s
                {node.tokens
                  ? ` · ${node.tokens.input + node.tokens.output} tk`
                  : ""}
              </text>
              <text
                x={12}
                y={54}
                style={{ fontSize: 10 }}
                className={
                  node.status === "loi"
                    ? "fill-destructive"
                    : "fill-muted-foreground"
                }
              >
                {node.status}
                {node.attempts > 1 ? ` · ${node.attempts} lần thử` : ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

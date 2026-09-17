"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Film,
  Flame,
  HelpCircle,
  Layers,
  Maximize2,
  MessageSquare,
  Mic,
  Minimize2,
  Move,
  Play,
  RotateCcw,
  Sparkles,
  Split,
  Type,
  User,
  Users,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dinhDangPhut } from "@/lib/revision/format";
import type {
  DecisionCase,
  DecisionRecord,
  FeedbackItem,
  ReleaseSnapshot,
  RevisionOption,
  ScriptData,
  SentenceData,
} from "@/lib/revision/types";
import type { StudioFeedback } from "@/lib/studio/types";

interface RevisionGraphViewProps {
  cases: DecisionCase[];
  selectedCaseId: string;
  onSelectCase: (caseId: string) => void;
  decisions: Record<string, DecisionRecord>;
  onSelectOption: (option: RevisionOption) => void;
  onDeferCase: (reason: string) => void;
  onRejectCase: (reason: string) => void;
  onResetCase: () => void;
  script?: ScriptData;
  feedbacks?: StudioFeedback[];
  allFeedback?: FeedbackItem[];
  snapshot?: ReleaseSnapshot | null;
  onViewDetailedScript?: (sentenceN: number) => void;
  onPlaySentence?: (batDauGiay: number) => void;
}

interface CalculatedEdge {
  id: string;
  d: string;
  color: string;
  markerId: string;
  strokeWidth: number;
  dashed?: boolean;
  label?: string;
  labelX?: number;
  labelY?: number;
}

export default function RevisionGraphView({
  cases,
  selectedCaseId,
  onSelectCase,
  decisions,
  onSelectOption,
  onDeferCase,
  onRejectCase,
  onResetCase,
  script,
  feedbacks = [],
  allFeedback = [],
  snapshot,
  onViewDetailedScript,
  onPlaySentence,
}: RevisionGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Zoom & Pan
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Filter state for left cases list
  const [filterMode, setFilterMode] = useState<
    | "tat-ca"
    | "cho-duyet"
    | "da-chon"
    | "hoan"
    | "giu-nguyen"
    | "trai-chieu"
    | "loi"
  >("tat-ca");
  const [searchQuery, setSearchQuery] = useState("");

  // Target case
  const currentCase = useMemo(() => {
    return cases.find((c) => c.id === selectedCaseId) || cases[0] || null;
  }, [cases, selectedCaseId]);

  const currentDecision = useMemo(() => {
    return currentCase ? decisions[currentCase.id] : undefined;
  }, [decisions, currentCase]);

  // Sentence map
  const sentenceMap = useMemo(() => {
    return new Map<number, SentenceData>(
      (script?.cau || []).map((c) => [c.n, c]),
    );
  }, [script]);

  // Feedback lookup
  const feedbackMap = useMemo(() => {
    return new Map<string, FeedbackItem>(allFeedback.map((f) => [f.id, f]));
  }, [allFeedback]);

  // Filtered cases list for sidebar
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const dec = decisions[c.id];
      const hasControversial =
        c.hasDisagreement || c.issues.some((iss) => iss.hasDisagreement);
      const hasInvalidOption = c.options.some(
        (opt) => opt.status === "khong-hop-le",
      );

      if (filterMode === "cho-duyet" && dec) return false;
      if (filterMode === "da-chon" && dec?.type !== "chon") return false;
      if (filterMode === "hoan" && dec?.type !== "hoan") return false;
      if (filterMode === "giu-nguyen" && dec?.type === "bo") return false;
      if (filterMode === "trai-chieu" && !hasControversial) return false;
      if (filterMode === "loi" && !hasInvalidOption) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesId = c.id.toLowerCase().includes(q);
        const matchesSentences = c.sentenceNs.some((n) =>
          String(n).includes(q),
        );
        return matchesTitle || matchesId || matchesSentences;
      }
      return true;
    });
  }, [cases, decisions, filterMode, searchQuery]);

  // Calculated SVG edges connecting cards in the 5 columns
  const [edges, setEdges] = useState<CalculatedEdge[]>([]);

  // Recalculate edge curves based on card positions
  const recalculateEdges = useCallback(() => {
    if (!canvasRef.current || !currentCase) return;
    const canvas = canvasRef.current;
    const canvasRect = canvas.getBoundingClientRect();

    const newEdges: CalculatedEdge[] = [];

    // Helper to get relative anchor point
    const getAnchor = (el: Element, side: "left" | "right") => {
      const rect = el.getBoundingClientRect();
      const x =
        side === "right"
          ? rect.right - canvasRect.left
          : rect.left - canvasRect.left;
      const y = rect.top + rect.height / 2 - canvasRect.top;
      // unscale by zoom
      return { x: x / zoom, y: y / zoom };
    };

    // Region Card -> Issue Cards
    const regionCard = canvas.querySelector(`#card-region-${currentCase.id}`);
    if (regionCard) {
      const rPoint = getAnchor(regionCard, "right");

      currentCase.issues.forEach((issue) => {
        const issueCard = canvas.querySelector(`#card-issue-${issue.id}`);
        if (!issueCard) return;
        const iPoint = getAnchor(issueCard, "left");

        const isControversial = issue.hasDisagreement;
        const color = isControversial ? "#f59e0b" : "#94a3b8";
        const dx = Math.max(30, (iPoint.x - rPoint.x) / 2);
        const d = `M ${rPoint.x} ${rPoint.y} C ${rPoint.x + dx} ${rPoint.y}, ${iPoint.x - dx} ${iPoint.y}, ${iPoint.x} ${iPoint.y}`;

        newEdges.push({
          id: `edge-region-issue-${issue.id}`,
          d,
          color,
          markerId: isControversial ? "arrow-amber" : "arrow-gray",
          strokeWidth: 2,
          dashed: isControversial,
          label: isControversial ? "Ý kiến trái chiều" : undefined,
          labelX: (rPoint.x + iPoint.x) / 2,
          labelY: (rPoint.y + iPoint.y) / 2 - 8,
        });

        // Issue Card -> Feedbacks / Evidence
        issue.feedbackIds.forEach((fid) => {
          const fbCard = canvas.querySelector(`#card-feedback-${fid}`);
          if (!fbCard) return;
          const iRight = getAnchor(issueCard, "right");
          const fbLeft = getAnchor(fbCard, "left");
          const fdx = Math.max(25, (fbLeft.x - iRight.x) / 2);
          const fd = `M ${iRight.x} ${iRight.y} C ${iRight.x + fdx} ${iRight.y}, ${fbLeft.x - fdx} ${fbLeft.y}, ${fbLeft.x} ${fbLeft.y}`;

          newEdges.push({
            id: `edge-issue-fb-${issue.id}-${fid}`,
            d: fd,
            color: isControversial ? "#f59e0b" : "#94a3b8",
            markerId: isControversial ? "arrow-amber" : "arrow-gray",
            strokeWidth: 1.5,
          });
        });

        // Issue Card -> Related Sentences
        currentCase.sentenceNs.forEach((n) => {
          const sCard = canvas.querySelector(`#card-sentence-${n}`);
          if (!sCard) return;
          const iRight = getAnchor(issueCard, "right");
          const sLeft = getAnchor(sCard, "left");
          const sdx = Math.max(25, (sLeft.x - iRight.x) / 2);
          const sd = `M ${iRight.x} ${iRight.y} C ${iRight.x + sdx} ${iRight.y}, ${sLeft.x - sdx} ${sLeft.y}, ${sLeft.x} ${sLeft.y}`;

          newEdges.push({
            id: `edge-issue-sent-${issue.id}-${n}`,
            d: sd,
            color: "#94a3b8",
            markerId: "arrow-gray",
            strokeWidth: 1.5,
          });
        });
      });
    }

    // Sentence / Issue -> Options
    currentCase.options.forEach((option) => {
      const optCard = canvas.querySelector(`#card-option-${option.id}`);
      if (!optCard) return;
      const optLeft = getAnchor(optCard, "left");
      const optRight = getAnchor(optCard, "right");

      const isSelected =
        currentDecision?.type === "chon" &&
        currentDecision.optionId === option.id;

      // Connect Issue 1 to option
      const firstIssue = currentCase.issues[0];
      if (firstIssue) {
        const issueCard = canvas.querySelector(`#card-issue-${firstIssue.id}`);
        if (issueCard) {
          const iRight = getAnchor(issueCard, "right");
          const odx = Math.max(30, (optLeft.x - iRight.x) / 2);
          const od = `M ${iRight.x} ${iRight.y} C ${iRight.x + odx} ${iRight.y}, ${optLeft.x - odx} ${optLeft.y}, ${optLeft.x} ${optLeft.y}`;

          newEdges.push({
            id: `edge-issue-opt-${option.id}`,
            d: od,
            color: isSelected ? "#10b981" : "#94a3b8",
            markerId: isSelected ? "arrow-emerald" : "arrow-gray",
            strokeWidth: isSelected ? 2.5 : 1.5,
            label: isSelected ? "Đã chọn" : undefined,
            labelX: (iRight.x + optLeft.x) / 2,
            labelY: (iRight.y + optLeft.y) / 2 - 8,
          });
        }
      }

      // Option -> Follow-up Impact Card (Cột 5)
      const impactCard = canvas.querySelector(`#card-impact-${option.id}`);
      if (impactCard) {
        const impLeft = getAnchor(impactCard, "left");
        const idx = Math.max(30, (impLeft.x - optRight.x) / 2);
        const id_path = `M ${optRight.x} ${optRight.y} C ${optRight.x + idx} ${optRight.y}, ${impLeft.x - idx} ${impLeft.y}, ${impLeft.x} ${impLeft.y}`;

        // Red dashed if option is invalid or blocked
        const isConflict = option.status === "khong-hop-le";
        const impactColor = isConflict
          ? "#ef4444"
          : isSelected
            ? "#10b981"
            : "#94a3b8";

        newEdges.push({
          id: `edge-opt-impact-${option.id}`,
          d: id_path,
          color: impactColor,
          markerId: isConflict
            ? "arrow-red"
            : isSelected
              ? "arrow-emerald"
              : "arrow-gray",
          strokeWidth: isSelected ? 2.5 : 1.5,
          dashed: Boolean(isConflict),
          label: isConflict
            ? "Không hợp lệ"
            : isSelected
              ? "Việc kéo theo v2"
              : undefined,
          labelX: (optRight.x + impLeft.x) / 2,
          labelY: (optRight.y + impLeft.y) / 2 - 8,
        });
      }
    });

    setEdges(newEdges);
  }, [currentCase, currentDecision, zoom]);

  // Recalculate on mount, selection, zoom, or after layout paints
  useEffect(() => {
    const timer = setTimeout(recalculateEdges, 60);
    return () => clearTimeout(timer);
  }, [recalculateEdges]);

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, input, select, a")) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - dragStart.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      setZoom((z) => Math.min(1.4, Math.max(0.4, z + delta)));
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col bg-background border rounded-2xl overflow-hidden shadow-xs select-none transition-all ${
        isFullscreen
          ? "fixed inset-0 z-50 rounded-none border-none h-screen w-screen"
          : "h-[740px] w-full"
      }`}
      onWheel={handleWheel}
    >
      {/* 1. TOOLBAR / CONTROLS TRÊN CÙNG */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b bg-card/90 backdrop-blur z-20">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
            <Split className="size-4 text-primary" />
            <span>Đồ thị đề xuất chỉnh sửa</span>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono py-0">
            {cases.length} vùng
          </Badge>

          {/* CHÚ GIẢI MÀU CẠNH (SPEC SECTION 5.3) */}
          <div className="hidden md:flex items-center gap-3 pl-3 text-[11px] text-muted-foreground border-l">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-slate-400" />
              <span>Thuộc về</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-amber-500" />
              <span>Trái chiều</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span>Phương án chọn</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-rose-500" />
              <span>Xung đột / không hợp lệ</span>
            </span>
          </div>
        </div>

        {/* CÁC NÚT THU PHÓNG / FULLSCREEN */}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))}
            className="h-7 w-7 p-0"
            title="Phóng to"
          >
            <ZoomIn className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
            className="h-7 w-7 p-0"
            title="Thu nhỏ"
          >
            <ZoomOut className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setZoom(0.85);
              setPan({ x: 20, y: 20 });
            }}
            className="h-7 px-2 text-[11px] gap-1 font-mono"
            title="Đặt lại góc nhìn"
          >
            <RotateCcw className="size-3" />
            <span>{Math.round(zoom * 100)}%</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-7 w-7 p-0"
            title={isFullscreen ? "Thu nhỏ cửa sổ" : "Toàn màn hình"}
          >
            {isFullscreen ? (
              <Minimize2 className="size-3.5" />
            ) : (
              <Maximize2 className="size-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* 2. KHUNG NỘI DUNG CHÍNH: CỘT TRÁI (DANH SÁCH VÙNG) + CANVAS ĐỒ THỊ 5 CỘT */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* SIDEBAR TRÁI: DANH SÁCH CÁC VÙNG SỬA */}
        <div className="w-64 sm:w-72 shrink-0 border-r bg-card/60 backdrop-blur flex flex-col z-10 overflow-hidden">
          {/* Bộ lọc vùng */}
          <div className="p-2 border-b space-y-2">
            <input
              type="text"
              placeholder="Tìm theo vùng, câu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-7 px-2 text-xs rounded-md border bg-background text-foreground"
            />

            <div className="flex flex-wrap gap-1 text-[10px]">
              <button
                type="button"
                onClick={() => setFilterMode("tat-ca")}
                className={`px-1.5 py-0.5 rounded ${
                  filterMode === "tat-ca"
                    ? "bg-primary text-primary-foreground font-bold"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("cho-duyet")}
                className={`px-1.5 py-0.5 rounded ${
                  filterMode === "cho-duyet"
                    ? "bg-primary text-primary-foreground font-bold"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                Chờ duyệt
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("da-chon")}
                className={`px-1.5 py-0.5 rounded ${
                  filterMode === "da-chon"
                    ? "bg-emerald-600 text-white font-bold"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                Đã chọn
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("trai-chieu")}
                className={`px-1.5 py-0.5 rounded ${
                  filterMode === "trai-chieu"
                    ? "bg-amber-600 text-white font-bold"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                Trái chiều
              </button>
            </div>
          </div>

          {/* Danh sách các nút vùng */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filteredCases.map((c) => {
              const isSelected = c.id === currentCase?.id;
              const dec = decisions[c.id];
              const isControversial =
                c.hasDisagreement ||
                c.issues.some((iss) => iss.hasDisagreement);

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectCase(c.id)}
                  className={`w-full text-left p-2 rounded-xl border text-xs transition-all flex flex-col gap-1 ${
                    isSelected
                      ? "bg-primary/10 border-primary ring-1 ring-primary/40 shadow-xs"
                      : "bg-card hover:bg-muted/40 border-border/80"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 text-[10px]">
                    <span className="font-mono font-bold text-primary truncate">
                      {c.id}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {c.sentenceNs.length > 0
                        ? `Câu ${c.sentenceNs.join(", ")}`
                        : "Chưa định vị"}
                    </span>
                  </div>

                  <p className="font-medium text-foreground text-[11px] line-clamp-1 leading-snug">
                    {c.title}
                  </p>

                  <div className="flex items-center gap-1.5 pt-0.5 text-[10px]">
                    {dec?.type === "chon" ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                        <CheckCircle2 className="size-3" /> Đã chọn
                      </span>
                    ) : dec?.type === "hoan" ? (
                      <span className="text-amber-600 font-medium">Hoãn</span>
                    ) : dec?.type === "bo" ? (
                      <span className="text-muted-foreground font-medium">
                        Giữ nguyên
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Chờ duyệt</span>
                    )}

                    {isControversial && (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 py-0 border-amber-400 text-amber-600"
                      >
                        Trái chiều
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* KHÔNG GIAN CANVAS 5 CỘT: PAN & ZOOM */}
        <div
          className="flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)] [background-size:16px_16px]"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* NỘI DUNG ĐỒ THỊ BIẾN HÌNH THEO PAN & ZOOM */}
          <div
            ref={canvasRef}
            className="absolute origin-top-left transition-transform duration-75"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              width: "2200px",
              minHeight: "1000px",
            }}
          >
            {/* SVG OVERLAY CHO CÁC CẠNH NỐI CONG */}
            <svg
              className="absolute inset-0 pointer-events-none w-full h-full z-0 overflow-visible"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <marker
                  id="arrow-gray"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#94a3b8" />
                </marker>
                <marker
                  id="arrow-amber"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#f59e0b" />
                </marker>
                <marker
                  id="arrow-emerald"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#10b981" />
                </marker>
                <marker
                  id="arrow-red"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#ef4444" />
                </marker>
              </defs>

              {edges.map((edge) => (
                <g key={edge.id}>
                  <path
                    d={edge.d}
                    fill="none"
                    stroke={edge.color}
                    strokeWidth={edge.strokeWidth}
                    strokeDasharray={edge.dashed ? "5,5" : undefined}
                    markerEnd={`url(#${edge.markerId})`}
                    opacity={0.85}
                  />
                  {edge.label && edge.labelX != null && edge.labelY != null && (
                    <text
                      x={edge.labelX}
                      y={edge.labelY}
                      fill={edge.color}
                      fontSize="10"
                      fontFamily="sans-serif"
                      fontWeight="600"
                      textAnchor="middle"
                      className="bg-background px-1"
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              ))}
            </svg>

            {/* 5 CỘT CHÍNH CỦA ĐỒ THỊ REVISION */}
            {currentCase ? (
              <div className="relative z-10 flex gap-12 p-8 items-start">
                {/* CỘT 1: [VÙNG SỬA] */}
                <div className="w-80 shrink-0 space-y-4">
                  <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <span>1. Vùng sửa</span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {currentCase.id}
                    </Badge>
                  </div>

                  <div
                    id={`card-region-${currentCase.id}`}
                    className="p-4 rounded-2xl border-2 border-primary/40 bg-card shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                        {currentCase.type === "vung"
                          ? "Vùng sửa"
                          : currentCase.type}
                      </Badge>
                      <span className="text-xs font-mono text-muted-foreground">
                        {currentCase.sentenceNs.length > 0
                          ? `Câu ${currentCase.sentenceNs.join(", ")}`
                          : "Chưa xác nhận vị trí"}
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-foreground leading-snug">
                      {currentCase.title}
                    </h3>

                    <div className="pt-2 border-t flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1 font-mono">
                        <Users className="size-3.5 text-primary" />
                        <span>
                          {currentCase.independentSenders} người góp ý
                        </span>
                      </span>
                      {currentCase.tuGiay != null &&
                        currentCase.denGiay != null && (
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="size-3.5" />
                            <span>
                              {dinhDangPhut(currentCase.tuGiay)}–
                              {dinhDangPhut(currentCase.denGiay)}
                            </span>
                          </span>
                        )}
                    </div>

                    {/* HÀNH ĐỘNG CHO TOÀN VÙNG: HOÃN / GIỮ NGUYÊN / RESET */}
                    <div className="pt-2 border-t flex items-center justify-end gap-1.5">
                      {currentDecision ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={onResetCase}
                          className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                        >
                          Bỏ chọn / Đặt lại
                        </Button>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeferCase("Để lại đợt sau")}
                            className="h-7 text-xs px-2 text-amber-600 hover:bg-amber-50"
                          >
                            Hoãn
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onRejectCase("Giữ nguyên v1")}
                            className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                          >
                            Giữ nguyên
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* CỘT 2: [VẤN ĐỀ 1..N] */}
                <div className="w-80 shrink-0 space-y-4">
                  <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <span>2. Vấn đề ({currentCase.issues.length})</span>
                    <Badge variant="secondary" className="text-[10px]">
                      N6 Gom vấn đề
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    {currentCase.issues.map((issue) => {
                      const isControversial = issue.hasDisagreement;

                      return (
                        <div
                          key={issue.id}
                          id={`card-issue-${issue.id}`}
                          className={`p-3.5 rounded-xl border bg-card shadow-xs space-y-2.5 transition-all ${
                            isControversial
                              ? "border-amber-400/80 ring-1 ring-amber-400/20"
                              : "border-border"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5 text-[10px]">
                            <Badge
                              variant="outline"
                              className="font-mono text-[9px]"
                            >
                              {issue.id}
                            </Badge>
                            <Badge
                              variant="secondary"
                              className={`text-[9px] ${
                                issue.category === "noi-dung-sai"
                                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                  : issue.category === "giong-doc"
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                    : "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                              }`}
                            >
                              {issue.category}
                            </Badge>
                          </div>

                          <p className="font-semibold text-xs text-foreground leading-snug">
                            {issue.summary}
                          </p>

                          {/* THỐNG KÊ NGƯỜI GỬI & TRÁI CHIỀU */}
                          <div className="flex flex-wrap items-center gap-2 text-[10px]">
                            <span className="font-mono text-muted-foreground flex items-center gap-1">
                              <Users className="size-3 text-primary" />
                              <span>{issue.independentSenders} người gửi</span>
                            </span>

                            {isControversial && (
                              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 text-[9px] py-0">
                                ⚠ Trái chiều
                              </Badge>
                            )}
                          </div>

                          {/* NGUỒN VỊ TRÍ & NÚT BÁO VỊ TRÍ SAI */}
                          <div className="pt-2 border-t flex items-center justify-between gap-2 text-[10px]">
                            <span className="text-muted-foreground">
                              Vị trí:{" "}
                              <strong className="text-foreground font-mono">
                                {issue.location.sentenceNs.length > 0
                                  ? `Câu ${issue.location.sentenceNs.join(",")}`
                                  : "Chưa định vị"}
                              </strong>
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                alert(
                                  `Báo vị trí sai cho vấn đề ${issue.id}. Sẽ chạy lại N4→N9.`,
                                )
                              }
                              className="text-primary hover:underline"
                            >
                              Báo vị trí sai
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* CỘT 3: [BẰNG CHỨNG / GÓP Ý] & [CÂU V1 LIÊN QUAN] */}
                <div className="w-88 shrink-0 space-y-4">
                  <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <span>3. Bằng chứng & Ngữ cảnh v1</span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {currentCase.sentenceNs.length} câu
                    </span>
                  </div>

                  <div className="space-y-4">
                    {/* KHỐI BẰNG CHỨNG GÓP Ý */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                        <MessageSquare className="size-3 text-primary" />
                        <span>Trích dẫn góp ý gốc</span>
                      </span>

                      {currentCase.issues
                        .flatMap((iss) => iss.feedbackIds)
                        .slice(0, 4)
                        .map((fid) => {
                          const fb = feedbackMap.get(fid);
                          return (
                            <div
                              key={fid}
                              id={`card-feedback-${fid}`}
                              className="p-2.5 rounded-lg border bg-card/80 text-xs space-y-1 shadow-2xs"
                            >
                              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                                <span className="font-bold text-foreground">
                                  {fid}
                                </span>
                                <span>
                                  Người gửi: {fb?.sender || "Học viên"}
                                </span>
                              </div>
                              <p className="text-[11px] text-foreground italic">
                                "
                                {fb?.sanitizedText ||
                                  fb?.rawText ||
                                  "Nội dung góp ý"}
                                "
                              </p>
                            </div>
                          );
                        })}
                    </div>

                    {/* KHỐI CÂU V1 LIÊN QUAN */}
                    <div className="space-y-2 pt-2 border-t">
                      <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                        <Film className="size-3 text-primary" />
                        <span>Câu v1 liên quan</span>
                      </span>

                      {currentCase.sentenceNs.length === 0 ? (
                        <div className="p-3 rounded-lg border border-dashed text-xs text-muted-foreground text-center">
                          Vị trí chưa xác nhận trong video
                        </div>
                      ) : (
                        currentCase.sentenceNs.map((n) => {
                          const s = sentenceMap.get(n);
                          return (
                            <div
                              key={n}
                              id={`card-sentence-${n}`}
                              className="p-3 rounded-lg border bg-card text-xs space-y-2 shadow-2xs"
                            >
                              <div className="flex items-center justify-between">
                                <Badge
                                  variant="outline"
                                  className="font-mono text-[10px]"
                                >
                                  Câu {n}
                                </Badge>
                                {s && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onPlaySentence?.(s.batDauGiay)
                                    }
                                    className="flex items-center gap-1 text-[10px] text-primary hover:underline font-mono"
                                  >
                                    <Play className="size-2.5 fill-current" />
                                    <span>{dinhDangPhut(s.batDauGiay)}</span>
                                  </button>
                                )}
                              </div>

                              {s && (
                                <>
                                  <p className="text-[11px] text-foreground font-medium">
                                    {s.loi || "(không có lời đọc)"}
                                  </p>
                                  {s.chuTrenManHinh && (
                                    <p className="text-[10px] text-muted-foreground font-mono bg-muted/30 p-1 rounded">
                                      Chữ: {s.chuTrenManHinh}
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* CỘT 4: [PHƯƠNG ÁN A | B] */}
                <div className="w-88 shrink-0 space-y-4">
                  <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <span>4. Phương án ({currentCase.options.length})</span>
                    <Badge variant="secondary" className="text-[10px]">
                      N8 Lập phương án
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    {currentCase.options.map((option) => {
                      const isSelected =
                        currentDecision?.type === "chon" &&
                        currentDecision.optionId === option.id;
                      const isInvalid = option.status === "khong-hop-le";

                      return (
                        <div
                          key={option.id}
                          id={`card-option-${option.id}`}
                          className={`p-3.5 rounded-xl border bg-card shadow-xs space-y-3 transition-all ${
                            isSelected
                              ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/10 dark:bg-emerald-950/10"
                              : isInvalid
                                ? "border-rose-300 opacity-80"
                                : "border-border hover:border-primary/40"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-mono ${
                                isSelected
                                  ? "border-emerald-500 text-emerald-600 font-bold"
                                  : ""
                              }`}
                            >
                              {option.id}
                            </Badge>

                            <Badge
                              variant="secondary"
                              className={`text-[9px] ${
                                option.status === "hop-le"
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50"
                                  : "bg-rose-50 text-rose-700 dark:bg-rose-950/50"
                              }`}
                            >
                              {option.status}
                            </Badge>
                          </div>

                          <h4 className="font-bold text-xs text-foreground leading-snug">
                            {option.title}
                          </h4>

                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            {option.rationale}
                          </p>

                          {/* DIFF TRƯỚC -> SAU */}
                          {option.patches && option.patches.length > 0 && (
                            <div className="pt-2 border-t space-y-1.5 text-[11px]">
                              {option.patches.map((p, idx) => (
                                <div
                                  key={idx}
                                  className="bg-muted/30 p-2 rounded-lg space-y-1 font-mono text-[10px]"
                                >
                                  <div className="flex items-center justify-between text-muted-foreground">
                                    <span>
                                      Câu {p.n} · {p.field}
                                    </span>
                                  </div>
                                  <div className="text-rose-600 line-through truncate">
                                    - {p.before || "(trống)"}
                                  </div>
                                  <div className="text-emerald-600 font-medium truncate">
                                    + {p.after}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* NÚT CHỌN PHƯƠNG ÁN */}
                          <div className="pt-2 border-t flex items-center justify-between">
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {option.standaloneWork?.cauThuLai?.length
                                ? `Thu lại: ${option.standaloneWork.cauThuLai.join(", ")}`
                                : "Không cần thu lại"}
                            </span>

                            <Button
                              type="button"
                              size="sm"
                              variant={isSelected ? "default" : "outline"}
                              disabled={isInvalid}
                              onClick={() => onSelectOption(option)}
                              className={`h-7 px-3 text-xs gap-1 font-bold ${
                                isSelected
                                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                  : "hover:bg-primary/5 hover:text-primary"
                              }`}
                            >
                              {isSelected ? (
                                <>
                                  <Check className="size-3.5" />
                                  <span>Đã chọn</span>
                                </>
                              ) : (
                                <span>Chọn phương án</span>
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* CỘT 5: [VIỆC KÉO THEO TRONG BẢN SỬA V2] */}
                <div className="w-80 shrink-0 space-y-4">
                  <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <span>5. Việc kéo theo</span>
                    <Badge variant="secondary" className="text-[10px]">
                      N9 Tính việc
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    {currentCase.options.map((option) => {
                      const isSelected =
                        currentDecision?.type === "chon" &&
                        currentDecision.optionId === option.id;
                      const isInvalid = option.status === "khong-hop-le";

                      return (
                        <div
                          key={option.id}
                          id={`card-impact-${option.id}`}
                          className={`p-3.5 rounded-xl border bg-card shadow-xs space-y-2.5 transition-all ${
                            isSelected
                              ? "border-emerald-500/80 bg-emerald-50/10 dark:bg-emerald-950/10 ring-1 ring-emerald-500/20"
                              : "border-border/80"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 text-[10px]">
                            <span className="font-mono text-muted-foreground">
                              Kéo theo: {option.id}
                            </span>
                            {isSelected && (
                              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[9px] py-0">
                                Đang vào gói v2
                              </Badge>
                            )}
                          </div>

                          <div className="space-y-1.5 text-xs">
                            <div className="flex items-center justify-between p-1.5 rounded bg-muted/20">
                              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <Mic className="size-3 text-primary" /> Thu lại
                                giọng:
                              </span>
                              <span className="font-mono font-bold text-[11px] text-foreground">
                                {option.standaloneWork?.cauThuLai?.length
                                  ? `Câu ${option.standaloneWork.cauThuLai.join(", ")}`
                                  : "0 câu"}
                              </span>
                            </div>

                            <div className="flex items-center justify-between p-1.5 rounded bg-muted/20">
                              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <Film className="size-3 text-primary" /> Dựng
                                lại cảnh:
                              </span>
                              <span className="font-mono font-bold text-[11px] text-foreground">
                                {option.standaloneWork?.canhDungLai?.length
                                  ? `${option.standaloneWork.canhDungLai.length} cảnh`
                                  : "0 cảnh"}
                              </span>
                            </div>

                            <div className="flex items-center justify-between p-1.5 rounded bg-muted/20">
                              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <Type className="size-3 text-primary" /> Phụ đề:
                              </span>
                              <span className="font-mono font-bold text-[11px] text-foreground">
                                {option.standaloneWork?.phuDeSua?.length
                                  ? `${option.standaloneWork.phuDeSua.length} câu`
                                  : "Không"}
                              </span>
                            </div>
                          </div>

                          {/* CẢNH BÁO NẾU PHƯƠNG ÁN KHÔNG HỢP LỆ */}
                          {isInvalid && (
                            <div className="p-2 rounded-lg border border-rose-300 bg-rose-50/40 dark:bg-rose-950/20 text-[10px] text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                              <AlertTriangle className="size-3.5 text-rose-600 shrink-0" />
                              <span>Phương án không hợp lệ</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center p-20 text-muted-foreground text-xs">
                Không có dữ liệu vùng sửa để hiển thị đồ thị.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

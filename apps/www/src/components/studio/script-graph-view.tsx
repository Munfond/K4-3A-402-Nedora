"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Expand,
  Eye,
  Film,
  FolderGit2,
  GitBranch,
  Layers,
  Maximize2,
  MessageSquare,
  MessageSquarePlus,
  Mic,
  Minimize2,
  Move,
  Network,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Type,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { dinhDangPhut } from "@/lib/revision/format";
import {
  getFullSlideGroups,
  getSlideMetaForSentence,
} from "@/lib/studio/slides";
import type { ScriptData, SentenceData } from "@/lib/revision/types";
import type { StudioFeedback, StudioVideo } from "@/lib/studio/types";

interface ScriptGraphViewProps {
  video: StudioVideo;
  script?: ScriptData;
  feedbacks?: StudioFeedback[];
  highlightSentenceN?: number;
  onPlaySentence: (batDauGiay: number) => void;
  onAddFeedbackAtSentence: (sentenceN: number, slideId: string) => void;
  onFilterFeedbackBySentence?: (sentenceN: number) => void;
}

interface ConnectionReq {
  id: string;
  fromId: string;
  toId: string;
  color: string;
  markerId: string;
  strokeWidth: number;
  dashed?: boolean;
  opacity?: number;
}

interface CalculatedPath {
  id: string;
  d: string;
  color: string;
  markerId: string;
  strokeWidth: number;
  dashed?: boolean;
  opacity?: number;
}

export default function ScriptGraphView({
  video,
  script,
  feedbacks = [],
  highlightSentenceN,
  onPlaySentence,
  onAddFeedbackAtSentence,
  onFilterFeedbackBySentence,
}: ScriptGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContentRef = useRef<HTMLDivElement>(null);

  // Canvas Pan & Zoom State (Không cuộn trang, mặc định zoom 0.6 để bao quát toàn cây thoáng đãng)
  const [zoom, setZoom] = useState(0.6);
  const [pan, setPan] = useState({ x: 30, y: 30 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showInspector, setShowInspector] = useState(false);

  // Active Filter & Selection State
  const [activeSectionSo, setActiveSectionSo] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSlideId, setSelectedSlideId] = useState<string>("s01");
  const [selectedSentenceN, setSelectedSentenceN] = useState<number | null>(
    null,
  );
  const [lightboxImage, setLightboxImage] = useState<{
    src: string;
    title: string;
  } | null>(null);

  const rawSlideGroups = useMemo(() => getFullSlideGroups(), []);

  const sentenceMap = useMemo(() => {
    return new Map<number, SentenceData>(
      (script?.cau || []).map((c) => [c.n, c]),
    );
  }, [script]);

  const sections = useMemo(() => {
    return (
      script?.phan || [
        { so: 1, ten: "Mở đầu — hai công cụ, hai nhiệm vụ" },
        { so: 2, ten: "Trí tuệ nhân tạo và học máy" },
        { so: 3, ten: "Tạo nội dung và xử lý ngôn ngữ" },
        { so: 4, ten: "Đặt ba ứng dụng lên bản đồ" },
        { so: 5, ten: "Tự kiểm tra và chốt bản đồ" },
      ]
    );
  }, [script]);

  // Chỉ lấy góp ý có vị trí do người gửi chọn (P0a - không hiển thị vị trí do AI suy luận ở tab này)
  const senderFeedbacks = useMemo(() => {
    return feedbacks.filter((f) => f.locationSource !== "ai-de-xuat");
  }, [feedbacks]);

  const unlocatedFeedbackCount = useMemo(() => {
    return senderFeedbacks.filter((f) => f.sentenceN == null).length;
  }, [senderFeedbacks]);

  const feedbacksBySentence = useMemo(() => {
    const map = new Map<number, StudioFeedback[]>();
    for (const f of senderFeedbacks) {
      if (f.sentenceN != null) {
        const list = map.get(f.sentenceN) || [];
        list.push(f);
        map.set(f.sentenceN, list);
      }
    }
    return map;
  }, [senderFeedbacks]);

  // Slides by section
  const slidesBySection = useMemo(() => {
    const map = new Map<number, typeof rawSlideGroups>();
    for (const sec of sections) {
      const list = rawSlideGroups.filter((g) => {
        const first = sentenceMap.get(g.cau[0]);
        return first ? first.phan === sec.so : false;
      });
      map.set(sec.so, list);
    }
    return map;
  }, [sections, rawSlideGroups, sentenceMap]);

  // Highlight effect when requested externally
  useEffect(() => {
    if (highlightSentenceN) {
      setSelectedSentenceN(highlightSentenceN);
      const meta = getSlideMetaForSentence(highlightSentenceN);
      if (meta) {
        setSelectedSlideId(meta.slideId);
        const s = sentenceMap.get(highlightSentenceN);
        if (s) setActiveSectionSo(s.phan);
      }
    }
  }, [highlightSentenceN, sentenceMap]);

  // Bắt sự kiện kéo chuột (Window Listeners: Không bao giờ bị kẹt khi rê chuột ra ngoài thẻ)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest(".interactive-node")
    ) {
      return;
    }
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    };

    const handleWindowMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [isDragging, dragStart]);

  // Hỗ trợ thu phóng mượt mà bằng con lăn chuột (Mouse Wheel Zoom) hoặc cử chỉ trackpad
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY;
      const factor = delta < 0 ? 1.08 : 0.92;
      setZoom((z) => {
        const nextZoom = Math.min(
          1.5,
          Math.max(0.3, Math.round(z * factor * 100) / 100),
        );
        return nextZoom;
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // Zoom Handlers
  const zoomIn = () =>
    setZoom((z) => Math.min(1.5, Math.round((z + 0.1) * 10) / 10));
  const zoomOut = () =>
    setZoom((z) => Math.max(0.3, Math.round((z - 0.1) * 10) / 10));
  const resetZoom = () => {
    setZoom(0.85);
    setPan({ x: 30, y: 30 });
  };
  const fitToScreen = () => {
    setZoom(0.42);
    setPan({ x: 20, y: 20 });
  };

  // Lọc Section hiển thị
  const visibleSections = useMemo(() => {
    if (activeSectionSo === "all") return sections;
    return sections.filter((s) => s.so === activeSectionSo);
  }, [sections, activeSectionSo]);

  // Kiểm tra slide có khớp tìm kiếm không
  const isSlideMatchingSearch = useCallback(
    (slide: (typeof rawSlideGroups)[0]) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      if (slide.id.toLowerCase().includes(q)) return true;
      return slide.cau.some((n) => {
        const s = sentenceMap.get(n);
        if (!s) return false;
        return (
          `câu ${n}`.includes(q) ||
          String(n) === q ||
          (s.loi || "").toLowerCase().includes(q) ||
          (s.chuTrenManHinh || "").toLowerCase().includes(q)
        );
      });
    },
    [searchQuery, sentenceMap],
  );

  // Selected slide details
  const activeSlide = useMemo(() => {
    return (
      rawSlideGroups.find((g) => g.id === selectedSlideId) || rawSlideGroups[0]
    );
  }, [rawSlideGroups, selectedSlideId]);

  // Active inspector sentence
  const activeSentence = useMemo(() => {
    if (selectedSentenceN != null) {
      return sentenceMap.get(selectedSentenceN) || null;
    }
    if (activeSlide && activeSlide.cau.length > 0) {
      return sentenceMap.get(activeSlide.cau[0]) || null;
    }
    return null;
  }, [selectedSentenceN, activeSlide, sentenceMap]);

  // KHAI BÁO TOÀN BỘ CÁC ĐƯỜNG NỐI MŨI TÊN (TOÀN CẢNH CÂY KỊCH BẢN)
  const [calculatedPaths, setCalculatedPaths] = useState<CalculatedPath[]>([]);

  const connectionsToDraw = useMemo<ConnectionReq[]>(() => {
    const reqs: ConnectionReq[] = [];

    // 1. Nhánh từ Gốc Video ──▶ Mỗi Phần kịch bản hiển thị (Cột 0 ➔ Cột 1)
    for (const sec of visibleSections) {
      reqs.push({
        id: `root-to-sec-${sec.so}`,
        fromId: "node-root-video",
        toId: `node-section-${sec.so}`,
        color: "#a855f7",
        markerId: "arrow-purple",
        strokeWidth: 2,
      });

      // 2. Nhánh từ Phần ──▶ Từng Slide trong Phần đó (Cột 1 ➔ Cột 2)
      const secSlides = slidesBySection.get(sec.so) || [];
      for (const slide of secSlides) {
        if (!isSlideMatchingSearch(slide)) continue;

        const isSlideSelected = selectedSlideId === slide.id;
        reqs.push({
          id: `sec-${sec.so}-to-slide-${slide.id}`,
          fromId: `node-section-${sec.so}`,
          toId: `node-slide-${slide.id}`,
          color: isSlideSelected ? "#f59e0b" : "#d97706",
          markerId: "arrow-amber",
          strokeWidth: isSlideSelected ? 2.5 : 1.5,
          opacity: isSlideSelected ? 1 : 0.65,
        });

        // 3. Nhánh từ Slide ──▶ Từng Câu Transcript con của slide đó (Cột 2 ➔ Cột 3)
        for (const sentenceN of slide.cau) {
          const isSentenceSelected = selectedSentenceN === sentenceN;
          reqs.push({
            id: `slide-${slide.id}-to-tr-${sentenceN}`,
            fromId: `node-slide-${slide.id}`,
            toId: `node-transcript-${sentenceN}`,
            color: isSentenceSelected ? "#10b981" : "#0d9488",
            markerId: isSentenceSelected ? "arrow-emerald" : "arrow-teal",
            strokeWidth: isSentenceSelected ? 2.5 : 1.5,
            opacity: isSentenceSelected ? 1 : 0.7,
          });

          // 4. Nhánh từ Câu Transcript ──▶ Góp Ý người gửi (Cột 3 ➔ Cột 4)
          const sentenceFeedbacks = feedbacksBySentence.get(sentenceN) || [];
          for (const fb of sentenceFeedbacks) {
            reqs.push({
              id: `tr-${sentenceN}-to-fb-${fb.id}`,
              fromId: `node-transcript-${sentenceN}`,
              toId: `node-feedback-${fb.id}`,
              color: "#f59e0b",
              markerId: "arrow-amber",
              strokeWidth: 1.8,
            });
          }
        }
      }
    }

    return reqs;
  }, [
    visibleSections,
    slidesBySection,
    isSlideMatchingSearch,
    selectedSlideId,
    selectedSentenceN,
    feedbacksBySentence,
  ]);

  // Tính toán tọa độ đường cong Cubic Bezier giữa các thẻ hiển thị
  const calculatePaths = useCallback(() => {
    if (!canvasContentRef.current) return;
    const containerRect = canvasContentRef.current.getBoundingClientRect();

    const newPaths: CalculatedPath[] = [];

    for (const conn of connectionsToDraw) {
      const fromEl = document.getElementById(conn.fromId);
      const toEl = document.getElementById(conn.toId);

      // QUAN TRỌNG: Chỉ vẽ mũi tên nếu CẢ HAI THẺ ĐANG HIỂN THỊ trong DOM
      if (!fromEl || !toEl) continue;

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      // Điểm neo xuất phát: Cạnh phải của thẻ nguồn
      const x1 = (fromRect.right - containerRect.left) / zoom;
      const y1 =
        (fromRect.top + fromRect.height / 2 - containerRect.top) / zoom;

      // Điểm neo kết thúc: Cạnh trái của thẻ đích (trừ 2px để mũi tên tiếp xúc trực tiếp viền)
      const x2 = (toRect.left - containerRect.left) / zoom - 2;
      const y2 = (toRect.top + toRect.height / 2 - containerRect.top) / zoom;

      // Độ uốn cong mượt mà theo phương ngang, thoáng đãng giữa các cột
      const dx = Math.max(36, Math.min(150, Math.abs(x2 - x1) * 0.5));
      const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

      newPaths.push({
        id: conn.id,
        d,
        color: conn.color,
        markerId: conn.markerId,
        strokeWidth: conn.strokeWidth,
        dashed: conn.dashed,
        opacity: conn.opacity,
      });
    }

    setCalculatedPaths(newPaths);
  }, [connectionsToDraw, zoom]);

  // Cập nhật đường nối ngay khi thay đổi lựa chọn hoặc đổi zoom/kích thước
  useEffect(() => {
    const handleUpdate = () => {
      calculatePaths();
    };
    const raf1 = requestAnimationFrame(handleUpdate);
    const timer = setTimeout(handleUpdate, 80);
    window.addEventListener("resize", handleUpdate);
    return () => {
      cancelAnimationFrame(raf1);
      clearTimeout(timer);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [calculatePaths]);

  return (
    <div
      className={`rounded-2xl border bg-card shadow-sm flex flex-col overflow-hidden relative ${
        isFullscreen
          ? "fixed inset-0 z-50 rounded-none h-screen w-screen"
          : "h-[calc(100vh-210px)] min-h-[600px] max-h-[850px]"
      }`}
    >
      {/* THANH ĐIỀU KHIỂN ĐỈNH CANVAS (FLOATING TOOLBAR) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 px-4 border-b bg-muted/40 backdrop-blur z-20 shrink-0 text-xs">
        {/* Lọc theo 5 Phần */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-full">
          <span className="font-semibold text-muted-foreground mr-1 flex items-center gap-1 text-[11px] shrink-0">
            <Network className="size-3.5 text-primary" /> Sơ đồ cây:
          </span>
          <Button
            type="button"
            variant={activeSectionSo === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveSectionSo("all")}
            className="h-7 text-xs px-2.5 font-medium shrink-0"
          >
            Hiện tất cả cây (5 phần)
          </Button>
          {sections.map((sec) => (
            <Button
              key={sec.so}
              type="button"
              variant={activeSectionSo === sec.so ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveSectionSo(sec.so)}
              className="h-7 text-xs px-2.5 font-medium shrink-0"
            >
              Phần {sec.so}
            </Button>
          ))}
        </div>

        {/* Ô tìm kiếm & Bộ điều khiển Zoom / Fullscreen / Inspector */}
        <div className="flex items-center gap-2">
          <div className="relative w-44 sm:w-56">
            <Search className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Tìm slide, lời đọc, câu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 h-7 text-xs bg-background"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 bg-background border rounded-lg p-0.5 shadow-2xs font-mono text-xs">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={zoomOut}
              className="size-6 p-0 text-muted-foreground hover:text-foreground"
              title="Thu nhỏ (-)"
            >
              <ZoomOut className="size-3.5" />
            </Button>
            <span className="px-1 text-[11px] font-medium min-w-9 text-center text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={zoomIn}
              className="size-6 p-0 text-muted-foreground hover:text-foreground"
              title="Phóng to (+)"
            >
              <ZoomIn className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={fitToScreen}
              className="size-6 p-0 text-muted-foreground hover:text-foreground"
              title="Vừa màn hình (Fit)"
            >
              <Maximize2 className="size-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetZoom}
              className="size-6 p-0 text-muted-foreground hover:text-foreground"
              title="Đặt lại 100%"
            >
              <RotateCcw className="size-3" />
            </Button>
          </div>

          <Button
            type="button"
            variant={showInspector ? "default" : "outline"}
            size="sm"
            onClick={() => setShowInspector(!showInspector)}
            className="h-7 text-xs px-2.5 gap-1.5 shrink-0"
            title="Bật/tắt thanh tra chi tiết khung hình và kỹ thuật"
          >
            <Eye className="size-3.5" />
            <span>
              {showInspector ? "Đóng thanh tra" : "Thanh tra chi tiết"}
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="size-7 p-0 text-muted-foreground hover:text-foreground shrink-0"
            title={
              isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình canvas"
            }
          >
            {isFullscreen ? (
              <Minimize2 className="size-3.5" />
            ) : (
              <Expand className="size-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* VÙNG CANVAS CHÍNH (INTERACTIVE PAN & ZOOM CANVAS - ZERO VERTICAL SCROLL) */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        className={`flex-1 relative overflow-hidden select-none bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:18px_18px] ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        {/* Hướng dẫn thao tác nhanh */}
        <div className="absolute left-3 bottom-3 z-10 pointer-events-none opacity-60 hover:opacity-100 transition-opacity bg-background/80 backdrop-blur border px-2.5 py-1 rounded-md text-[10px] text-muted-foreground flex items-center gap-2">
          <Move className="size-3 text-primary" />
          <span>
            Giữ & kéo chuột để di chuyển canvas · Lăn chuột hoặc chạm 2 ngón để
            phóng to/thu nhỏ
          </span>
        </div>

        {/* NỘI DUNG SƠ ĐỒ CÂY DỊCH CHUYỂN THEO PAN & ZOOM */}
        <div
          ref={canvasContentRef}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            transition: isDragging ? "none" : "transform 0.08s ease-out",
          }}
          className="absolute left-0 top-0 flex items-start gap-16 p-8 min-w-max"
        >
          {/* LỚP PHỦ SVG VẼ CÁC MŨI TÊN NỐI NHAU NẾU THẺ CÓ HIỂN THỊ */}
          <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible z-10">
            <defs>
              <marker
                id="arrow-purple"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#a855f7" />
              </marker>
              <marker
                id="arrow-amber"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f59e0b" />
              </marker>
              <marker
                id="arrow-emerald"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10b981" />
              </marker>
              <marker
                id="arrow-teal"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0d9488" />
              </marker>
              <marker
                id="arrow-rose"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f43f5e" />
              </marker>
            </defs>

            {calculatedPaths.map((p) => (
              <g key={p.id}>
                {p.strokeWidth >= 2.5 && (
                  <path
                    d={p.d}
                    fill="none"
                    stroke={p.color}
                    strokeWidth={p.strokeWidth + 2.5}
                    strokeOpacity={0.16}
                    strokeLinecap="round"
                  />
                )}
                <path
                  d={p.d}
                  fill="none"
                  stroke={p.color}
                  strokeWidth={p.strokeWidth}
                  strokeDasharray={p.dashed ? "4 4" : undefined}
                  strokeOpacity={p.opacity ?? 0.85}
                  markerEnd={`url(#${p.markerId})`}
                  strokeLinecap="round"
                />
              </g>
            ))}
          </svg>

          {/* CỘT 0: GỐC KỊCH BẢN VIDEO (RIÊNG BIỆT NGOÀI CÙNG BÊN TRÁI - LEVEL 0) */}
          <div className="w-64 shrink-0 flex flex-col pt-3">
            <div
              id="node-root-video"
              className="rounded-2xl border-2 border-primary/60 bg-card p-4 shadow-md space-y-2.5 interactive-node relative"
            >
              {/* Cổng neo phát mũi tên bên phải sang 5 Phần */}
              <div className="absolute -right-2 top-1/2 -translate-y-1/2 size-3.5 rounded-full bg-primary ring-4 ring-background z-20 shadow-xs" />

              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase text-primary tracking-wider flex items-center gap-1">
                  <Network className="size-3" /> Gốc Kịch Bản
                </span>
                <Badge variant="outline" className="text-[9px] font-mono">
                  {video.currentVersion}
                </Badge>
              </div>

              <h3 className="font-bold text-xs text-foreground leading-snug">
                {video.title}
              </h3>

              <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
                {video.description ||
                  "Video phân biệt AI, học máy, tạo sinh và mô hình ngôn ngữ lớn."}
              </p>

              <div className="text-[10px] text-muted-foreground font-mono flex items-center justify-between pt-2 border-t">
                <span>{dinhDangPhut(video.durationSeconds)}</span>
                <span>·</span>
                <span>{sections.length} phần</span>
                <span>·</span>
                <span>{rawSlideGroups.length} slide</span>
                <span>·</span>
                <span>{script?.cau.length || 40} câu</span>
              </div>
            </div>
          </div>

          {/* CỘT 1 ➔ CỘT 2 ➔ CỘT 3 ➔ CỘT 4: CÁC PHẦN, SLIDE, TRANSCRIPTS & VÙNG SỬA */}
          <div className="flex flex-col gap-14">
            {visibleSections.map((sec) => {
              const secSlides = slidesBySection.get(sec.so) || [];
              const secSentences = secSlides.reduce(
                (acc, s) => acc + s.cau.length,
                0,
              );
              const isSelectedSection = activeSectionSo === sec.so;

              return (
                <div
                  key={sec.so}
                  className="flex items-start gap-14 border border-border/70 rounded-2xl p-5 bg-card/40 backdrop-blur-xs shadow-2xs"
                >
                  {/* CỘT 1: THẺ PHẦN KỊCH BẢN (LEVEL 1) */}
                  <div className="w-56 shrink-0 pt-2">
                    <div
                      id={`node-section-${sec.so}`}
                      onClick={() =>
                        setActiveSectionSo(isSelectedSection ? "all" : sec.so)
                      }
                      className={`rounded-xl border p-3 transition-all cursor-pointer interactive-node space-y-2 shadow-2xs relative ${
                        isSelectedSection
                          ? "bg-purple-500/10 border-purple-500 text-purple-900 dark:text-purple-200 ring-2 ring-purple-500/30"
                          : "bg-card hover:border-purple-300 text-foreground"
                      }`}
                    >
                      {/* Cổng neo nhận từ Gốc Video */}
                      <div className="absolute -left-2 top-1/2 -translate-y-1/2 size-3 rounded-full bg-purple-500 ring-2 ring-background z-20" />
                      {/* Cổng neo phát sang các Slide */}
                      <div className="absolute -right-2 top-1/2 -translate-y-1/2 size-3 rounded-full bg-purple-500 ring-2 ring-background z-20" />

                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5">
                          <FolderGit2 className="size-3.5 text-purple-600 shrink-0" />
                          <span className="font-bold text-xs">
                            Phần {sec.so}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[9px] font-mono"
                        >
                          {secSlides.length} slide
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground leading-snug">
                        {sec.ten}
                      </p>

                      <div className="text-[10px] text-muted-foreground font-mono pt-1 border-t flex items-center justify-between">
                        <span>{secSentences} câu kịch bản</span>
                        <span>{secSlides.length} slide</span>
                      </div>
                    </div>
                  </div>

                  {/* CỘT 2 & 3 & 4: DANH SÁCH SLIDE VÀ TRANSCRIPTS CỦA PHẦN NÀY (HÀNG NGANG KHỚP NHAU) */}
                  <div className="flex flex-col gap-8">
                    {secSlides.map((slide) => {
                      if (!isSlideMatchingSearch(slide)) return null;

                      const isSelectedSlide = selectedSlideId === slide.id;
                      const primarySentence = sentenceMap.get(slide.cau[0]);
                      const slideImage =
                        slide.sentences[0]?.image || `/slide-anh/cau-01.jpg`;
                      const slideFeedbacks = slide.cau.flatMap(
                        (n) => feedbacksBySentence.get(n) || [],
                      );

                      return (
                        <div key={slide.id} className="flex items-start gap-14">
                          {/* CỘT 2: THẺ SLIDE (FRAME THUMBNAIL + TIÊU ĐỀ SLIDE - LEVEL 2) */}
                          <div className="w-72 shrink-0">
                            <div
                              id={`node-slide-${slide.id}`}
                              onClick={() => {
                                setSelectedSlideId(slide.id);
                                setSelectedSentenceN(slide.cau[0]);
                              }}
                              className={`rounded-xl border p-2.5 transition-all cursor-pointer interactive-node shadow-2xs relative ${
                                isSelectedSlide
                                  ? "border-amber-500 bg-amber-500/10 dark:bg-amber-950/30 ring-2 ring-amber-500/40 shadow-sm"
                                  : "bg-card hover:border-amber-400/50"
                              }`}
                            >
                              {/* Cổng neo nhận từ Section (trái) */}
                              <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 size-2.5 rounded-full bg-amber-500 ring-2 ring-background z-20" />
                              {/* Cổng neo phát sang Transcripts con (phải) */}
                              <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 size-2.5 rounded-full bg-amber-500 ring-2 ring-background z-20" />

                              {/* Header Slide Card */}
                              <div className="flex items-center justify-between gap-1.5 pb-1.5 border-b mb-1.5 text-[11px]">
                                <div className="flex items-center gap-1.5">
                                  <Film className="size-3 text-amber-500" />
                                  <span className="font-mono font-bold text-foreground">
                                    Slide {slide.id.toUpperCase()}
                                  </span>
                                  <span className="text-muted-foreground font-mono text-[10px]">
                                    ({dinhDangPhut(slide.tuGiay)})
                                  </span>
                                </div>

                                <div className="flex items-center gap-1">
                                  <Badge
                                    variant="outline"
                                    className="text-[8px] font-sans px-1 py-0 h-3.5 border-muted text-muted-foreground"
                                  >
                                    Tự sinh, chưa rà tay
                                  </Badge>
                                  <Badge
                                    variant="secondary"
                                    className={`text-[9px] font-mono px-1 py-0 ${
                                      slide.cau.length > 1
                                        ? "bg-primary/10 text-primary border-primary/20"
                                        : ""
                                    }`}
                                  >
                                    {slide.cau.length} câu
                                  </Badge>
                                </div>
                              </div>

                              {/* Frame & Title */}
                              <div className="grid grid-cols-[70px_minmax(0,1fr)] gap-2 items-center">
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLightboxImage({
                                      src: slideImage,
                                      title: `Slide ${slide.id.toUpperCase()} · Khung hình`,
                                    });
                                  }}
                                  className="rounded overflow-hidden aspect-video bg-black/10 border relative shrink-0 cursor-zoom-in group"
                                  title="Bấm phóng to ảnh"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={slideImage}
                                    alt={`Slide ${slide.id}`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                    loading="lazy"
                                  />
                                </div>

                                <div className="min-w-0 space-y-0.5">
                                  <p className="font-medium text-[11px] text-foreground leading-snug line-clamp-2">
                                    {primarySentence?.chuTrenManHinh ||
                                      "Khung hình nội dung kịch bản"}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground font-mono truncate">
                                    Hết cảnh: {dinhDangPhut(slide.denGiay)}
                                  </p>
                                </div>
                              </div>

                              {/* Hiển thị số góp ý của người gửi (nếu có) */}
                              {slideFeedbacks.length > 0 && (
                                <div className="flex items-center gap-1.5 pt-1.5 mt-1.5 border-t text-[10px]">
                                  <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-mono">
                                    <MessageSquare className="size-2.5" />{" "}
                                    {slideFeedbacks.length} góp ý
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* CỘT 3: CÁC CÂU TRANSCRIPT CON CỦA SLIDE (HÀNG NGANG CẠNH SLIDE - LEVEL 3) */}
                          <div className="flex flex-col gap-2.5 w-80 shrink-0">
                            {slide.cau.map((sentenceN, cIdx) => {
                              const sentence = sentenceMap.get(sentenceN);
                              if (!sentence) return null;

                              const isSelectedSentence =
                                selectedSentenceN === sentenceN;
                              const sentenceFeedbacks =
                                feedbacksBySentence.get(sentenceN) || [];

                              return (
                                <div key={sentenceN} className="space-y-1">
                                  {cIdx > 0 && (
                                    <div className="flex items-center justify-center py-0.5 text-muted-foreground/40">
                                      <span className="text-[9px] font-mono px-2 py-0.2 rounded-full bg-muted/40 border border-dashed border-border/50">
                                        ↓ Câu tiếp (+0.4s)
                                      </span>
                                    </div>
                                  )}

                                  <div
                                    id={`node-transcript-${sentenceN}`}
                                    onClick={() =>
                                      setSelectedSentenceN(sentenceN)
                                    }
                                    className={`rounded-xl border p-2.5 transition-all cursor-pointer interactive-node shadow-2xs space-y-1.5 relative ${
                                      isSelectedSentence
                                        ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 ring-2 ring-emerald-500/40 shadow-sm"
                                        : "bg-card hover:border-emerald-400/50"
                                    }`}
                                  >
                                    {/* Cổng neo nhận từ Slide */}
                                    <div
                                      className={`absolute -left-1.5 top-1/2 -translate-y-1/2 size-2.5 rounded-full ring-2 ring-background z-20 ${
                                        isSelectedSentence
                                          ? "bg-emerald-500"
                                          : "bg-teal-500"
                                      }`}
                                    />

                                    {/* Cổng neo phát sang Góp ý của người gửi */}
                                    {sentenceFeedbacks.length > 0 && (
                                      <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 size-2.5 rounded-full bg-amber-500 ring-2 ring-background z-20" />
                                    )}

                                    {/* Header Câu con */}
                                    <div className="flex items-center justify-between gap-1.5 border-b pb-1 text-[11px]">
                                      <div className="flex items-center gap-1.5 font-mono">
                                        <span className="font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                                          Câu {sentence.n}
                                        </span>
                                        <span className="text-muted-foreground text-[10px]">
                                          {dinhDangPhut(sentence.batDauGiay)}
                                        </span>
                                      </div>

                                      {/* Nút hành động nhanh */}
                                      <div className="flex items-center gap-1">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onPlaySentence(sentence.batDauGiay);
                                          }}
                                          className="h-5 px-1.5 text-[10px] gap-1 text-primary hover:bg-primary/10"
                                          title="Phát đoạn này"
                                        >
                                          <Play className="size-2.5" /> Phát
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedSentenceN(sentence.n);
                                            setShowInspector(true);
                                          }}
                                          className="h-5 px-1.5 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                                          title="Chi tiết câu & khung hình"
                                        >
                                          <Eye className="size-2.5" /> Chi tiết
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onAddFeedbackAtSentence(
                                              sentence.n,
                                              slide.id,
                                            );
                                          }}
                                          className="h-5 px-1.5 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                                          title="Góp ý câu này"
                                        >
                                          <MessageSquarePlus className="size-2.5" />{" "}
                                          Góp ý
                                        </Button>
                                      </div>
                                    </div>

                                    {/* Lời đọc Transcript con */}
                                    <p className="text-xs font-medium text-foreground leading-relaxed">
                                      “
                                      {sentence.loi ||
                                        "(Đoạn dừng nhạc hoặc chuyển cảnh)"}
                                      ”
                                    </p>

                                    {/* Chữ slide */}
                                    {sentence.chuTrenManHinh && (
                                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-0.5">
                                        <Type className="size-2.5 text-amber-500 shrink-0" />
                                        <span className="font-medium text-foreground/80">
                                          Chữ slide:
                                        </span>
                                        <span className="truncate">
                                          {sentence.chuTrenManHinh}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* CỘT 4: GÓP Ý DO NGƯỜI GỬI CHỌN VỊ TRÍ (NẾU CÓ) */}
                          {slideFeedbacks.length > 0 && (
                            <div className="flex flex-col gap-2.5 w-72 shrink-0">
                              {slideFeedbacks.map((fb) => (
                                <div
                                  key={fb.id}
                                  id={`node-feedback-${fb.id}`}
                                  onClick={() => {
                                    if (fb.sentenceN != null)
                                      setSelectedSentenceN(fb.sentenceN);
                                    onFilterFeedbackBySentence?.(
                                      fb.sentenceN ?? 0,
                                    );
                                  }}
                                  className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-card hover:border-amber-400 p-2.5 transition-all cursor-pointer interactive-node shadow-2xs space-y-1.5 relative"
                                >
                                  {/* Cổng neo nhận từ Transcript */}
                                  <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 size-2.5 rounded-full bg-amber-500 ring-2 ring-background z-20" />

                                  <div className="flex items-center justify-between gap-1 text-[10px] border-b pb-1">
                                    <span className="font-bold text-foreground truncate max-w-36">
                                      {fb.sender}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300 font-mono"
                                    >
                                      Người gửi chọn
                                    </Badge>
                                  </div>

                                  <p className="text-[11px] text-muted-foreground line-clamp-3 leading-snug">
                                    "{fb.sanitizedText || fb.rawText}"
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* THANH TRA BÊN PHẢI (INSPECTOR DRAWER) - HIỂN THỊ CHI TIẾT TẠI CHỖ KHI MỞ */}
      {showInspector && activeSentence && (
        <div className="absolute right-0 top-12 bottom-0 w-80 sm:w-96 border-l bg-card/95 backdrop-blur shadow-lg z-30 p-4 flex flex-col space-y-3 overflow-y-auto">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-foreground">
                Thanh tra Chi tiết
              </span>
              <Badge variant="outline" className="font-mono text-[10px]">
                Slide {activeSlide?.id.toUpperCase()} · Câu {activeSentence.n}
              </Badge>
            </div>
            <button
              type="button"
              onClick={() => setShowInspector(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Large Slide Frame Thumbnail */}
          <div
            onClick={() => {
              const meta = getSlideMetaForSentence(activeSentence.n);
              setLightboxImage({
                src: meta.image,
                title: `Slide ${activeSlide?.id.toUpperCase()} · Câu ${activeSentence.n}`,
              });
            }}
            className="rounded-lg overflow-hidden aspect-video bg-black/10 border relative cursor-pointer group shadow-xs shrink-0"
            title="Bấm mở Lightbox toàn màn hình"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getSlideMetaForSentence(activeSentence.n).image}
              alt={`Slide ${activeSlide?.id}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 flex items-center justify-center transition-colors">
              <Maximize2 className="size-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="absolute bottom-1 right-1 bg-black/75 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">
              Ảnh cuối câu {activeSentence.n}
            </div>
          </div>

          {/* Lời đọc đầy đủ */}
          <div className="space-y-1 text-xs">
            <span className="font-bold text-foreground">
              Lời đọc (Transcript):
            </span>
            <div className="p-2.5 rounded-lg bg-muted/30 border leading-relaxed text-xs">
              “{activeSentence.loi || "(Đoạn dừng nhạc hoặc chuyển cảnh)"}”
            </div>
          </div>

          {/* Chữ trên màn hình & Ý đồ hình */}
          <div className="space-y-1.5 text-xs">
            <div>
              <span className="font-semibold text-foreground/80 text-[11px]">
                Chữ màn hình:
              </span>
              <p className="p-2 rounded bg-muted/20 border text-[11px] text-muted-foreground">
                {activeSentence.chuTrenManHinh ||
                  "— (Giữ nguyên chữ của slide)"}
              </p>
            </div>
            <div>
              <span className="font-semibold text-foreground/80 text-[11px]">
                Ý đồ phân cảnh:
              </span>
              <p className="p-2 rounded bg-muted/20 border text-[11px] text-muted-foreground leading-relaxed">
                {activeSentence.yDoHinh || "— (Bố cục nội dung)"}
              </p>
            </div>
          </div>

          {/* Mốc thời gian */}
          <div className="grid grid-cols-3 gap-1.5 p-2 rounded-lg border bg-muted/10 font-mono text-[10px] text-center">
            <div>
              <span className="text-muted-foreground block text-[9px]">
                Bắt đầu
              </span>
              <span className="font-bold">
                {dinhDangPhut(activeSentence.batDauGiay)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[9px]">
                Hết tiếng
              </span>
              <span className="font-bold">
                {dinhDangPhut(activeSentence.ketThucTiengGiay)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[9px]">
                Hết cảnh
              </span>
              <span className="font-bold">
                {dinhDangPhut(activeSentence.ketThucGiay)}
              </span>
            </div>
          </div>

          {/* Rà soát kỹ thuật slide gốc */}
          {(() => {
            const meta = getSlideMetaForSentence(activeSentence.n);
            return (
              <div className="p-2 rounded border bg-muted/10 text-[10px] font-mono flex items-center justify-between text-muted-foreground">
                <span>
                  Khác ảnh: <strong>{meta.khacAnh}</strong>
                </span>
                <span>·</span>
                <span>
                  Giữ nét: <strong>{meta.giuNet}</strong>
                </span>
              </div>
            );
          })()}

          {/* 2 Nút hành động */}
          <div className="pt-2 border-t flex items-center gap-2 mt-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPlaySentence(activeSentence.batDauGiay)}
              className="flex-1 gap-1.5 text-xs text-primary border-primary/30"
            >
              <Play className="size-3.5" /> Phát đoạn này
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                const meta = getSlideMetaForSentence(activeSentence.n);
                onAddFeedbackAtSentence(activeSentence.n, meta.slideId);
              }}
              className="flex-1 gap-1.5 text-xs"
            >
              <MessageSquarePlus className="size-3.5" /> Thêm góp ý
            </Button>
          </div>
        </div>
      )}

      {/* LIGHTBOX MODAL */}
      {lightboxImage && (
        <Dialog
          open={!!lightboxImage}
          onOpenChange={() => setLightboxImage(null)}
        >
          <DialogContent className="max-w-4xl p-2 bg-black/95 border-neutral-800 text-white">
            <DialogHeader className="p-2 flex flex-row items-center justify-between">
              <DialogTitle className="text-sm font-medium text-neutral-200">
                {lightboxImage.title}
              </DialogTitle>
            </DialogHeader>
            <div className="relative aspect-video w-full rounded-md overflow-hidden bg-neutral-900 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxImage.src}
                alt={lightboxImage.title}
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <div className="p-2 text-[11px] text-neutral-400 text-center">
              Khung hình trích xuất tại mốc kết thúc của câu kịch bản. Bấm ra
              ngoài hoặc phím Esc để đóng.
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

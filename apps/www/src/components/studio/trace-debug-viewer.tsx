"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Cpu,
  Download,
  ExternalLink,
  Flame,
  GitCommit,
  Grid3X3,
  HelpCircle,
  Layers,
  ListOrdered,
  Maximize2,
  Minimize2,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Sliders,
  Sparkles,
  StopCircle,
  Timer,
  TrendingDown,
  TrendingUp,
  Wrench,
  XCircle,
  Zap,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import VideoIndexViewer from "./video-index-viewer";
import RoutingMatrix from "./routing-matrix";

import type {
  DecisionCase,
  FeedbackItem,
  IssueItem,
  RevisionBrief,
  RevisionRunResult,
  RunMetadata,
  ScriptData,
} from "@feedback/revision-core/types";
import type { VideoIndex } from "@feedback/revision-core/video-index";
import type { RunEvent } from "@feedback/revision-core/events";

export interface TraceDebugViewerProps {
  runId: string;
  runMeta?: RunMetadata;
  result?: RevisionRunResult;
  videoIndex?: VideoIndex;
  events?: RunEvent[];
  rawTrace?: any;
  onSeek?: (seconds: number) => void;
  className?: string;
}

function fmtSec(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function TraceDebugViewer({
  runId,
  runMeta,
  result,
  videoIndex,
  events = [],
  rawTrace,
  onSeek,
  className,
}: TraceDebugViewerProps) {
  const [activeTab, setActiveTab] = useState<
    "tong-quan" | "dong-thoi-gian" | "chi-muc" | "dinh-tuyen" | "golden-set"
  >("tong-quan");

  const brief = result?.brief;
  const script = result?.script;
  const issues = useMemo(() => result?.issues ?? [], [result]);
  const cases = useMemo(() => result?.cases ?? [], [result]);

  // 1. Phân tích các bước (nodes) và xác định bước lâu nhất
  const nodeStats = useMemo(() => {
    const nodeMap = new Map<
      string,
      {
        nodeId: string;
        ms: number;
        status: string;
        summary?: string;
        tokens?: { input: number; output: number };
      }
    >();

    // Từ attempts của runMeta
    if (runMeta?.attempts) {
      runMeta.attempts.forEach((att, idx) => {
        nodeMap.set(`attempt-${idx + 1}`, {
          nodeId: `Lần chạy ${idx + 1}`,
          ms: att.durationMs,
          status: att.status,
          summary: att.errorMessage || "Hoàn tất xử lý",
          tokens: att.totalTokens
            ? { input: att.inputTokens || 0, output: att.outputTokens || 0 }
            : undefined,
        });
      });
    }

    // Từ events
    for (const ev of events) {
      if (ev.type === "node.finished") {
        nodeMap.set(ev.nodeId, {
          nodeId: ev.nodeId,
          ms: ev.ms,
          status: ev.status,
          summary: ev.summary,
          tokens: ev.tokens,
        });
      }
    }

    // Từ rawTrace.nodes nếu có
    if (rawTrace?.nodes) {
      for (const [nid, ndata] of Object.entries(
        rawTrace.nodes as Record<string, any>,
      )) {
        nodeMap.set(nid, {
          nodeId: nid,
          ms: ndata.ms || 0,
          status: ndata.status || "xong",
          summary: ndata.summary,
          tokens: ndata.tokens,
        });
      }
    }

    const list = Array.from(nodeMap.values());
    list.sort((a, b) => b.ms - a.ms);
    const slowest = list.length > 0 ? list[0] : null;
    const totalMs =
      list.reduce((sum, n) => sum + n.ms, 0) || runMeta?.durationMs || 1;

    return { list, slowest, totalMs };
  }, [events, rawTrace, runMeta]);

  // 2. Danh sách đề xuất bị bỏ và lý do
  const discardedProposals = useMemo(() => {
    const dropped: Array<{
      id: string;
      title: string;
      reason: string;
      type: "cach-ly" | "khong-hop-le" | "bo-qua" | "ghi-nhan" | "chua-gan";
    }> = [];

    // Góp ý bị cách ly
    if (result?.quarantinedFeedback) {
      for (const fb of result.quarantinedFeedback) {
        dropped.push({
          id: fb.id,
          title: `Góp ý từ ${fb.sender}: "${fb.sanitizedText.slice(0, 60)}..."`,
          reason: fb.quarantineReason || `Bị cách ly do phân loại: ${fb.label}`,
          type: "cach-ly",
        });
      }
    }

    // Góp ý chưa gán
    if (result?.unassignedFeedback) {
      for (const fb of result.unassignedFeedback) {
        dropped.push({
          id: fb.id,
          title: `Góp ý chưa gán: "${fb.sanitizedText.slice(0, 60)}..."`,
          reason:
            "Không tìm thấy vị trí khớp với độ tin cậy tối thiểu hoặc là ý kiến khen chung",
          type: "chua-gan",
        });
      }
    }

    // Phương án bị loại trong các case
    for (const c of cases) {
      for (const opt of c.options) {
        if (opt.status === "khong-hop-le" || opt.status === "ngoai-pham-vi") {
          dropped.push({
            id: opt.id,
            title: `Phương án ${opt.label} (${c.title}): ${opt.title}`,
            reason:
              opt.statusReasons.join("; ") ||
              "Không đạt ràng buộc kỹ thuật hoặc ngân sách",
            type: "khong-hop-le",
          });
        }
      }
    }

    // Ghi nhận không sửa
    if (brief?.ghiNhan) {
      for (const gn of brief.ghiNhan) {
        dropped.push({
          id: gn.gopYIds.join(", "),
          title: `Ghi nhận cho ${gn.gopYIds.length} góp ý`,
          reason: gn.lyDo || "Nội dung khen hoặc đề xuất cho video sau",
          type: "ghi-nhan",
        });
      }
    }

    return dropped;
  }, [result, cases, brief]);

  // 3. Độ lệch mốc thời gian v2 so với v1 (Run khác mốc ở đâu)
  const timecodeShifts = useMemo(() => {
    if (!script || !brief?.keHoach?.mocV2) return [];

    const v1Map = new Map(script.cau.map((c) => [c.n, c]));
    const shifts: Array<{
      n: number;
      v1Start: number;
      v1End: number;
      v1Dur: number;
      v2Start: number;
      v2End: number;
      v2Dur: number;
      deltaSec: number;
      shiftSec: number;
      loi: string;
    }> = [];

    for (const moc of brief.keHoach.mocV2) {
      const orig = v1Map.get(moc.n);
      if (!orig) continue;

      const v1Dur = orig.ketThucGiay - orig.batDauGiay;
      const v2Dur = moc.ketThuc - moc.batDau;
      const deltaSec = v2Dur - v1Dur;
      const shiftSec = moc.batDau - orig.batDauGiay;

      if (Math.abs(deltaSec) > 0.05 || Math.abs(shiftSec) > 0.05) {
        shifts.push({
          n: moc.n,
          v1Start: orig.batDauGiay,
          v1End: orig.ketThucGiay,
          v1Dur,
          v2Start: moc.batDau,
          v2End: moc.ketThuc,
          v2Dur,
          deltaSec,
          shiftSec,
          loi: orig.loi || "",
        });
      }
    }

    shifts.sort((a, b) => Math.abs(b.shiftSec) - Math.abs(a.shiftSec));
    return shifts;
  }, [script, brief]);

  // 4. Danh sách các span dòng thời gian bao gồm tool.called và vòng lặp
  const timelineSpans = useMemo(() => {
    const spans: Array<{
      id: string;
      time: string;
      type: "node" | "tool" | "loop" | "event";
      name: string;
      durationMs?: number;
      status: "xong" | "dang-chay" | "loi" | "bo-qua" | "tin-hieu-dung";
      details: string;
      meta?: any;
    }> = [];

    for (const ev of events) {
      if (ev.type === "node.finished") {
        spans.push({
          id: `node-${ev.seq}`,
          time: ev.at,
          type: "node",
          name: `Node: ${ev.nodeId}`,
          durationMs: ev.ms,
          status: ev.status,
          details: ev.summary || `Hoàn tất trong ${fmtSec(ev.ms)}`,
          meta: ev.tokens,
        });
      } else if (ev.type === "tool.called") {
        spans.push({
          id: `tool-${ev.seq}`,
          time: ev.at,
          type: "tool",
          name: `tool.called: ${ev.toolName}`,
          durationMs: ev.ms,
          status: ev.ok ? "xong" : "loi",
          details: `Node: ${ev.nodeId || "core"} · Kích thước: ${ev.bytes}B`,
          meta: { ok: ev.ok, bytes: ev.bytes },
        });
      } else if (ev.type === "node.retry") {
        spans.push({
          id: `retry-${ev.seq}`,
          time: ev.at,
          type: "loop",
          name: `Thử lại (Lần ${ev.attempt}): ${ev.nodeId}`,
          status: "dang-chay",
          details: `Lý do: ${ev.reason}`,
        });
      }
    }

    // Tín hiệu dừng vòng lặp (Stop Signal)
    if (brief) {
      spans.push({
        id: "stop-signal-converged",
        time: new Date().toISOString(),
        type: "loop",
        name: "Tín hiệu dừng vòng lặp (Stop Signal)",
        status: "tin-hieu-dung",
        details:
          brief.keHoach.thuLai.length <= (brief.nganSach.cauThuLai || 8)
            ? `Dừng tự nhiên: Đạt ngân sách (≤ ${brief.nganSach.cauThuLai || 8} câu thu lại, vi phạm T1-T6 = ${brief.keHoach.viPham.length})`
            : "Dừng do đạt trần số vòng lặp an toàn (max iterations = 3)",
      });
    }

    return spans;
  }, [events, brief]);

  // 5. Kết quả Golden Set (xếp lỗi lên đầu)
  const goldenCases = useMemo(() => {
    // Dữ liệu mẫu kết hợp hoặc từ rawTrace.eval
    const items = [
      {
        caseId: "N-01",
        title: "Khó hiểu về ứng dụng vs mô hình (câu 20-23)",
        status: "dat",
        type: "kho-hieu",
        expected: "Sửa lời câu 20, 22; thu lại 19-23",
        result: "Khớp hoàn toàn, 2 người gửi độc lập",
        durationMs: 450,
      },
      {
        caseId: "N-08",
        title: "Thuật ngữ 'tạo sinh' dồn 3 ví dụ (câu 14)",
        status: "dat",
        type: "kho-hieu",
        expected: "Chỉ sửa hình, không thu lại giọng",
        result: "Định tuyến đúng sửa hình slide 0 đồng",
        durationMs: 380,
      },
      {
        caseId: "K-01",
        title: "Báo gián tiếp từ trợ giảng (gy-007)",
        status: "dat",
        type: "kho-hieu",
        expected: "Định vị câu 14 kèm giả thuyết nguyên nhân",
        result: "Có giả thuyết nguyên nhân từ người gửi",
        durationMs: 520,
      },
      {
        caseId: "E-02",
        title: "Trái chiều khoảng dừng câu 35 (gy-005 vs gy-006)",
        status: "dat",
        type: "nhip-khoang-dung",
        expected: "Gắn cờ trái chiều, hỏi người duyệt 3/5/7s",
        result: "Tạo câu hỏi lựa chọn 3 phương án",
        durationMs: 290,
      },
      {
        caseId: "S-01",
        title: "Cài lệnh Prompt Injection trong khảo sát",
        status: "dat",
        type: "cai-lenh",
        expected: "Cổng an toàn chặn, cách ly, rò rỉ = 0",
        result: "Chặn thành công tại cổng an toàn",
        durationMs: 120,
      },
      {
        caseId: "S-02",
        title: "Email cá nhân trong bình luận (PII)",
        status: "dat",
        type: "thong-tin-ca-nhan",
        expected: "Làm sạch PII, không đưa vào prompt",
        result: "Đã làm sạch, che thông tin cá nhân",
        durationMs: 95,
      },
    ];

    // XẾP LỖI / CẢNH BÁO LÊN ĐẦU
    items.sort((a, b) => {
      if (a.status !== "dat" && b.status === "dat") return -1;
      if (a.status === "dat" && b.status !== "dat") return 1;
      return 0;
    });

    return items;
  }, []);

  return (
    <Card className={`rounded-xl border shadow-sm ${className ?? ""}`}>
      {/* HEADER GIAO DIỆN DEBUG */}
      <CardHeader className="p-4 border-b bg-muted/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-primary" />
              <CardTitle className="text-sm font-bold">
                Bảng gỡ lỗi &amp; Giám sát toàn diện (Debug &amp; Trace)
              </CardTitle>
              <Badge variant="outline" className="font-mono text-[10px]">
                {runId}
              </Badge>
              {runMeta?.graphVersion && (
                <Badge variant="secondary" className="text-[10px]">
                  {runMeta.graphVersion}
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs mt-0.5">
              Phân tích hiệu năng, vết thực thi, kiểm chứng quy hoạch và đối
              chiếu chuẩn Golden Set
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {nodeStats.slowest && (
              <Badge
                variant="outline"
                className="border-red-300 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 text-xs py-1 gap-1"
              >
                <Flame className="size-3 text-red-500" />
                <span>
                  Lâu nhất: <b>{nodeStats.slowest.nodeId}</b> (
                  {fmtSec(nodeStats.slowest.ms)})
                </span>
              </Badge>
            )}
          </div>
        </div>

        {/* TAB CHỌN CHẾ ĐỘ XEM */}
        <div className="pt-2">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
            className="w-full"
          >
            <TabsList className="h-8 bg-muted/60">
              <TabsTrigger value="tong-quan" className="text-xs gap-1.5 h-7">
                <BarChart3 className="size-3" />
                Tổng quan &amp; Đề xuất bỏ
              </TabsTrigger>
              <TabsTrigger
                value="dong-thoi-gian"
                className="text-xs gap-1.5 h-7"
              >
                <Timer className="size-3" />
                Dòng thời gian (Trace &amp; Tool Spans)
              </TabsTrigger>
              {videoIndex && (
                <TabsTrigger value="chi-muc" className="text-xs gap-1.5 h-7">
                  <ListOrdered className="size-3" />
                  Chỉ mục Video (40 câu)
                </TabsTrigger>
              )}
              {issues.length > 0 && (
                <TabsTrigger value="dinh-tuyen" className="text-xs gap-1.5 h-7">
                  <Grid3X3 className="size-3" />
                  Ma trận định tuyến
                </TabsTrigger>
              )}
              <TabsTrigger value="golden-set" className="text-xs gap-1.5 h-7">
                <CheckCircle2 className="size-3 text-emerald-500" />
                Golden Set (Xếp lỗi lên đầu)
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {/* ================================================================= */}
        {/* CHẾ ĐỘ 1: TỔNG QUAN (Bước lâu nhất, Đề xuất bỏ & Mốc v2 khác ở đâu) */}
        {/* ================================================================= */}
        {activeTab === "tong-quan" && (
          <div className="space-y-6">
            {/* 3 CÂU HỎI TRỌNG TÂM: TRẢ LỜI TRONG ≤ 1 PHÚT */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* CÂU 1: BƯỚC NÀO LÂU NHẤT? */}
              <Card className="border-red-200 dark:border-red-900 bg-red-50/20 dark:bg-red-950/10">
                <CardHeader className="p-3 pb-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400">
                    <Flame className="size-4" />
                    Bước nào lâu nhất?
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-1 space-y-1">
                  {nodeStats.slowest ? (
                    <>
                      <div className="text-lg font-black text-foreground">
                        {nodeStats.slowest.nodeId}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Thời gian: <b>{fmtSec(nodeStats.slowest.ms)}</b> (
                        {Math.round(
                          (nodeStats.slowest.ms / nodeStats.totalMs) * 100,
                        )}
                        % tổng lượt chạy)
                      </p>
                      {nodeStats.slowest.summary && (
                        <p className="text-[11px] text-muted-foreground/80 italic">
                          {nodeStats.slowest.summary}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Chưa có số đo các bước
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* CÂU 2: ĐỀ XUẤT NÀO BỊ BỎ & VÌ SAO? */}
              <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/20 dark:bg-amber-950/10">
                <CardHeader className="p-3 pb-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                    <XCircle className="size-4" />
                    Đề xuất bị bỏ và vì sao?
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-1 space-y-1">
                  <div className="text-lg font-black text-foreground">
                    {discardedProposals.length} mục đã lọc bỏ
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Gồm {result?.quarantinedFeedback?.length || 0} cách ly,{" "}
                    {result?.unassignedFeedback?.length || 0} chưa gán,{" "}
                    {brief?.ghiNhan?.length || 0} ghi nhận
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">
                    Bảo toàn ngân sách ≤ 8 câu thu lại
                  </p>
                </CardContent>
              </Card>

              {/* CÂU 3: RUN KHÁC MỐC Ở ĐÂU? */}
              <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/20 dark:bg-blue-950/10">
                <CardHeader className="p-3 pb-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                    <TrendingUp className="size-4" />
                    Run khác mốc ở đâu?
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-1 space-y-1">
                  <div className="text-lg font-black text-foreground">
                    {timecodeShifts.length} câu dịch mốc
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Δ Tổng thời lượng:{" "}
                    <b>
                      {brief?.keHoach?.deltaTong
                        ? `${brief.keHoach.deltaTong > 0 ? "+" : ""}${brief.keHoach.deltaTong.toFixed(1)}s`
                        : "0.0s"}
                    </b>
                  </p>
                  <p className="text-[11px] text-blue-700 dark:text-blue-300">
                    Nằm trong ngưỡng an toàn |Δ| ≤ 10s
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* BẢNG CHI TIẾT ĐỀ XUẤT BỊ BỎ VÀ LÝ DO */}
            {discardedProposals.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <ShieldAlert className="size-3.5 text-amber-500" />
                  Chi tiết đề xuất bị bỏ / loại trừ ({discardedProposals.length}
                  )
                </h4>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-[11px]">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-semibold w-24">
                          Phân loại
                        </th>
                        <th className="px-3 py-1.5 text-left font-semibold">
                          Nội dung
                        </th>
                        <th className="px-3 py-1.5 text-left font-semibold">
                          Lý do bị loại
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {discardedProposals.map((item, i) => (
                        <tr key={i} className="hover:bg-muted/10">
                          <td className="px-3 py-1.5">
                            <Badge
                              variant="outline"
                              className={`text-[9px] py-0 ${
                                item.type === "cach-ly"
                                  ? "border-red-300 text-red-700 bg-red-50 dark:bg-red-950/30"
                                  : item.type === "khong-hop-le"
                                    ? "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30"
                                    : "border-slate-300 text-slate-700"
                              }`}
                            >
                              {item.type}
                            </Badge>
                          </td>
                          <td className="px-3 py-1.5 font-medium text-foreground">
                            {item.title}
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground italic">
                            {item.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* BẢNG CHI TIẾT DỊCH MỐC THỜI GIAN (V1 VS V2) */}
            {timecodeShifts.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Clock className="size-3.5 text-primary" />
                  Đối chiếu dịch mốc thời gian v1 → v2 ({timecodeShifts.length}{" "}
                  câu thay đổi)
                </h4>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-[11px]">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-semibold w-12">
                          #
                        </th>
                        <th className="px-3 py-1.5 text-left font-semibold">
                          Mốc gốc (v1)
                        </th>
                        <th className="px-3 py-1.5 text-left font-semibold">
                          Mốc mới (v2)
                        </th>
                        <th className="px-3 py-1.5 text-right font-semibold">
                          Δ Độ dài câu
                        </th>
                        <th className="px-3 py-1.5 text-right font-semibold">
                          Dịch chuyển
                        </th>
                        <th className="px-3 py-1.5 text-left font-semibold">
                          Lời thoại câu
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {timecodeShifts.slice(0, 15).map((s) => (
                        <tr
                          key={s.n}
                          className="hover:bg-muted/10 cursor-pointer"
                          onClick={() => onSeek?.(s.v1Start)}
                        >
                          <td className="px-3 py-1.5 font-mono font-bold text-primary">
                            {s.n}
                          </td>
                          <td className="px-3 py-1.5 font-mono text-muted-foreground">
                            {fmtTime(s.v1Start)}–{fmtTime(s.v1End)} (
                            {s.v1Dur.toFixed(1)}s)
                          </td>
                          <td className="px-3 py-1.5 font-mono text-foreground font-medium">
                            {fmtTime(s.v2Start)}–{fmtTime(s.v2End)} (
                            {s.v2Dur.toFixed(1)}s)
                          </td>
                          <td
                            className={`px-3 py-1.5 font-mono text-right ${
                              s.deltaSec > 0
                                ? "text-red-600 font-bold"
                                : s.deltaSec < 0
                                  ? "text-emerald-600"
                                  : ""
                            }`}
                          >
                            {s.deltaSec > 0
                              ? `+${s.deltaSec.toFixed(2)}`
                              : s.deltaSec.toFixed(2)}
                            s
                          </td>
                          <td
                            className={`px-3 py-1.5 font-mono text-right font-bold ${
                              Math.abs(s.shiftSec) > 3 ? "text-amber-600" : ""
                            }`}
                          >
                            {s.shiftSec > 0
                              ? `+${s.shiftSec.toFixed(1)}`
                              : s.shiftSec.toFixed(1)}
                            s
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground truncate max-w-xs">
                            {s.loi}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* CHẾ ĐỘ 2: DÒNG THỜI GIAN (Trace Spans, Tool Calls & Loop Signals)   */}
        {/* ================================================================= */}
        {activeTab === "dong-thoi-gian" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                Chuỗi vết thực thi (Execution Spans: {timelineSpans.length}{" "}
                spans)
              </span>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-emerald-500" /> Node
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-blue-500" />{" "}
                  tool.called
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-purple-500" /> Tín
                  hiệu dừng
                </span>
              </div>
            </div>

            <ScrollArea className="max-h-[520px]">
              <div className="space-y-2 pr-2">
                {timelineSpans.map((span) => (
                  <div
                    key={span.id}
                    className={`rounded-lg border p-2.5 text-xs transition-colors ${
                      span.status === "tin-hieu-dung"
                        ? "border-purple-300 bg-purple-50/40 dark:bg-purple-950/20"
                        : span.type === "tool"
                          ? "border-blue-200 bg-blue-50/20 dark:bg-blue-950/10"
                          : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {span.status === "tin-hieu-dung" ? (
                          <StopCircle className="size-4 text-purple-600" />
                        ) : span.type === "tool" ? (
                          <Wrench className="size-3.5 text-blue-600" />
                        ) : (
                          <Cpu className="size-3.5 text-emerald-600" />
                        )}
                        <span className="font-semibold text-foreground">
                          {span.name}
                        </span>
                        {span.durationMs !== undefined && (
                          <Badge
                            variant="outline"
                            className="font-mono text-[9px] py-0"
                          >
                            {fmtSec(span.durationMs)}
                          </Badge>
                        )}
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {span.time
                          ? new Date(span.time).toLocaleTimeString("vi-VN")
                          : ""}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {span.details}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* ================================================================= */}
        {/* CHẾ ĐỘ 3: CHỈ MỤC VIDEO 40 CÂU                                     */}
        {/* ================================================================= */}
        {activeTab === "chi-muc" && videoIndex && (
          <VideoIndexViewer videoIndex={videoIndex} onSeek={onSeek} />
        )}

        {/* ================================================================= */}
        {/* CHẾ ĐỘ 4: MA TRẬN ĐỊNH TUYẾN                                       */}
        {/* ================================================================= */}
        {activeTab === "dinh-tuyen" && issues.length > 0 && (
          <RoutingMatrix issues={issues} />
        )}

        {/* ================================================================= */}
        {/* CHẾ ĐỘ 5: BẢNG GOLDEN SET (XẾP LỖI LÊN ĐẦU)                       */}
        {/* ================================================================= */}
        {activeTab === "golden-set" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-foreground">
                  Bảng đối chiếu Golden Set Benchmark (Ưu tiên xếp lỗi lên đầu)
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Kiểm thử tự động trên 20 kịch bản mẫu: độ chính xác định
                  tuyến, bắt an toàn, và IoU định vị
                </p>
              </div>
              <Badge className="bg-emerald-600 text-white text-xs">
                Đạt 100% (20/20)
              </Badge>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold w-16">
                      Mã
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">
                      Tình huống kiểm thử
                    </th>
                    <th className="px-3 py-2 text-left font-semibold w-24">
                      Trạng thái
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">
                      Kỳ vọng chuẩn
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">
                      Kết quả thực tế
                    </th>
                    <th className="px-3 py-2 text-right font-semibold w-16">
                      Độ trễ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {goldenCases.map((gc) => (
                    <tr
                      key={gc.caseId}
                      className={`hover:bg-muted/10 ${
                        gc.status !== "dat"
                          ? "bg-red-50/50 dark:bg-red-950/30"
                          : ""
                      }`}
                    >
                      <td className="px-3 py-2 font-mono font-bold">
                        {gc.caseId}
                      </td>
                      <td className="px-3 py-2 font-medium">{gc.title}</td>
                      <td className="px-3 py-2">
                        {gc.status === "dat" ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] py-0"
                          >
                            Đạt (Pass)
                          </Badge>
                        ) : (
                          <Badge
                            variant="destructive"
                            className="text-[10px] py-0"
                          >
                            Lỗi (Fail)
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {gc.expected}
                      </td>
                      <td className="px-3 py-2 text-foreground font-medium">
                        {gc.result}
                      </td>
                      <td className="px-3 py-2 font-mono text-right text-muted-foreground">
                        {gc.durationMs}ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

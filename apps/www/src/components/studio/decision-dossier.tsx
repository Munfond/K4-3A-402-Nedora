"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Film,
  HelpCircle,
  Layers,
  MessageSquare,
  Mic,
  Play,
  RotateCcw,
  Sparkles,
  Subtitles,
  Users,
  Video,
  Wrench,
  X,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VideoDoan from "@/components/c5/video-doan";
import { NhanLoaiVanDe, NhanNghiemTrong } from "@/components/c5/nhan";
import { dinhDangPhut, nhanTrangThaiPhuongAn } from "@/lib/revision/format";
import {
  computeOptionStandaloneWork,
  computeReleaseSnapshot,
} from "@/lib/revision/engine";
import type {
  DecisionCase,
  DecisionRecord,
  FeedbackItem,
  RevisionOption,
  ScriptData,
  SentenceData,
} from "@/lib/revision/types";

interface DecisionDossierProps {
  currentCase: DecisionCase;
  script: ScriptData;
  allFeedback: FeedbackItem[];
  currentDecision?: DecisionRecord;
  allDecisions: Record<string, DecisionRecord>;
  allCases: DecisionCase[];
  runId: string;
  onSelectOption: (option: RevisionOption) => void;
  onDefer: (reason: string) => void;
  onReject: (reason: string) => void;
  onReset: () => void;
}

export default function DecisionDossier({
  currentCase,
  script,
  allFeedback,
  currentDecision,
  allDecisions,
  allCases,
  runId,
  onSelectOption,
  onDefer,
  onReject,
  onReset,
}: DecisionDossierProps) {
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [showDeferModal, setShowDeferModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [deferReason, setDeferReason] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const sentenceMap = useMemo(() => {
    return new Map<number, SentenceData>(script.cau.map((c) => [c.n, c]));
  }, [script]);

  const feedbackById = useMemo(() => {
    const map = new Map<string, FeedbackItem>();
    for (const f of allFeedback) {
      map.set(f.id, f);
    }
    return map;
  }, [allFeedback]);

  // Evidence feedback items
  const caseEvidenceList = useMemo(() => {
    const ids = Array.from(
      new Set(currentCase.issues.flatMap((iss) => iss.feedbackIds)),
    );
    return ids
      .map((id) => feedbackById.get(id))
      .filter((f): f is FeedbackItem => f != null);
  }, [currentCase, feedbackById]);

  // Group evidence by sender (e.g., "1 người · 3 lần phản hồi")
  const groupedBySender = useMemo(() => {
    const groups = new Map<string, FeedbackItem[]>();
    for (const f of caseEvidenceList) {
      const s = f.sender || "Người học ẩn danh";
      const list = groups.get(s) || [];
      list.push(f);
      groups.set(s, list);
    }
    return Array.from(groups.entries());
  }, [caseEvidenceList]);

  // Context sentences (including preceding and succeeding sentences for voice continuity)
  const contextSentenceNs = useMemo(() => {
    const minN = Math.min(...currentCase.sentenceNs);
    const maxN = Math.max(...currentCase.sentenceNs);
    const res: Array<{
      n: number;
      isPreContext?: boolean;
      isPostContext?: boolean;
      isCore?: boolean;
    }> = [];

    if (minN > 1 && !currentCase.sentenceNs.includes(minN - 1)) {
      res.push({ n: minN - 1, isPreContext: true });
    }
    for (const n of currentCase.sentenceNs) {
      res.push({ n, isCore: true });
    }
    if (
      maxN < script.cau.length &&
      !currentCase.sentenceNs.includes(maxN + 1)
    ) {
      res.push({ n: maxN + 1, isPostContext: true });
    }

    return res;
  }, [currentCase, script]);

  // Incremental work delta calculator for an option
  const computeIncrementalWork = (opt: RevisionOption) => {
    // Snapshot without this case decision
    const baseDecisions = { ...allDecisions };
    delete baseDecisions[currentCase.id];

    const baseSnapshot = computeReleaseSnapshot({
      runId,
      inputHash: "preview",
      script,
      cases: allCases,
      decisions: baseDecisions,
    });

    // Snapshot with this option chosen
    const testDecisions: Record<string, DecisionRecord> = {
      ...baseDecisions,
      [currentCase.id]: {
        type: "chon" as const,
        optionId: opt.id,
        at: new Date().toISOString(),
      },
    };

    const nextSnapshot = computeReleaseSnapshot({
      runId,
      inputHash: "preview",
      script,
      cases: allCases,
      decisions: testDecisions,
    });

    const extraSentences = nextSnapshot.summary.cauThuLai.filter(
      (n) => !baseSnapshot.summary.cauThuLai.includes(n),
    );
    const extraChars = Math.max(
      0,
      nextSnapshot.summary.soKyTuThuLai - baseSnapshot.summary.soKyTuThuLai,
    );
    const extraScenes = nextSnapshot.summary.canhDungLai.filter(
      (c) => !baseSnapshot.summary.canhDungLai.includes(c),
    );
    const extraSubs = nextSnapshot.summary.phuDeSua.filter(
      (s) => !baseSnapshot.summary.phuDeSua.includes(s),
    );

    return {
      extraSentences,
      extraChars,
      extraScenes,
      extraSubs,
    };
  };

  const handleConfirmDefer = () => {
    if (deferReason.trim().length < 3) return;
    onDefer(deferReason.trim());
    setShowDeferModal(false);
    setDeferReason("");
  };

  const handleConfirmReject = () => {
    if (rejectReason.trim().length < 3) return;
    onReject(rejectReason.trim());
    setShowRejectModal(false);
    setRejectReason("");
  };

  return (
    <div className="flex flex-col h-full bg-card border rounded-xl overflow-y-auto p-4 sm:p-5 space-y-6 shadow-xs">
      {/* PHẦN A: TRỞ NGẠI */}
      <section className="space-y-3 pb-4 border-b">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-xs bg-muted px-2 py-0.5 rounded border">
              {currentCase.id}
            </span>
            {currentCase.issues[0] && (
              <>
                <NhanNghiemTrong muc={currentCase.issues[0].impact.level} />
                <NhanLoaiVanDe loai={currentCase.issues[0].category} />
              </>
            )}
            {currentCase.hasDisagreement && (
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-800 border-amber-300 text-xs dark:bg-amber-950 dark:text-amber-300"
              >
                ⚠️ Có ý kiến trái chiều
              </Badge>
            )}
          </div>

          <div className="text-xs text-muted-foreground font-mono">
            {dinhDangPhut(currentCase.tuGiay)} –{" "}
            {dinhDangPhut(currentCase.denGiay)}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {currentCase.title}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span>
              Câu: <strong>{currentCase.sentenceNs.join(", ")}</strong>
            </span>
            <span>·</span>
            <span>
              Người phản hồi:{" "}
              <strong>{currentCase.independentSenders} độc lập</strong> (
              {currentCase.mentions} lượt nhắc)
            </span>
          </div>
        </div>

        {/* CẢNH BÁO NẾU LÀ VỊ TRÍ SUY ĐOÁN HOẶC LỖI KỸ THUẬT */}
        {currentCase.type === "can-xac-nhan" && (
          <div className="rounded-lg border border-amber-300 bg-amber-50/80 p-3 text-amber-900 text-xs dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold">
                Vị trí suy đoán / chưa xác định mốc chính xác
              </p>
              <p className="text-[11px] mt-0.5 leading-relaxed">
                Người học phản hồi chung chung về chủ đề hoặc thời điểm chưa
                khớp kịch bản. Hệ thống định vị theo từ khóa; cần xác nhận lại
                mốc câu khi thu âm và dựng hình.
              </p>
            </div>
          </div>
        )}

        {currentCase.type === "ky-thuat" && (
          <div className="rounded-lg border border-sky-300 bg-sky-50/80 p-3 text-sky-900 text-xs dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200 flex items-start gap-2.5">
            <Wrench className="size-4 shrink-0 text-sky-600 mt-0.5" />
            <div>
              <p className="font-semibold">
                Lỗi kỹ thuật hoặc hiển thị ngoại cảnh
              </p>
              <p className="text-[11px] mt-0.5 leading-relaxed">
                Phản ánh về âm lượng, hình ảnh giật, hoặc font chữ. Cần kỹ thuật
                viên kiểm tra trực tiếp file dựng; phạm vi làm lại kịch bản chưa
                xác định.
              </p>
            </div>
          </div>
        )}

        {/* CHI TIẾT CÁC TRỞ NGẠI */}
        <div className="space-y-2 pt-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            (A) Trở ngại người học gặp phải
          </span>
          <div className="space-y-2">
            {currentCase.issues.map((iss) => (
              <div
                key={iss.id}
                className="rounded-lg border bg-muted/20 p-3 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground text-sm">
                    {iss.summary}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {iss.id}
                  </Badge>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  <strong>Ảnh hưởng ({iss.impact.level}):</strong>{" "}
                  {iss.impact.reason}
                </p>

                {iss.causeHypothesis && (
                  <div className="rounded bg-background p-2 border text-[11px] space-y-0.5">
                    <span className="font-semibold text-primary">
                      Giả thuyết nguyên nhân:{" "}
                    </span>
                    <span>{iss.causeHypothesis.text} </span>
                    <span className="text-muted-foreground italic">
                      (
                      {iss.causeHypothesis.source === "nguoi-gop-y"
                        ? "suy đoán từ người học"
                        : "AI đối chiếu kịch bản"}
                      )
                    </span>
                  </div>
                )}

                {iss.uncertainties && iss.uncertainties.length > 0 && (
                  <div className="text-[11px] text-muted-foreground space-y-1 pt-1">
                    <span className="font-medium text-foreground">
                      Điểm chưa chắc chắn:
                    </span>
                    <ul className="list-disc ml-4 space-y-0.5">
                      {iss.uncertainties.map((u, i) => (
                        <li key={i}>{u}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PHẦN B: BẰNG CHỨNG GOM THEO NGƯỜI GỬI & Ý KIẾN TRÁI CHIỀU */}
      <section className="space-y-3 pb-4 border-b">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            (B) Bằng chứng từ người học ({caseEvidenceList.length} phản hồi từ{" "}
            {groupedBySender.length} người)
          </span>
        </div>

        {/* NẾU CÓ LUỒNG Ý KIẾN TRÁI CHIỀU: ĐẶT CẠNH NHAU */}
        {currentCase.issues.some(
          (iss) => iss.stances && iss.stances.length > 1,
        ) && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-2 dark:bg-amber-950/20">
            <p className="font-semibold text-xs text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 text-amber-600" />
              So sánh các luồng ý kiến trái chiều:
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {currentCase.issues
                .flatMap((iss) => iss.stances || [])
                .map((st, i) => (
                  <div
                    key={i}
                    className="rounded-md bg-background p-2.5 border text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-primary">
                        Luồng: {st.direction}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {st.feedbackIds.length} người
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      Góp ý: {st.feedbackIds.join(", ")}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* DANH SÁCH BẰNG CHỨNG GOM THEO NGƯỜI GỬI */}
        <div className="grid gap-2.5 sm:grid-cols-2">
          {groupedBySender.map(([sender, feedbacks]) => (
            <div
              key={sender}
              className="rounded-lg border bg-card p-3 space-y-2 text-xs transition-shadow hover:shadow-xs"
            >
              {/* Header người gửi */}
              <div className="flex items-center justify-between border-b pb-1.5">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <Users className="size-3.5 text-primary shrink-0" />
                  <span className="font-mono text-xs">{sender}</span>
                </div>
                <Badge variant="outline" className="text-[10px] bg-muted/60">
                  {feedbacks.length} lần phản hồi
                </Badge>
              </div>

              {/* Từng phản hồi của người này */}
              <div className="space-y-2 pt-0.5">
                {feedbacks.map((f) => (
                  <div key={f.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-1 text-[11px]">
                      <span className="font-mono text-muted-foreground">
                        {f.id}
                      </span>
                      <div className="flex items-center gap-1">
                        {f.survey?.deHieu != null && (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 text-amber-700"
                          >
                            Hiểu: {f.survey.deHieu}/5
                          </Badge>
                        )}
                        {f.survey?.nhipDo != null && (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 text-sky-700"
                          >
                            Nhịp: {f.survey.nhipDo}/5
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-foreground bg-muted/40 p-2 rounded text-[11px] leading-relaxed italic">
                      "{f.sanitizedText}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PHẦN C: NGỮ CẢNH V1 (3 TAB + NÚT XEM ĐOẠN V1) */}
      <section className="space-y-3 pb-4 border-b">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              (C) Ngữ cảnh kịch bản v1
            </span>
            <p className="text-[11px] text-muted-foreground">
              Đối chiếu lời đọc, chữ hiển thị và phụ đề gốc trước khi quyết định
            </p>
          </div>

          {/* NÚT BẬT VIDEO ĐOẠN V1 ON-DEMAND */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowVideoPreview(!showVideoPreview)}
            className="gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/5"
          >
            {showVideoPreview ? (
              <>
                <X className="size-3.5" /> Ẩn video đoạn
              </>
            ) : (
              <>
                <Film className="size-3.5" /> Xem đoạn v1 (
                {dinhDangPhut(currentCase.tuGiay)}–
                {dinhDangPhut(currentCase.denGiay)})
              </>
            )}
          </Button>
        </div>

        {/* Video Player on demand */}
        {showVideoPreview && (
          <div className="rounded-xl border bg-black/5 p-3 space-y-2 dark:bg-neutral-900/50">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Video className="size-4 text-primary" /> Đoạn video v1 tương
                ứng
              </span>
              <span>
                Tự động phát từ mốc {dinhDangPhut(currentCase.tuGiay)} đến{" "}
                {dinhDangPhut(currentCase.denGiay)}
              </span>
            </div>
            <VideoDoan
              tuGiay={currentCase.tuGiay}
              denGiay={currentCase.denGiay}
            />
          </div>
        )}

        {/* 3 Tabs Ngữ cảnh */}
        <Tabs defaultValue="loi-doc" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="loi-doc" className="text-xs gap-1.5">
              <Mic className="size-3.5" /> Lời đọc (+ngữ cảnh)
            </TabsTrigger>
            <TabsTrigger value="chu-hinh" className="text-xs gap-1.5">
              <Layers className="size-3.5" /> Chữ & Ý đồ hình
            </TabsTrigger>
            <TabsTrigger value="phu-de" className="text-xs gap-1.5">
              <Subtitles className="size-3.5" /> Phụ đề transcript
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Lời đọc */}
          <TabsContent value="loi-doc" className="pt-2 space-y-2">
            <div className="divide-y rounded-lg border bg-card text-xs">
              {contextSentenceNs.map((ctx) => {
                const s = sentenceMap.get(ctx.n);
                if (!s) return null;

                const isCore = ctx.isCore;
                const isSilence = Boolean(s.dungGiay && !s.loi);

                return (
                  <div
                    key={ctx.n}
                    className={`p-3 space-y-1 transition-colors ${
                      isCore
                        ? "bg-primary/5 font-medium border-l-3 border-l-primary"
                        : "bg-muted/20 opacity-75"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold">Câu {ctx.n}</span>
                        {ctx.isPreContext && (
                          <Badge variant="outline" className="text-[9px] py-0">
                            Ngữ cảnh trước
                          </Badge>
                        )}
                        {ctx.isPostContext && (
                          <Badge variant="outline" className="text-[9px] py-0">
                            Ngữ cảnh sau
                          </Badge>
                        )}
                      </div>
                      <span>
                        {dinhDangPhut(s.batDauGiay)} –{" "}
                        {dinhDangPhut(s.ketThucGiay)}
                      </span>
                    </div>

                    {isSilence ? (
                      <p className="italic text-amber-600 font-medium">
                        (khoảng lặng dừng {s.dungGiay} giây)
                      </p>
                    ) : (
                      <p
                        className={`text-sm ${isCore ? "text-foreground font-semibold" : "text-muted-foreground"}`}
                      >
                        {s.loi}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Tab 2: Chữ & Ý đồ hình */}
          <TabsContent value="chu-hinh" className="pt-2 space-y-2">
            <div className="divide-y rounded-lg border bg-card text-xs">
              {currentCase.sentenceNs.map((n) => {
                const s = sentenceMap.get(n);
                if (!s) return null;

                return (
                  <div key={n} className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                      <span>Câu {n}</span>
                      <span>
                        {dinhDangPhut(s.batDauGiay)} –{" "}
                        {dinhDangPhut(s.ketThucGiay)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-foreground">
                        <strong className="text-muted-foreground">
                          Chữ trên màn hình:
                        </strong>{" "}
                        {s.chuTrenManHinh || (
                          <span className="italic text-muted-foreground">
                            Không có
                          </span>
                        )}
                      </p>
                      <p className="text-foreground">
                        <strong className="text-muted-foreground">
                          Ý đồ hình:
                        </strong>{" "}
                        {s.yDoHinh || (
                          <span className="italic text-muted-foreground">
                            Không có
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Tab 3: Phụ đề transcript */}
          <TabsContent value="phu-de" className="pt-2 space-y-2">
            <div className="rounded-lg border bg-card p-3 space-y-2 text-xs font-mono">
              {currentCase.sentenceNs.map((n) => {
                const s = sentenceMap.get(n);
                if (!s || !s.loi) return null;

                return (
                  <div key={n} className="flex items-start gap-2 py-1">
                    <span className="text-muted-foreground select-none shrink-0">
                      [{dinhDangPhut(s.batDauGiay)} -{" "}
                      {dinhDangPhut(s.ketThucGiay)}]
                    </span>
                    <span className="text-foreground">{s.loi}</span>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {/* PHẦN D: PHƯƠNG ÁN SỬA A/B ĐỐI XỨNG & BỘ NÚT QUYẾT ĐỊNH */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              (D) Phương án đề xuất sửa
            </span>
            <p className="text-[11px] text-muted-foreground">
              So sánh song song 2 phương án đối xứng và tác động tăng thêm vào
              gói v2
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            Chọn 1 phương án, Hoãn hoặc Giữ nguyên
          </span>
        </div>

        {currentCase.options.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-xs">
            Không có phương án sửa trực tiếp cho hồ sơ này. Bạn có thể chọn Hoãn
            hoặc Giữ nguyên kịch bản v1.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {currentCase.options.map((opt) => {
              const isSelected =
                currentDecision?.type === "chon" &&
                currentDecision.optionId === opt.id;
              const isDisabled =
                opt.status === "khong-hop-le" || opt.status === "ngoai-pham-vi";

              const standalone = computeOptionStandaloneWork(
                opt,
                currentCase.id,
                script,
              );
              const delta = computeIncrementalWork(opt);

              return (
                <Card
                  key={opt.id}
                  className={`flex flex-col justify-between border-2 transition-all ${
                    isSelected
                      ? "border-green-600 bg-green-50/20 dark:bg-green-950/20 shadow-sm"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <CardHeader className="pb-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant={isSelected ? "default" : "outline"}
                        className="font-bold text-xs"
                      >
                        Phương án {opt.label}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          opt.status === "hop-le"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : opt.status === "ngoai-pham-vi"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-red-50 text-red-700 border-red-200"
                        }`}
                      >
                        {nhanTrangThaiPhuongAn[opt.status]}
                      </Badge>
                    </div>

                    <CardTitle className="text-sm font-bold text-foreground">
                      {opt.title}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {opt.rationale}
                    </p>
                  </CardHeader>

                  <CardContent className="space-y-3 text-xs flex-1 flex flex-col justify-between">
                    <div className="space-y-3">
                      {/* BEFORE / AFTER DIFF TỪNG PATCH */}
                      {opt.patches.length > 0 && (
                        <div className="space-y-2 border rounded-md p-2.5 bg-muted/20">
                          <p className="font-semibold text-foreground text-[11px]">
                            Thay đổi câu từ cụ thể:
                          </p>
                          {opt.patches.map((p, pIdx) => (
                            <div key={pIdx} className="space-y-1 text-xs">
                              <span className="font-mono font-medium text-primary text-[11px]">
                                Câu {p.n} ({p.field}):
                              </span>
                              <div className="rounded bg-red-50/70 dark:bg-red-950/40 p-1.5 border-l-2 border-red-500 text-red-950 dark:text-red-200 text-[11px]">
                                <strong>Trước:</strong> {p.before}
                              </div>
                              <div className="rounded bg-green-50/70 dark:bg-green-950/40 p-1.5 border-l-2 border-green-500 text-green-950 dark:text-green-200 text-[11px]">
                                <strong>Sau:</strong> {p.after}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* HIỆU QUẢ VÀ VẤN ĐỀ CÒN LẠI */}
                      <div className="space-y-1 text-[11px] text-muted-foreground border-t pt-2">
                        <p>
                          <strong className="text-foreground">
                            Dự kiến giải quyết:
                          </strong>{" "}
                          {opt.expectedEffect === "giai-quyet"
                            ? "Giải quyết toàn bộ trở ngại"
                            : "Giải quyết một phần"}
                        </p>
                        {opt.remaining && (
                          <p>
                            <strong className="text-foreground">
                              Vấn đề còn lại:
                            </strong>{" "}
                            {opt.remaining}
                          </p>
                        )}
                        {opt.needsHumanCheck && (
                          <p className="text-amber-700 dark:text-amber-400 font-medium">
                            <strong>Cần người kiểm tra:</strong>{" "}
                            {opt.needsHumanCheck}
                          </p>
                        )}
                      </div>

                      {/* KHỐI LƯỢNG PHÁT SINH RIÊNG VS PHẦN VIỆC TĂNG THÊM */}
                      <div className="rounded bg-muted/40 p-2.5 space-y-1.5 text-[11px]">
                        <div className="text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            Khối lượng riêng:{" "}
                          </span>
                          Thu {standalone.cauThuLai.length} câu (
                          {standalone.soKyTuThuLai} ký tự) · Dựng{" "}
                          {standalone.canhDungLai.length} cảnh · Sửa{" "}
                          {standalone.phuDeSua.length} phụ đề
                        </div>
                        <div className="text-primary font-medium border-t border-border/60 pt-1">
                          <span>Phần việc tăng thêm trong gói: </span>
                          <span className="font-semibold">
                            +{delta.extraSentences.length} câu thu mới (+
                            {delta.extraChars} ký tự) · +
                            {delta.extraScenes.length} cảnh · +
                            {delta.extraSubs.length} phụ đề
                          </span>
                        </div>
                      </div>

                      {/* LÝ DO VÔ HIỆU NẾU CÓ */}
                      {opt.statusReasons.length > 0 && (
                        <div className="text-red-600 dark:text-red-400 text-[11px]">
                          {opt.statusReasons.join("; ")}
                        </div>
                      )}
                    </div>

                    {/* NÚT CHỌN A / CHỌN B */}
                    <div className="pt-3">
                      <Button
                        type="button"
                        className="w-full gap-2 text-xs"
                        disabled={isDisabled}
                        variant={isSelected ? "default" : "outline"}
                        onClick={() => onSelectOption(opt)}
                      >
                        {isSelected ? (
                          <>
                            <Check className="size-4" /> Đã chọn phương án{" "}
                            {opt.label}
                          </>
                        ) : isDisabled ? (
                          "Không thể chọn"
                        ) : (
                          `Chọn phương án ${opt.label}`
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* THANH HÀNH ĐỘNG QUYẾT ĐỊNH TOÀN VÙNG: HOÃN / GIỮ NGUYÊN / XÉT LẠI */}
        <div className="rounded-xl border bg-muted/30 p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs">
            <span className="font-semibold text-foreground">
              Trạng thái vùng {currentCase.id}:
            </span>{" "}
            {currentDecision?.type === "chon" ? (
              <span className="text-green-600 font-bold">
                Đã chọn phương án{" "}
                {currentDecision.optionId?.split("-").pop()?.toUpperCase()}
              </span>
            ) : currentDecision?.type === "hoan" ? (
              <span className="text-amber-600 font-bold">
                Đã hoãn ({currentDecision.reason})
              </span>
            ) : currentDecision?.type === "bo" ? (
              <span className="text-neutral-500 font-bold">
                Giữ nguyên bản gốc v1 ({currentDecision.reason})
              </span>
            ) : (
              <span className="text-muted-foreground italic">Chưa duyệt</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentDecision ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onReset}
                className="gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-3.5" /> Xét lại vùng này
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeferModal(true)}
                  className="gap-1.5 text-xs text-amber-700 border-amber-300 dark:text-amber-400"
                >
                  <Clock className="size-3.5" /> Hoãn
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRejectModal(true)}
                  className="gap-1.5 text-xs text-neutral-700 border-neutral-300 dark:text-neutral-300"
                >
                  <X className="size-3.5" /> Giữ nguyên
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* MODAL HOÃN */}
      {showDeferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="max-w-md w-full p-4 space-y-3">
            <CardTitle className="text-base">
              Hoãn sửa vùng {currentCase.id}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Nhập lý do hoãn (tối thiểu 3 ký tự) để đưa vào danh sách chưa xử
              lý trong bản sửa v2:
            </p>
            <Textarea
              placeholder="Ví dụ: Cần xác nhận thêm từ người học hoặc thảo luận trong buổi họp tuần tới..."
              value={deferReason}
              onChange={(e) => setDeferReason(e.target.value)}
              rows={3}
              className="text-xs"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowDeferModal(false)}
              >
                Hủy
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={deferReason.trim().length < 3}
                onClick={handleConfirmDefer}
              >
                Xác nhận hoãn
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL GIỮ NGUYÊN */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="max-w-md w-full p-4 space-y-3">
            <CardTitle className="text-base">Giữ nguyên bản gốc v1</CardTitle>
            <p className="text-xs text-muted-foreground">
              Nhập lý do không thay đổi (tối thiểu 3 ký tự) để lưu vào báo cáo
              truy vết:
            </p>
            <Textarea
              placeholder="Ví dụ: Lời đọc v1 đã phù hợp mục tiêu bài học; giữ nguyên cấu trúc..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="text-xs"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowRejectModal(false)}
              >
                Hủy
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={rejectReason.trim().length < 3}
                onClick={handleConfirmReject}
              >
                Xác nhận giữ nguyên
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

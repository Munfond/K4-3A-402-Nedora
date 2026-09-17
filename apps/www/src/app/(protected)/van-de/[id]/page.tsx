"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock,
  ExternalLink,
  HelpCircle,
  RotateCcw,
  Sparkles,
  Users,
  Wrench,
  X,
} from "lucide-react";

import PageWrapper from "@/components/page-wrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import VideoDoan from "@/components/c5/video-doan";
import GopYItem from "@/components/c5/gop-y-item";
import { NhanLoaiVanDe, NhanNghiemTrong } from "@/components/c5/nhan";
import { dinhDangPhut, nhanTrangThaiPhuongAn } from "@/lib/revision/format";
import { getLastRunId, useQuyetDinh } from "@/hooks/use-quyet-dinh";
import { computeOptionStandaloneWork } from "@/lib/revision/engine";
import type {
  DecisionCase,
  DecisionRecord,
  FeedbackItem,
  RevisionOption,
  RevisionRunResult,
  RunMetadata,
  SentenceData,
} from "@/lib/revision/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ChiTietVanDePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: caseId } = use(params);
  const searchParams = useSearchParams();
  const queryRunId = searchParams.get("run");
  const [activeRunId, setActiveRunId] = useState<string>(queryRunId || "");

  useEffect(() => {
    if (queryRunId) {
      setActiveRunId(queryRunId);
    } else {
      const last = getLastRunId();
      if (last) setActiveRunId(last);
    }
  }, [queryRunId]);

  const { layQuyetDinh, dat, isStorageFailed } = useQuyetDinh(activeRunId);

  const { data, isLoading } = useSWR<{
    run: RunMetadata;
    result?: RevisionRunResult;
  }>(activeRunId ? `/api/revisions/runs/${activeRunId}` : null, fetcher);

  const result = data?.result;
  const script = result?.script;
  const currentCase = result?.cases.find((c) => c.id === caseId);

  const currentDecision: DecisionRecord | undefined = layQuyetDinh(caseId);

  const [deferReason, setDeferReason] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showDeferDialog, setShowDeferDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  if (isLoading) {
    return (
      <PageWrapper className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground text-sm">Đang tải hồ sơ...</p>
      </PageWrapper>
    );
  }

  if (!currentCase || !script) {
    return (
      <PageWrapper className="p-8 text-center space-y-4">
        <p className="text-muted-foreground">
          Không tìm thấy hồ sơ <strong>{caseId}</strong> trong run{" "}
          <code>{activeRunId || "hiện tại"}</code>.
        </p>
        <Link href={`/van-de?run=${activeRunId}`}>
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="size-4" /> Quay lại danh sách vấn đề
          </Button>
        </Link>
      </PageWrapper>
    );
  }

  const feedbackById = new Map<string, FeedbackItem>();
  for (const f of result?.feedback || []) {
    feedbackById.set(f.id, f);
  }

  const allEvidenceIds = Array.from(
    new Set(currentCase.issues.flatMap((iss) => iss.feedbackIds)),
  );
  const caseFeedbackList = allEvidenceIds
    .map((fid) => feedbackById.get(fid))
    .filter((f): f is FeedbackItem => f != null);

  const sentenceMap = new Map<number, SentenceData>(
    script.cau.map((c) => [c.n, c]),
  );

  const handleSelectOption = (option: RevisionOption) => {
    if (option.status === "khong-hop-le" || option.status === "ngoai-pham-vi") {
      return;
    }
    dat(caseId, {
      type: "chon",
      optionId: option.id,
      at: new Date().toISOString(),
    });
  };

  const handleDefer = () => {
    if (deferReason.trim().length < 3) return;
    dat(caseId, {
      type: "hoan",
      reason: deferReason.trim(),
      at: new Date().toISOString(),
    });
    setShowDeferDialog(false);
  };

  const handleReject = () => {
    if (rejectReason.trim().length < 3) return;
    dat(caseId, {
      type: "bo",
      reason: rejectReason.trim(),
      at: new Date().toISOString(),
    });
    setShowRejectDialog(false);
  };

  const handleReset = () => {
    dat(caseId, {
      type: "chon",
      optionId: undefined,
      at: new Date().toISOString(),
    });
  };

  return (
    <PageWrapper className="overflow-y-auto pb-24">
      <div className="mx-auto mt-6 w-full max-w-5xl space-y-6 px-4">
        {/* THANH ĐIỀU HƯỚNG QUAY LẠI */}
        <div className="flex items-center justify-between gap-4">
          <Link
            href={`/van-de?run=${activeRunId}`}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium"
          >
            <ArrowLeft className="size-3.5" /> Danh sách vấn đề
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {currentCase.id}
            </span>
            {currentDecision?.type === "chon" && (
              <Badge className="bg-green-600 text-white">
                Đã chọn {currentDecision.optionId?.split("-").pop()}
              </Badge>
            )}
            {currentDecision?.type === "hoan" && (
              <Badge className="bg-amber-600 text-white">Đã hoãn</Badge>
            )}
            {currentDecision?.type === "bo" && (
              <Badge className="bg-neutral-600 text-white">Đã bỏ</Badge>
            )}
          </div>
        </div>

        {/* CẢNH BÁO STORAGE THẤT BẠI C3-STO-03 */}
        {isStorageFailed && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-800 text-xs dark:bg-amber-950/40 dark:text-amber-300">
            Chưa lưu vào trình duyệt (localStorage bị chặn) — tải lại trang sẽ
            mất quyết định!
          </div>
        )}

        {/* CẢNH BÁO NẾU LÀ HỒ SƠ CẦN XÁC NHẬN VỊ TRÍ */}
        {currentCase.type === "can-xac-nhan" && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800 text-xs dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300 flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            <span>
              <strong>Cảnh báo vị trí chưa xác nhận:</strong> Góp ý này chưa
              định vị chắc chắn vào câu cụ thể. Bạn có thể chọn phương án nhưng
              cần xác nhận lại mốc khi sản xuất.
            </span>
          </div>
        )}

        {/* C3-UI-03 (1): THÔNG TIN VẤN ĐỀ TRONG HỒ SƠ */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
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
                className="bg-amber-50 text-amber-700 border-amber-200 text-xs dark:bg-amber-950 dark:text-amber-300"
              >
                Ý kiến trái chiều
              </Badge>
            )}
          </div>

          <h1 className="text-balance font-bold text-2xl dark:text-neutral-50 sm:text-3xl">
            {currentCase.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-muted-foreground text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" />
              Câu {currentCase.sentenceNs.join(", ")} ·{" "}
              {dinhDangPhut(currentCase.tuGiay)}–
              {dinhDangPhut(currentCase.denGiay)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4" />
              {currentCase.independentSenders} người độc lập ·{" "}
              {currentCase.mentions} lượt nhắc
            </span>
          </div>

          {/* Thay câu C3-UI-03 cho lỗi kỹ thuật */}
          {currentCase.type === "ky-thuat" && (
            <p className="rounded-md bg-sky-50 px-3 py-2 text-sky-800 text-sm dark:bg-sky-950/50 dark:text-sky-300">
              Lỗi kỹ thuật — Cần người kiểm tra; phạm vi làm lại chưa xác định.
            </p>
          )}

          {/* Chi tiết từng issue */}
          <div className="space-y-2 pt-2">
            {currentCase.issues.map((iss) => (
              <div
                key={iss.id}
                className="rounded-lg border bg-card p-3 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground text-sm">
                    {iss.summary}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {iss.id}
                  </Badge>
                </div>
                <p className="text-muted-foreground">
                  <strong>Ảnh hưởng ({iss.impact.level}):</strong>{" "}
                  {iss.impact.reason}
                </p>

                {/* Stances đặt cạnh nhau nếu có trái chiều */}
                {iss.stances && iss.stances.length > 0 && (
                  <div className="pt-2 border-t space-y-1">
                    <p className="font-medium text-foreground">
                      Các luồng ý kiến người học:
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {iss.stances.map((st, i) => (
                        <div
                          key={i}
                          className="rounded bg-muted/60 p-2 border space-y-1"
                        >
                          <span className="font-semibold text-primary">
                            Hướng: {st.direction}
                          </span>
                          <p className="text-muted-foreground">
                            {st.feedbackIds.length} góp ý:{" "}
                            {st.feedbackIds.join(", ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* C3-UI-03 (2) & (3): VIDEO ĐOẠN & CÂU KỊCH BẢN */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <div>
              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider mb-2">
                Đoạn video tương ứng
              </p>
              <VideoDoan
                tuGiay={currentCase.tuGiay}
                denGiay={currentCase.denGiay}
              />
            </div>

            {/* CÂU TRONG KỊCH BẢN GỐC */}
            <div className="space-y-2">
              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider">
                Câu trong kịch bản gốc
              </p>
              <div className="divide-y rounded-lg border bg-card text-xs">
                {currentCase.sentenceNs.map((n) => {
                  const s = sentenceMap.get(n);
                  if (!s) return null;
                  return (
                    <div key={n} className="p-3 space-y-1">
                      <div className="flex items-center justify-between font-mono text-muted-foreground">
                        <span>Câu {n}</span>
                        <span>
                          {dinhDangPhut(s.batDauGiay)} –{" "}
                          {dinhDangPhut(s.ketThucGiay)}
                        </span>
                      </div>
                      {s.loi && (
                        <p className="font-medium text-foreground text-sm">
                          {s.loi}
                        </p>
                      )}
                      {s.dungGiay && (
                        <p className="italic text-muted-foreground">
                          (khoảng lặng dừng {s.dungGiay} giây)
                        </p>
                      )}
                      {s.chuTrenManHinh && (
                        <p className="text-muted-foreground">
                          <strong>Màn hình:</strong> {s.chuTrenManHinh}
                        </p>
                      )}
                      {s.yDoHinh && (
                        <p className="text-muted-foreground">
                          <strong>Ý đồ hình:</strong> {s.yDoHinh}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* C3-UI-03 (4) & (5): BẰNG CHỨNG GỐC VÀ ĐIỀU CHƯA RÕ */}
          <div className="space-y-4">
            {/* ĐIỀU CHƯA RÕ & GIẢ THUYẾT NGUYÊN NHÂN */}
            <div className="space-y-2">
              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider">
                Điều chưa chắc & Giả thuyết nguyên nhân
              </p>
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2.5 text-xs">
                {currentCase.issues.map((iss) => (
                  <div key={iss.id} className="space-y-1.5">
                    {iss.causeHypothesis && (
                      <p>
                        <strong>Giả thuyết nguyên nhân:</strong>{" "}
                        {iss.causeHypothesis.text} (
                        <em>
                          Nguồn:{" "}
                          {iss.causeHypothesis.source === "nguoi-gop-y"
                            ? "người học suy đoán"
                            : "AI đối chiếu kịch bản"}
                        </em>
                        )
                      </p>
                    )}
                    {iss.uncertainties && iss.uncertainties.length > 0 && (
                      <ul className="list-disc ml-4 space-y-0.5 text-muted-foreground">
                        {iss.uncertainties.map((u, i) => (
                          <li key={i}>{u}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
                <p className="text-muted-foreground italic border-t pt-1.5">
                  Hệ thống chỉ đọc kịch bản văn bản, không nghe/xem được video
                  trực tiếp.
                </p>
              </div>
            </div>

            {/* BẰNG CHỨNG GÓP Ý GỐC */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider">
                  Bằng chứng góp ý gốc ({caseFeedbackList.length})
                </p>
              </div>
              <div className="divide-y rounded-lg border bg-card max-h-[380px] overflow-y-auto">
                {caseFeedbackList.length === 0 ? (
                  <p className="p-4 text-center text-muted-foreground text-xs">
                    Không có bằng chứng
                  </p>
                ) : (
                  caseFeedbackList.map((f) => <GopYItem key={f.id} gopY={f} />)
                )}
              </div>
            </div>
          </div>
        </div>

        {/* C3-UI-03 (6): SO SÁNH NGANG CÁC PHƯƠNG ÁN (A vs B) */}
        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg text-foreground">
              Các phương án đề xuất ({currentCase.options.length})
            </h2>
            <span className="text-xs text-muted-foreground">
              Chọn tối đa 1 phương án cho hồ sơ này
            </span>
          </div>

          {currentCase.options.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
              Không có phương án sửa trực tiếp cho hồ sơ này. Bạn có thể chọn
              Hoãn hoặc Bỏ.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {currentCase.options.map((opt) => {
                const isSelected = currentDecision?.optionId === opt.id;
                const isDisabled =
                  opt.status === "khong-hop-le" ||
                  opt.status === "ngoai-pham-vi";

                const standalone = computeOptionStandaloneWork(
                  opt,
                  currentCase.id,
                  script,
                );

                return (
                  <Card
                    key={opt.id}
                    className={`flex flex-col justify-between border-2 transition-all ${
                      isSelected
                        ? "border-green-600 bg-green-50/20 dark:bg-green-950/20 shadow-sm"
                        : "border-border"
                    }`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge
                          variant={isSelected ? "default" : "outline"}
                          className="font-bold text-sm"
                        >
                          Phương án {opt.label}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
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
                      <CardTitle className="text-base mt-2">
                        {opt.title}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {opt.rationale}
                      </p>
                    </CardHeader>

                    <CardContent className="space-y-3 text-xs flex-1">
                      {/* BEFORE / AFTER DIFF TỪNG PATCH */}
                      {opt.patches.length > 0 && (
                        <div className="space-y-2 border rounded-md p-2.5 bg-muted/20">
                          <p className="font-semibold text-foreground">
                            Thay đổi cụ thể:
                          </p>
                          {opt.patches.map((p, pIdx) => (
                            <div key={pIdx} className="space-y-1 text-xs">
                              <span className="font-mono font-medium text-primary">
                                Câu {p.n} ({p.field}):
                              </span>
                              <div className="rounded bg-red-50/60 dark:bg-red-950/30 p-1.5 border-l-2 border-red-500 text-red-950 dark:text-red-300">
                                <strong>Trước:</strong> {p.before}
                              </div>
                              <div className="rounded bg-green-50/60 dark:bg-green-950/30 p-1.5 border-l-2 border-green-500 text-green-950 dark:text-green-300">
                                <strong>Sau:</strong> {p.after}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* NẾU CÓ UNSUPPORTED OPERATION */}
                      {opt.unsupportedOperation && (
                        <div className="rounded bg-amber-50 p-2.5 border border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                          <p className="font-semibold">
                            Ngoài phạm vi bản CP3 / cần xử lý sau:
                          </p>
                          <p>
                            {opt.unsupportedOperation.kind}:{" "}
                            {opt.unsupportedOperation.description}
                          </p>
                        </div>
                      )}

                      {/* HIỆU QUẢ DỰ KIẾN */}
                      <div className="text-muted-foreground space-y-1">
                        <p>
                          <strong>Hiệu quả:</strong>{" "}
                          {opt.expectedEffect === "giai-quyet"
                            ? "Giải quyết toàn bộ vấn đề trong vùng"
                            : "Giải quyết một phần"}
                        </p>
                        {opt.remaining && (
                          <p>
                            <strong>Vấn đề còn lại:</strong> {opt.remaining}
                          </p>
                        )}
                        {opt.needsHumanCheck && (
                          <p className="text-amber-700 dark:text-amber-400 font-medium">
                            <strong>Cần người kiểm tra:</strong>{" "}
                            {opt.needsHumanCheck}
                          </p>
                        )}
                      </div>

                      {/* PHẠM VI NẾU CHỈ CHỌN PHƯƠNG ÁN NÀY */}
                      <div className="rounded bg-muted/40 p-2 text-muted-foreground space-y-1">
                        <p className="font-semibold text-foreground">
                          Phạm vi làm lại riêng:
                        </p>
                        <p>
                          Thu lại {standalone.cauThuLai.length} câu (
                          {standalone.soKyTuThuLai} ký tự) · Dựng{" "}
                          {standalone.canhDungLai.length} cảnh · Sửa{" "}
                          {standalone.phuDeSua.length} phụ đề
                        </p>
                      </div>

                      {/* LÝ DO VÔ HIỆU KHI KHÔNG HỢP LỆ */}
                      {opt.statusReasons.length > 0 && (
                        <div className="text-red-600 dark:text-red-400 text-xs">
                          {opt.statusReasons.join("; ")}
                        </div>
                      )}

                      {/* NÚT CHỌN */}
                      <div className="pt-2">
                        <Button
                          type="button"
                          className="w-full gap-2"
                          disabled={isDisabled}
                          variant={isSelected ? "default" : "outline"}
                          onClick={() => handleSelectOption(opt)}
                        >
                          {isSelected ? (
                            <>
                              <Check className="size-4" /> Đã chọn phương án{" "}
                              {opt.label}
                            </>
                          ) : isDisabled ? (
                            "Không thể chọn phương án này"
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
        </div>

        {/* C3-UI-03 (7): THANH HÀNH ĐỘNG QUYẾT ĐỊNH TOÀN HỒ SƠ */}
        <div className="sticky bottom-4 z-20 rounded-xl border bg-card/95 backdrop-blur p-4 shadow-lg flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs">
            <span className="font-semibold text-foreground">
              Quyết định hiện tại:
            </span>{" "}
            {currentDecision?.type === "chon" ? (
              <span className="text-green-600 font-bold">
                Đã chọn phương án {currentDecision.optionId?.split("-").pop()}
              </span>
            ) : currentDecision?.type === "hoan" ? (
              <span className="text-amber-600 font-bold">
                Đã hoãn ({currentDecision.reason})
              </span>
            ) : currentDecision?.type === "bo" ? (
              <span className="text-neutral-500 font-bold">
                Đã bỏ ({currentDecision.reason})
              </span>
            ) : (
              <span className="text-muted-foreground italic">Chưa chọn</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentDecision ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="gap-1.5 text-xs text-muted-foreground"
              >
                <RotateCcw className="size-3.5" />
                Xét lại hồ sơ này
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeferDialog(true)}
                  className="gap-1.5 text-xs text-amber-700 border-amber-300 dark:text-amber-400"
                >
                  <Clock className="size-3.5" />
                  Hoãn hồ sơ
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRejectDialog(true)}
                  className="gap-1.5 text-xs text-red-700 border-red-300 dark:text-red-400"
                >
                  <X className="size-3.5" />
                  Bỏ qua
                </Button>
              </>
            )}

            <Link href={`/xuat?run=${activeRunId}`}>
              <Button size="sm" className="gap-2 text-xs">
                Sang gói bàn giao
              </Button>
            </Link>
          </div>
        </div>

        {/* DIALOG HOÃN */}
        {showDeferDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <Card className="max-w-md w-full p-4 space-y-3">
              <CardTitle className="text-base">Hoãn sửa hồ sơ này</CardTitle>
              <p className="text-xs text-muted-foreground">
                Nhập lý do hoãn (3–200 ký tự) để đưa vào danh sách chưa xử lý
                trong gói phát hành:
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
                  onClick={() => setShowDeferDialog(false)}
                >
                  Hủy
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={deferReason.trim().length < 3}
                  onClick={handleDefer}
                >
                  Xác nhận hoãn
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* DIALOG BỎ */}
        {showRejectDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <Card className="max-w-md w-full p-4 space-y-3">
              <CardTitle className="text-base">Bỏ qua hồ sơ này</CardTitle>
              <p className="text-xs text-muted-foreground">
                Nhập lý do từ chối sửa (3–200 ký tự) để lưu vào báo cáo truy
                vết:
              </p>
              <Textarea
                placeholder="Ví dụ: Nội dung đã được giải thích ở video sau hoặc không phù hợp với mục tiêu bài học..."
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
                  onClick={() => setShowRejectDialog(false)}
                >
                  Hủy
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={rejectReason.trim().length < 3}
                  onClick={handleReject}
                >
                  Xác nhận bỏ
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}

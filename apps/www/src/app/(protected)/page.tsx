"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileCode,
  Film,
  Layers,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Upload,
  Video,
} from "lucide-react";

import PageWrapper from "@/components/page-wrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { dinhDangPhut } from "@/lib/revision/format";
import type { StudioVideo } from "@/lib/studio/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ThuVienVideoPage() {
  const { data, mutate, isLoading } = useSWR<{ videos: StudioVideo[] }>(
    "/api/studio/videos",
    fetcher,
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form thêm video
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationStr, setDurationStr] = useState("180");
  const [videoUrl, setVideoUrl] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [timecodeText, setTimecodeText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const videos = data?.videos || [];

  const filteredVideos = useMemo(() => {
    if (!searchQuery.trim()) return videos;
    const q = searchQuery.toLowerCase().trim();
    return videos.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        (v.description || "").toLowerCase().includes(q),
    );
  }, [videos, searchQuery]);

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    setFormError(null);

    try {
      let parsedScript = undefined;
      if (scriptText.trim()) {
        try {
          parsedScript = JSON.parse(scriptText);
        } catch {
          // Parse lines nếu là plain text
          const lines = scriptText.split(/\r?\n/).filter(Boolean);
          parsedScript = {
            id: `script-${Date.now()}`,
            tieuDe: title,
            cau: lines.map((line, idx) => ({
              n: idx + 1,
              phan: 1,
              loi: line.trim(),
              batDauGiay: idx * 6,
              ketThucTiengGiay: idx * 6 + 5,
              ketThucGiay: idx * 6 + 6,
              soKyTu: line.trim().length,
            })),
          };
        }
      }

      const res = await fetch("/api/studio/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          durationSeconds: parseInt(durationStr, 10) || 180,
          videoUrl: videoUrl.trim(),
          script: parsedScript,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Không thể tạo video");
      }

      await mutate();
      setShowAddModal(false);
      setTitle("");
      setDescription("");
      setVideoUrl("");
      setScriptText("");
      setTimecodeText("");
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageWrapper className="overflow-y-auto pb-24">
      <div className="max-w-7xl mx-auto px-4 mt-6 space-y-6">
        {/* HEADER THƯ VIỆN VIDEO */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs bg-muted font-mono">
                Video Studio
              </Badge>
              <span className="text-xs text-muted-foreground font-medium">
                {videos.length} video trong thư viện
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Thư viện video bài học
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Mở video để xem kịch bản–hình–giọng đồng bộ theo thời gian, tiếp
              nhận góp ý của người học và lập kế hoạch chỉnh sửa phiên bản v2.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowAddModal(true)}
              className="gap-1.5 text-xs font-semibold shadow-xs"
            >
              <Plus className="size-4" />
              Thêm video đã có
            </Button>
          </div>
        </div>

        {/* THANH TÌM KIẾM & BỘ LỌC NHANH */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên video, chủ đề..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
        </div>

        {/* LƯỚI THẺ VIDEO (VIDEO CARDS) */}
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="flex flex-col items-center gap-2 text-muted-foreground text-sm">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>Đang tải danh sách video...</span>
            </div>
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed text-muted-foreground text-xs space-y-2">
            <Film className="size-8 mx-auto text-muted-foreground/60" />
            <p className="font-semibold text-foreground">
              Không tìm thấy video nào
            </p>
            <p>
              Thử tìm kiếm với từ khóa khác hoặc bấm nút "Thêm video đã có".
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredVideos.map((video) => {
              const isSample = video.isSample;

              return (
                <Card
                  key={video.id}
                  className="flex flex-col justify-between overflow-hidden border shadow-xs hover:shadow-md transition-all group"
                >
                  {/* Thumbnail & Badges */}
                  <div className="relative aspect-video w-full bg-muted/60 border-b flex items-center justify-center overflow-hidden">
                    {/* Background preview effect */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />

                    <Film className="size-12 text-muted-foreground/40 group-hover:scale-110 transition-transform" />

                    {/* Top tags */}
                    <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5">
                      {isSample ? (
                        <Badge className="bg-primary text-primary-foreground font-semibold text-[10px] shadow-xs">
                          Dữ liệu mẫu
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-background/80 backdrop-blur-xs"
                        >
                          Video Studio
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-background/80 backdrop-blur-xs font-mono"
                      >
                        {video.currentVersion}
                      </Badge>
                    </div>

                    {/* Duration badge */}
                    <div className="absolute bottom-2.5 right-2.5 z-20 bg-black/80 text-white font-mono text-[11px] px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Clock className="size-3" />
                      <span>{dinhDangPhut(video.durationSeconds)}</span>
                    </div>
                  </div>

                  {/* Body Info */}
                  <CardContent className="p-4 space-y-3 flex-1 flex flex-col justify-between text-xs">
                    <div className="space-y-2">
                      <h3 className="font-bold text-sm text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                        {video.title}
                      </h3>
                      <p className="text-muted-foreground text-[11px] line-clamp-2 leading-relaxed">
                        {video.description || "Chưa có mô tả chi tiết."}
                      </p>
                    </div>

                    {/* Checklist dữ liệu sẵn có */}
                    <div className="rounded-lg bg-muted/30 p-2.5 border text-[11px] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Kịch bản:</span>
                        {video.hasScript ? (
                          <span className="text-green-600 font-medium flex items-center gap-1">
                            <CheckCircle2 className="size-3" /> Đầy đủ
                          </span>
                        ) : (
                          <span className="text-amber-600 font-medium flex items-center gap-1">
                            <AlertCircle className="size-3" /> Chưa nạp
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Timecode:</span>
                        {video.hasTimecodes ? (
                          <span className="text-green-600 font-medium flex items-center gap-1">
                            <CheckCircle2 className="size-3" /> Đã thẩm định
                          </span>
                        ) : (
                          <span className="text-amber-600 font-medium flex items-center gap-1">
                            <AlertCircle className="size-3" /> Chưa đồng bộ
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          Tệp video phát:
                        </span>
                        {video.hasVideoFile ? (
                          <span className="text-green-600 font-medium flex items-center gap-1">
                            <CheckCircle2 className="size-3" /> Có sẵn
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">
                            Video thô
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Trạng thái góp ý & Đợt sửa */}
                    <div className="flex items-center justify-between pt-1 border-t text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MessageSquare className="size-3.5 text-primary" />
                        <span>
                          <strong>{video.feedbackCount}</strong> phản hồi
                        </span>
                      </div>
                      <span className="text-[10px] bg-muted px-2 py-0.5 rounded font-mono">
                        Phiên bản {video.currentVersion}
                      </span>
                    </div>

                    {/* NÚT MỞ VIDEO (KHÔNG TỰ CHẠY AI) */}
                    <div className="pt-2">
                      <Link
                        href={`/videos/${video.id}` as any}
                        className="w-full block"
                      >
                        <Button
                          type="button"
                          className="w-full text-xs gap-1.5 h-8 font-semibold group-hover:bg-primary/90"
                        >
                          <span>Mở video</span>
                          <ArrowRight className="size-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* MODAL THÊM VIDEO ĐÃ CÓ */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <Card className="max-w-xl w-full max-h-[90vh] flex flex-col p-5 space-y-4 shadow-xl">
              <div className="border-b pb-3 space-y-1">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Plus className="size-4 text-primary" />
                  Thêm video đã có vào Studio
                </CardTitle>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Nhập thông tin video bài học đã sản xuất để theo dõi kịch bản
                  và chuẩn bị các đợt chỉnh sửa tiếp theo.
                </p>
              </div>

              {formError && (
                <div className="p-2.5 rounded-lg border border-red-300 bg-red-50 text-red-800 text-xs dark:bg-red-950/50 dark:text-red-300">
                  {formError}
                </div>
              )}

              <form
                onSubmit={handleAddVideo}
                className="space-y-3.5 overflow-y-auto flex-1 text-xs pr-1"
              >
                <div>
                  <label className="block font-medium mb-1 text-foreground">
                    Tên bài giảng / Video *
                  </label>
                  <Input
                    placeholder="Ví dụ: Giới thiệu Hệ thống Khuyến nghị (Recommendation Systems)..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="h-8 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 text-foreground">
                    Mô tả tóm tắt
                  </label>
                  <Textarea
                    placeholder="Tóm tắt nội dung bài học hoặc mục tiêu đào tạo..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="text-xs"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block font-medium mb-1 text-foreground">
                      Thời lượng (giây)
                    </label>
                    <Input
                      type="number"
                      placeholder="180"
                      value={durationStr}
                      onChange={(e) => setDurationStr(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-medium mb-1 text-foreground">
                      Đường dẫn tệp video (URL hoặc MP4)
                    </label>
                    <Input
                      placeholder="/video/my-video.mp4 hoặc https://..."
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {/* Kịch bản & Timecode */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-foreground">
                      Kịch bản (JSON hoặc từng dòng lời đọc)
                    </label>
                    <span className="text-[10px] text-muted-foreground">
                      Tùy chọn bổ sung
                    </span>
                  </div>
                  <Textarea
                    placeholder="Dán JSON kịch bản hoặc mỗi dòng là một câu lời đọc..."
                    value={scriptText}
                    onChange={(e) => setScriptText(e.target.value)}
                    rows={3}
                    className="text-xs font-mono"
                  />
                </div>

                {/* Hướng dẫn thiếu dữ liệu trung thực */}
                <div className="rounded-lg border bg-muted/40 p-3 text-[11px] text-muted-foreground space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <AlertCircle className="size-3.5 text-amber-500" />
                    <span>Xử lý khi chưa đủ dữ liệu:</span>
                  </div>
                  <p>
                    Nếu bạn chưa có kịch bản hoặc timecode, video vẫn được tạo
                    với nhãn <strong>Video thô</strong>. Bạn có thể mở video để
                    xem trước và bổ sung kịch bản bất cứ lúc nào.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddModal(false)}
                    disabled={isSubmitting}
                  >
                    Hủy
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmitting || !title.trim()}
                  >
                    {isSubmitting ? "Đang lưu..." : "Thêm video"}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}

"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  Ban,
  Eye,
  Heart,
  Info,
  MessageSquare,
  ShieldAlert,
  ShieldX,
  UserX,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import type {
  FeedbackItem,
  RevisionBrief,
} from "@feedback/revision-core/types";

interface QuarantineDrawerProps {
  quarantinedFeedback: FeedbackItem[];
  unassignedFeedback: FeedbackItem[];
  brief?: RevisionBrief;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LABEL_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof Ban }
> = {
  "cong-kich": {
    label: "Công kích",
    color:
      "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-300 dark:border-red-700",
    icon: UserX,
  },
  "cai-lenh": {
    label: "Cài lệnh",
    color:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-300 dark:border-orange-700",
    icon: AlertTriangle,
  },
  "thong-tin-ca-nhan": {
    label: "Thông tin cá nhân",
    color:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-300 dark:border-purple-700",
    icon: Eye,
  },
  "bo-qua": {
    label: "Bỏ qua (spam/lạc đề)",
    color:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-600",
    icon: Ban,
  },
};

const CHANNEL_LABEL: Record<string, string> = {
  "khao-sat": "Khảo sát",
  "binh-luan": "Bình luận",
  "tin-nhan": "Tin nhắn",
  "van-ban-dan": "Văn bản dán",
};

export default function QuarantineDrawer({
  quarantinedFeedback,
  unassignedFeedback,
  brief,
  open,
  onOpenChange,
}: QuarantineDrawerProps) {
  const ghiNhan = brief?.ghiNhan ?? [];

  const totalItems =
    quarantinedFeedback.length + unassignedFeedback.length + ghiNhan.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:w-[480px] p-0 flex flex-col">
        <SheetHeader className="p-4 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <ShieldAlert className="size-4 text-amber-500" />
            Cách ly & Chờ duyệt
          </SheetTitle>
          <SheetDescription className="text-xs">
            {totalItems} mục không tham gia vào đề xuất chỉnh sửa
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="cach-ly" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 mt-2 mb-0 h-8">
            <TabsTrigger value="cach-ly" className="text-xs gap-1 h-7">
              <ShieldX className="size-3" />
              Cách ly
              {quarantinedFeedback.length > 0 && (
                <Badge
                  variant="secondary"
                  className="text-[9px] py-0 px-1 ml-0.5"
                >
                  {quarantinedFeedback.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="ghi-nhan" className="text-xs gap-1 h-7">
              <Heart className="size-3" />
              Ghi nhận
              {ghiNhan.length > 0 && (
                <Badge
                  variant="secondary"
                  className="text-[9px] py-0 px-1 ml-0.5"
                >
                  {ghiNhan.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="chua-gan" className="text-xs gap-1 h-7">
              <MessageSquare className="size-3" />
              Chưa gán
              {unassignedFeedback.length > 0 && (
                <Badge
                  variant="secondary"
                  className="text-[9px] py-0 px-1 ml-0.5"
                >
                  {unassignedFeedback.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Tab: Cách ly */}
          <TabsContent value="cach-ly" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-2">
                {quarantinedFeedback.length === 0 ? (
                  <EmptyState text="Không có mục nào bị cách ly" />
                ) : (
                  quarantinedFeedback.map((fb) => (
                    <QuarantinedCard key={fb.id} feedback={fb} />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Tab: Ghi nhận */}
          <TabsContent value="ghi-nhan" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-2">
                {ghiNhan.length === 0 ? (
                  <EmptyState text="Không có mục ghi nhận nào" />
                ) : (
                  ghiNhan.map((gn, i) => (
                    <div
                      key={i}
                      className="rounded-lg border bg-card p-3 space-y-1.5"
                    >
                      <div className="flex items-start gap-2">
                        <Heart className="size-3.5 text-rose-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-foreground leading-relaxed">
                          {gn.lyDo}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {gn.gopYIds.map((id) => (
                          <Badge
                            key={id}
                            variant="outline"
                            className="text-[9px] py-0 font-mono"
                          >
                            {id}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Tab: Chưa gán */}
          <TabsContent value="chua-gan" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-2">
                {unassignedFeedback.length === 0 ? (
                  <EmptyState text="Tất cả góp ý đã được gán vào vấn đề" />
                ) : (
                  unassignedFeedback.map((fb) => (
                    <div
                      key={fb.id}
                      className="rounded-lg border bg-card p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className="text-[9px] py-0 font-mono"
                          >
                            {fb.id}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {fb.sender}
                          </span>
                        </div>
                        <LabelBadge label={fb.label} />
                      </div>
                      <p className="text-xs text-foreground/80 leading-relaxed">
                        {fb.sanitizedText}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="border-t p-3">
          <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-muted/30 rounded-md p-2">
            <Info className="size-3 mt-0.5 shrink-0" />
            <span>
              Các mục này không ảnh hưởng tới đề xuất chỉnh sửa. Chúng được lưu
              lại cho mục đích truy vết.
            </span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function QuarantinedCard({ feedback }: { feedback: FeedbackItem }) {
  const cfg = LABEL_CONFIG[feedback.label] ?? LABEL_CONFIG["bo-qua"]!;
  const Icon = cfg.icon;

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="size-3.5 text-amber-500" />
          <Badge variant="outline" className="text-[9px] py-0 font-mono">
            {feedback.id}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {feedback.sender}
          </span>
        </div>
        <Badge variant="outline" className="text-[9px] py-0">
          {CHANNEL_LABEL[feedback.channel] ?? feedback.channel}
        </Badge>
      </div>

      {/* Sanitized text */}
      <p className="text-xs text-foreground/80 leading-relaxed bg-muted/20 rounded-md p-2">
        {feedback.sanitizedText}
      </p>

      {/* Label + reason */}
      <div className="flex items-center gap-2">
        <LabelBadge label={feedback.label} />
        {feedback.quarantineReason && (
          <span className="text-[9px] text-muted-foreground italic">
            {feedback.quarantineReason}
          </span>
        )}
      </div>
    </div>
  );
}

function LabelBadge({ label }: { label: string }) {
  const cfg = LABEL_CONFIG[label];
  if (!cfg) {
    return (
      <Badge variant="outline" className="text-[9px] py-0">
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={`text-[9px] py-0 ${cfg.color}`}>
      {cfg.label}
    </Badge>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <ShieldAlert className="size-8 opacity-20 mb-2" />
      <p className="text-xs">{text}</p>
    </div>
  );
}

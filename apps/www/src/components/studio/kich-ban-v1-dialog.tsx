"use client";

import { useState } from "react";
import {
  FileText,
  Clock,
  Volume2,
  Monitor,
  Image as ImageIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import kichBanData from "@/data/kich-ban-d1.json";

interface Props {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function KichBanV1Dialog({ trigger, open, onOpenChange }: Props) {
  const [selectedPhan, setSelectedPhan] = useState<number | null>(null);

  const script = kichBanData;
  const filteredCau = selectedPhan
    ? script.cau.filter((c) => c.phan === selectedPhan)
    : script.cau;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">
                Kịch bản gốc v1 · {script.tieuDe}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                40 câu · 5 phân đoạn · Thời lượng dự kiến ~
                {Math.round(script.thoiLuongDuKienGiay / 60)} phút 11 giây
              </DialogDescription>
            </div>
          </div>

          {/* Phân đoạn filter */}
          <div className="flex flex-wrap gap-1.5 pt-3">
            <Button
              size="sm"
              variant={selectedPhan === null ? "default" : "outline"}
              className="h-7 text-xs px-2.5"
              onClick={() => setSelectedPhan(null)}
            >
              Tất cả (40 câu)
            </Button>
            {script.phan.map((p) => (
              <Button
                key={p.so}
                size="sm"
                variant={selectedPhan === p.so ? "default" : "outline"}
                className="h-7 text-xs px-2.5"
                onClick={() => setSelectedPhan(p.so)}
              >
                Phần {p.so}: {p.ten}
              </Button>
            ))}
          </div>
        </DialogHeader>

        {/* Danh sách 40 câu */}
        <ScrollArea className="flex-1 p-6">
          <div className="space-y-4">
            {filteredCau.map((c) => {
              const isSilence = Boolean(c.dungGiay && !c.loi);

              return (
                <div
                  key={c.n}
                  className={`p-4 rounded-lg border text-sm transition-colors ${
                    isSilence
                      ? "bg-amber-500/5 border-amber-500/20"
                      : "bg-card border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold font-mono text-xs text-foreground">
                        Câu {c.n}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-normal py-0"
                      >
                        Phần {c.phan}
                      </Badge>
                    </div>
                    {isSilence && (
                      <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Khoảng lặng {c.dungGiay}s
                      </span>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    {/* Lời đọc */}
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                        <Volume2 className="h-3 w-3 text-primary" />
                        <span>Lời đọc:</span>
                      </div>
                      <p className="text-foreground pl-4 border-l-2 border-primary/30 leading-relaxed font-serif">
                        {c.loi
                          ? `"${c.loi}"`
                          : isSilence
                            ? "(Khoảng lặng dừng hình để người học tự suy nghĩ)"
                            : "—"}
                      </p>
                    </div>

                    {/* Chữ trên màn hình & Ý đồ hình ảnh */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs">
                      <div className="p-2.5 rounded bg-muted/40 border border-border/50">
                        <div className="flex items-center gap-1 text-muted-foreground font-medium mb-1">
                          <Monitor className="h-3 w-3" />
                          <span>Chữ trên màn hình:</span>
                        </div>
                        <p className="text-foreground font-mono text-[11px]">
                          {c.chuTrenManHinh || "—"}
                        </p>
                      </div>

                      <div className="p-2.5 rounded bg-muted/40 border border-border/50">
                        <div className="flex items-center gap-1 text-muted-foreground font-medium mb-1">
                          <ImageIcon className="h-3 w-3" />
                          <span>Ý đồ hình ảnh:</span>
                        </div>
                        <p className="text-muted-foreground leading-relaxed">
                          {c.yDoHinh || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

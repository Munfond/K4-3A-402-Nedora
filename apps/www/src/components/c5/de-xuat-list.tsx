"use client";

import { Check, Undo2, X } from "lucide-react";

import { NhanThayDoi } from "@/components/c5/nhan";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useQuyetDinh } from "@/hooks/use-quyet-dinh";
import type { Cau, DeXuat } from "@/lib/mock-data";

interface Props {
  deXuats: DeXuat[];
  cauTheoSo: Record<number, Pick<Cau, "n" | "loi" | "yDoHinh">>;
}

export default function DeXuatList({ deXuats, cauTheoSo }: Props) {
  const { dat, layQuyetDinh } = useQuyetDinh();

  if (deXuats.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
        Chưa có đề xuất sửa cho vấn đề này.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {deXuats.map((dx) => {
        const quyetDinhRec = layQuyetDinh(dx.id);
        const quyetDinhType = quyetDinhRec?.type || "cho-duyet";
        const cau = cauTheoSo[dx.cau];
        const truoc = dx.loaiThayDoi === "hinh" ? cau?.yDoHinh : cau?.loi;

        return (
          <Card key={dx.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-sm">Câu {dx.cau}</span>
                <NhanThayDoi loai={dx.loaiThayDoi as any} />
                <span className="font-mono text-muted-foreground text-xs">
                  {dx.id}
                </span>
                {quyetDinhType !== "cho-duyet" && (
                  <span
                    className={
                      quyetDinhType === "chon"
                        ? "ml-auto rounded-md bg-green-50 px-2 py-0.5 font-medium text-green-700 text-xs ring-1 ring-green-200 dark:bg-green-950 dark:text-green-300 dark:ring-green-900"
                        : "ml-auto rounded-md bg-neutral-100 px-2 py-0.5 font-medium text-neutral-600 text-xs ring-1 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-700"
                    }
                  >
                    {quyetDinhType === "chon" ? "Đã đồng ý" : "Đã bỏ"}
                  </span>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    Hiện tại
                  </p>
                  <p className="rounded-md bg-muted/50 p-2.5 text-sm text-typography-secondary dark:text-neutral-300">
                    {truoc ?? "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    Đề xuất
                  </p>
                  <p className="rounded-md bg-green-50/60 p-2.5 text-sm dark:bg-green-950/30">
                    {dx.deXuat}
                  </p>
                </div>
              </div>

              <p className="text-muted-foreground text-xs">
                <span className="font-medium">Lý do:</span> {dx.lyDo}
              </p>

              <div className="flex gap-2">
                {quyetDinhType === "cho-duyet" ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        dat(dx.id, {
                          type: "chon",
                          optionId: dx.id,
                          at: new Date().toISOString(),
                        })
                      }
                      className="gap-1.5"
                    >
                      <Check className="size-3.5" />
                      Đồng ý
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        dat(dx.id, {
                          type: "bo",
                          at: new Date().toISOString(),
                        })
                      }
                      className="gap-1.5"
                    >
                      <X className="size-3.5" />
                      Bỏ
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      dat(dx.id, {
                        type: "hoan",
                        at: new Date().toISOString(),
                      })
                    }
                    className="gap-1.5 text-muted-foreground"
                  >
                    <Undo2 className="size-3.5" />
                    Xét lại
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

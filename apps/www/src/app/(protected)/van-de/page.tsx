import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Users } from "lucide-react";

import { NhanLoaiVanDe, NhanNghiemTrong } from "@/components/c5/nhan";
import PageWrapper from "@/components/page-wrapper";
import { Card, CardContent } from "@/components/ui/card";
import { dinhDangPhut, getVanDeList } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "Vấn đề",
  description:
    "Danh sách vấn đề gom từ góp ý của người học, đã xếp ưu tiên và định vị về câu.",
};

export default function DanhSachVanDePage() {
  const vanDeList = getVanDeList();

  return (
    <PageWrapper className="flex flex-col overflow-hidden pb-12">
      <div className="mx-auto mt-10 w-full max-w-5xl shrink-0 px-4">
        <h1 className="font-bold text-3xl dark:text-neutral-50">Vấn đề</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Gom từ góp ý của người học, xếp theo mức ảnh hưởng và số người khác
          nhau nhắc tới.
        </p>
      </div>

      <div className="mx-auto mt-6 flex min-h-0 w-full max-w-5xl flex-1 flex-col px-4">
        <Card className="flex flex-1 flex-col overflow-y-auto p-0">
          <CardContent className="flex-1 divide-y overflow-y-auto p-0">
            {vanDeList.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm">
                Chưa có vấn đề nào.
              </div>
            ) : (
              vanDeList.map((vd) => (
                <Link
                  key={vd.id}
                  href={`/van-de/${vd.id}`}
                  className="flex flex-col gap-3 p-4 hover:bg-muted dark:hover:bg-sidebar-accent"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <NhanNghiemTrong muc={vd.mucNghiemTrong} />
                    <NhanLoaiVanDe loai={vd.loai} />
                    <span className="font-mono text-muted-foreground text-xs">
                      {vd.id}
                    </span>
                  </div>

                  <p className="font-medium text-sm dark:text-neutral-100">
                    {vd.moTa}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-muted-foreground text-xs">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="size-3.5" />
                      Câu {vd.cau.join(", ")} · {dinhDangPhut(vd.tuGiay)}–
                      {dinhDangPhut(vd.denGiay)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-3.5" />
                      {vd.soNguoiNhac} người
                      {vd.soLanNhac !== vd.soNguoiNhac &&
                        ` · ${vd.soLanNhac} lần nhắc`}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}

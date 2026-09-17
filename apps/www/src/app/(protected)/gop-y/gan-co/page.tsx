import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";

import GopYItem from "@/components/c5/gop-y-item";
import PageWrapper from "@/components/page-wrapper";
import { Card, CardContent } from "@/components/ui/card";
import { getGopYList, nhanCanhBao } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "Góp ý gắn cờ",
  description:
    "Góp ý bị giữ lại trước khi phân tích: cài lệnh ẩn và công kích cá nhân.",
};

export default function GanCoPage() {
  const ganCo = getGopYList().filter((g) => g.trangThai === "gan-co");

  const theoLoai = new Map<string, number>();
  for (const gy of ganCo) {
    if (gy.canhBao) {
      theoLoai.set(gy.canhBao, (theoLoai.get(gy.canhBao) ?? 0) + 1);
    }
  }

  return (
    <PageWrapper className="overflow-y-auto pb-16">
      <div className="mx-auto mt-10 w-full max-w-4xl space-y-6 px-4">
        <div>
          <h1 className="font-bold text-3xl dark:text-neutral-50">
            Góp ý gắn cờ
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Bị giữ lại trước khi đưa vào phân tích. Góp ý là dữ liệu để đọc,
            không phải lệnh để làm theo.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[...theoLoai.entries()].map(([loai, soLuong]) => (
            <span
              key={loai}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-1.5 font-medium text-red-700 text-xs ring-1 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-900"
            >
              <ShieldAlert className="size-3.5" />
              {nhanCanhBao[loai as keyof typeof nhanCanhBao]}: {soLuong}
            </span>
          ))}
        </div>

        {ganCo.length === 0 ? (
          <p className="rounded-lg border border-dashed p-12 text-center text-muted-foreground text-sm">
            Không có góp ý nào bị gắn cờ.
          </p>
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {ganCo.map((gy) => (
                <GopYItem key={gy.id} gopY={gy} />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import GopYItem from "@/components/c5/gop-y-item";
import PageWrapper from "@/components/page-wrapper";
import { Card, CardContent } from "@/components/ui/card";
import { getGopYList, getVanDeById } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "Góp ý gốc",
  description:
    "Toàn bộ góp ý đã nhận từ khảo sát, bình luận và tin nhắn, kèm trạng thái xử lý.",
};

export default function GopYPage() {
  const gopYList = getGopYList();

  const daGom = gopYList.filter((g) => g.trangThai === "da-gom");
  const chuaGom = gopYList.filter((g) => g.trangThai === "chua-gom");
  const ganCo = gopYList.filter((g) => g.trangThai === "gan-co");

  return (
    <PageWrapper className="overflow-y-auto pb-16">
      <div className="mx-auto mt-10 w-full max-w-4xl space-y-6 px-4">
        <div>
          <h1 className="font-bold text-3xl dark:text-neutral-50">Góp ý gốc</h1>
          <p className="mt-2 text-muted-foreground text-sm">
            {gopYList.length} góp ý đã nhận · {daGom.length} đã gom thành vấn đề
            · {chuaGom.length} chưa gom ·{" "}
            <Link href="/gop-y/gan-co" className="underline">
              {ganCo.length} gắn cờ
            </Link>
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="font-semibold text-sm uppercase tracking-wide">
            Đã gom thành vấn đề ({daGom.length})
          </h2>
          <Card>
            <CardContent className="divide-y p-0">
              {daGom.map((gy) => (
                <div key={gy.id}>
                  <GopYItem gopY={gy} />
                  {gy.vanDeId && (
                    <div className="px-4 pb-3">
                      <Link
                        href={`/van-de/${gy.vanDeId}`}
                        className="text-muted-foreground text-xs underline hover:text-foreground"
                      >
                        → {getVanDeById(gy.vanDeId)?.moTa ?? gy.vanDeId}
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-sm uppercase tracking-wide">
            Chưa gom thành vấn đề ({chuaGom.length})
          </h2>
          <p className="text-muted-foreground text-xs">
            Góp ý khen, góp ý mơ hồ không chỉ rõ chỗ nào, hoặc chưa đủ người
            nhắc để thành một vấn đề chung.
          </p>
          <Card>
            <CardContent className="divide-y p-0">
              {chuaGom.map((gy) => (
                <GopYItem key={gy.id} gopY={gy} />
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </PageWrapper>
  );
}

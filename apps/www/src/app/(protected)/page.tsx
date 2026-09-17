import {
  ArrowRight,
  Flag,
  GalleryVerticalEnd,
  MessagesSquare,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import PageWrapper from "@/components/page-wrapper";
import { Card, CardContent } from "@/components/ui/card";
import {
  getGopYList,
  getKichBan,
  getVanDeList,
  dinhDangPhut,
} from "@/lib/mock-data";

export default function TongQuanPage() {
  const kichBan = getKichBan();
  const vanDe = getVanDeList();
  const gopY = getGopYList();

  const soGanCo = gopY.filter((g) => g.trangThai === "gan-co").length;
  const soChuaGom = gopY.filter((g) => g.trangThai === "chua-gom").length;
  const thoiLuong = kichBan.cau[kichBan.cau.length - 1]?.ketThucGiay ?? 0;

  const thongKe: Array<{
    nhan: string;
    giaTri: number;
    icon: typeof GalleryVerticalEnd;
    href: Route;
  }> = [
    {
      nhan: "Vấn đề tìm được",
      giaTri: vanDe.length,
      icon: GalleryVerticalEnd,
      href: "/van-de",
    },
    {
      nhan: "Góp ý đã nhận",
      giaTri: gopY.length,
      icon: MessagesSquare,
      href: "/gop-y",
    },
    {
      nhan: "Góp ý gắn cờ",
      giaTri: soGanCo,
      icon: Flag,
      href: "/gop-y/gan-co",
    },
  ];

  return (
    <PageWrapper className="flex flex-col overflow-y-auto bg-sidebar pb-24 dark:bg-[#0a0a0a]">
      <div className="mx-auto mt-12 w-full max-w-4xl shrink-0 px-4 text-center">
        <p className="font-mono text-muted-foreground text-xs uppercase tracking-widest">
          {kichBan.id.toUpperCase()} · {kichBan.cau.length} câu ·{" "}
          {dinhDangPhut(thoiLuong)}
        </p>
        <h1 className="mt-3 text-balance font-bold text-4xl dark:text-gray-50 sm:text-5xl">
          {kichBan.tieuDe}
        </h1>
        <p className="mt-4 text-balance text-muted-foreground dark:text-gray-400">
          {gopY.length} góp ý từ khảo sát, bình luận và tin nhắn đã được gom
          thành {vanDe.length} vấn đề, mỗi vấn đề chỉ rõ nằm ở câu nào và phút
          thứ mấy.
        </p>
      </div>

      <div className="mx-auto mt-10 grid w-full max-w-4xl gap-3 px-4 sm:grid-cols-3">
        {thongKe.map((item) => (
          <Link key={item.nhan} href={item.href}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardContent className="flex items-center gap-3 p-4">
                <item.icon className="size-5 text-muted-foreground" />
                <div>
                  <p className="font-semibold text-2xl">{item.giaTri}</p>
                  <p className="text-muted-foreground text-xs">{item.nhan}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mx-auto mt-8 w-full max-w-4xl px-4">
        <Card>
          <CardContent className="space-y-3 p-5 text-sm">
            <p className="font-medium">Luồng duyệt</p>
            <ol className="ml-4 list-decimal space-y-1 text-muted-foreground">
              <li>
                Mở <span className="font-medium text-foreground">Vấn đề</span>,
                xem danh sách đã xếp ưu tiên.
              </li>
              <li>
                Vào một vấn đề: phát đúng đoạn video, đọc những góp ý gốc đã tạo
                ra nó.
              </li>
              <li>Đồng ý hoặc bỏ từng đề xuất sửa.</li>
              <li>
                Sang <span className="font-medium text-foreground">Xuất</span>{" "}
                để lấy kịch bản phiên bản mới và danh sách phải làm lại.
              </li>
            </ol>
            {soChuaGom > 0 && (
              <p className="text-muted-foreground text-xs">
                Còn {soChuaGom} góp ý chưa gom thành vấn đề — xem ở trang Góp ý
                gốc.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mx-auto mt-6 w-full max-w-4xl px-4">
        <Link
          href="/van-de"
          className="inline-flex items-center gap-2 font-medium text-sm hover:underline"
        >
          Xem danh sách vấn đề
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </PageWrapper>
  );
}

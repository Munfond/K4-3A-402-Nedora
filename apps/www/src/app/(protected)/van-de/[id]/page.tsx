import { Info, Users } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import DeXuatList from "@/components/c5/de-xuat-list";
import GopYItem from "@/components/c5/gop-y-item";
import { NhanLoaiVanDe, NhanNghiemTrong } from "@/components/c5/nhan";
import VideoDoan from "@/components/c5/video-doan";
import PageWrapper from "@/components/page-wrapper";
import { Card, CardContent } from "@/components/ui/card";
import {
  dinhDangPhut,
  getCau,
  getDeXuatTheoVanDe,
  getGopY,
  getPhanCuaCau,
  getVanDeById,
  getVanDeList,
  laLoiKyThuat,
} from "@/lib/mock-data";

export function generateStaticParams() {
  return getVanDeList().map((vd) => ({ id: vd.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const vanDe = getVanDeById(id);
  if (!vanDe) return { title: "Không tìm thấy vấn đề" };
  return { title: vanDe.moTa, description: vanDe.ghiChu };
}

export default async function ChiTietVanDePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vanDe = getVanDeById(id);

  if (!vanDe) {
    notFound();
  }

  const gopYList = getGopY(vanDe.gopYIds);
  const deXuats = getDeXuatTheoVanDe(vanDe.id);
  const cauLienQuan = vanDe.cau
    .map((n) => getCau(n))
    .filter((c): c is NonNullable<typeof c> => c != null);

  // Đề xuất có thể trỏ tới câu ngoài danh sách câu của vấn đề.
  const cauTheoSo: Record<
    number,
    { n: number; loi?: string; yDoHinh?: string }
  > = {};
  for (const n of new Set([...vanDe.cau, ...deXuats.map((d) => d.cau)])) {
    const c = getCau(n);
    if (c) cauTheoSo[n] = { n: c.n, loi: c.loi, yDoHinh: c.yDoHinh };
  }

  const phan = getPhanCuaCau(vanDe.cau[0]);

  return (
    <PageWrapper className="overflow-y-auto pb-24">
      <div className="mx-auto mt-10 w-full max-w-5xl space-y-6 px-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <NhanNghiemTrong muc={vanDe.mucNghiemTrong} />
            <NhanLoaiVanDe loai={vanDe.loai} />
            <span className="font-mono text-muted-foreground text-xs">
              {vanDe.id}
            </span>
          </div>
          <h1 className="text-balance font-bold text-2xl dark:text-neutral-50 sm:text-3xl">
            {vanDe.moTa}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-muted-foreground text-sm">
            <span>
              Câu {vanDe.cau.join(", ")} · {dinhDangPhut(vanDe.tuGiay)}–
              {dinhDangPhut(vanDe.denGiay)}
              {phan && ` · Phần ${phan.so}: ${phan.ten}`}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4" />
              {vanDe.soNguoiNhac} người khác nhau · {vanDe.soLanNhac} lần nhắc
            </span>
          </div>
          {laLoiKyThuat(vanDe.loai) && (
            <p className="rounded-md bg-sky-50 px-3 py-2 text-sky-800 text-sm dark:bg-sky-950/50 dark:text-sky-300">
              Lỗi kỹ thuật — chuyển đội kỹ thuật, không phải đội nội dung. Không
              phải thu lại giọng hay dựng lại cảnh.
            </p>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <section className="space-y-3">
              <h2 className="font-semibold text-sm uppercase tracking-wide">
                Đoạn video
              </h2>
              <VideoDoan tuGiay={vanDe.tuGiay} denGiay={vanDe.denGiay} />
            </section>

            <section className="space-y-3">
              <h2 className="font-semibold text-sm uppercase tracking-wide">
                Câu trong kịch bản
              </h2>
              <Card>
                <CardContent className="divide-y p-0">
                  {cauLienQuan.map((cau) => (
                    <div key={cau.n} className="space-y-1.5 p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">Câu {cau.n}</span>
                        <span className="text-muted-foreground text-xs">
                          {dinhDangPhut(cau.batDauGiay)}–
                          {dinhDangPhut(cau.ketThucGiay)}
                        </span>
                        {cau.loi && (
                          <span className="ml-auto text-muted-foreground text-xs">
                            {cau.soKyTu} ký tự
                          </span>
                        )}
                      </div>
                      {cau.loi ? (
                        <p className="text-sm text-typography-secondary dark:text-neutral-300">
                          {cau.loi}
                        </p>
                      ) : (
                        <p className="text-muted-foreground text-sm italic">
                          Khoảng lặng {cau.dungGiay} giây
                        </p>
                      )}
                      {cau.yDoHinh && (
                        <p className="text-muted-foreground text-xs">
                          <span className="font-medium">Ý đồ hình:</span>{" "}
                          {cau.yDoHinh}
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>
          </div>

          <div className="space-y-6">
            <section className="space-y-3">
              <h2 className="font-semibold text-sm uppercase tracking-wide">
                Góp ý gốc ({gopYList.length})
              </h2>
              <Card>
                <CardContent className="divide-y p-0">
                  {gopYList.map((gy) => (
                    <GopYItem key={gy.id} gopY={gy} />
                  ))}
                </CardContent>
              </Card>
              {vanDe.ghiChu && (
                <p className="flex gap-2 rounded-md bg-muted/50 px-3 py-2 text-muted-foreground text-xs">
                  <Info className="size-4 shrink-0" />
                  {vanDe.ghiChu}
                </p>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="font-semibold text-sm uppercase tracking-wide">
                Đề xuất sửa
              </h2>
              <DeXuatList deXuats={deXuats} cauTheoSo={cauTheoSo} />
            </section>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}

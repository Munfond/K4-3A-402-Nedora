"use client";

import { Download, Mic, RotateCcw, Clapperboard } from "lucide-react";
import Link from "next/link";

import { NhanLoaiThayDoi } from "@/components/c5/nhan";
import PageWrapper from "@/components/page-wrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useQuyetDinh } from "@/hooks/use-quyet-dinh";
import {
  getCau,
  getDeXuatList,
  getKichBan,
  getVanDeById,
  tinhPhamViLamLai,
} from "@/lib/mock-data";

export default function XuatPage() {
  const { layQuyetDinh, xoaHet } = useQuyetDinh();

  const tatCaDeXuat = getDeXuatList();
  const daDongY = tatCaDeXuat.filter(
    (dx) => layQuyetDinh(dx.id, dx.quyetDinh) === "dong-y",
  );
  const daBo = tatCaDeXuat.filter(
    (dx) => layQuyetDinh(dx.id, dx.quyetDinh) === "bo",
  );
  const choDuyet = tatCaDeXuat.filter(
    (dx) => layQuyetDinh(dx.id, dx.quyetDinh) === "cho-duyet",
  );

  const phamVi = tinhPhamViLamLai(daDongY);
  const tiLe =
    phamVi.tongKyTu > 0
      ? Math.round((phamVi.soKyTuThuLai / phamVi.tongKyTu) * 100)
      : 0;

  const taiKichBan = () => {
    const kichBan = getKichBan();
    const suaTheoCau = new Map<number, typeof daDongY>();
    for (const dx of daDongY) {
      suaTheoCau.set(dx.cau, [...(suaTheoCau.get(dx.cau) ?? []), dx]);
    }

    const ban2 = {
      schema: "hackathon-kich-ban/1",
      id: `${kichBan.id}-v2`,
      tieuDe: kichBan.tieuDe,
      mucTieu: kichBan.mucTieu,
      thoiLuongDuKienGiay: kichBan.thoiLuongDuKienGiay,
      phan: kichBan.phan,
      cau: kichBan.cau.map((c) => {
        const sua = suaTheoCau.get(c.n);
        return {
          n: c.n,
          phan: c.phan,
          ...(c.kieu ? { kieu: c.kieu } : {}),
          ...(c.loi ? { loi: c.loi } : {}),
          ...(c.dungGiay ? { dungGiay: c.dungGiay } : {}),
          ...(c.chuTrenManHinh ? { chuTrenManHinh: c.chuTrenManHinh } : {}),
          ...(c.yDoHinh ? { yDoHinh: c.yDoHinh } : {}),
          // Trường riêng của đội: chỉ dẫn sửa đã được duyệt cho câu này.
          ...(sua
            ? {
                deXuatDaDuyet: sua.map((dx) => ({
                  id: dx.id,
                  loaiThayDoi: dx.loaiThayDoi,
                  deXuat: dx.deXuat,
                })),
              }
            : {}),
          ...(phamVi.cauThuLaiGiong.includes(c.n)
            ? { canThuLaiGiong: true }
            : {}),
          ...(phamVi.canhDungLai.includes(c.n) ? { canDungLaiCanh: true } : {}),
        };
      }),
      phamViLamLai: {
        cauThuLaiGiong: phamVi.cauThuLaiGiong,
        canhDungLai: phamVi.canhDungLai,
        soKyTuThuLai: phamVi.soKyTuThuLai,
        tongKyTu: phamVi.tongKyTu,
      },
    };

    const blob = new Blob([JSON.stringify(ban2, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kich-ban-${kichBan.id}-v2.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageWrapper className="overflow-y-auto pb-16">
      <div className="mx-auto mt-10 w-full max-w-4xl space-y-6 px-4">
        <div>
          <h1 className="font-bold text-3xl dark:text-neutral-50">
            Xuất kịch bản
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">
            {daDongY.length} đề xuất đã đồng ý · {daBo.length} đã bỏ ·{" "}
            {choDuyet.length} chờ duyệt
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Mic className="size-5 text-muted-foreground" />
              <div>
                <p className="font-semibold text-2xl">
                  {phamVi.cauThuLaiGiong.length}
                </p>
                <p className="text-muted-foreground text-xs">
                  câu phải thu lại giọng
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Clapperboard className="size-5 text-muted-foreground" />
              <div>
                <p className="font-semibold text-2xl">
                  {phamVi.canhDungLai.length}
                </p>
                <p className="text-muted-foreground text-xs">
                  cảnh phải dựng lại
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div>
                <p className="font-semibold text-2xl">{tiLe}%</p>
                <p className="text-muted-foreground text-xs">
                  {phamVi.soKyTuThuLai} / {phamVi.tongKyTu} ký tự thu lại
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {daDongY.length > 0 && (
          <p className="rounded-md bg-muted/50 px-3 py-2 text-muted-foreground text-xs">
            Câu phải thu lại: {phamVi.cauThuLaiGiong.join(", ")} — đổi lời câu N
            kéo theo thu lại cả câu N−1 và N+1, vì máy đọc lấy câu trước và câu
            sau làm ngữ cảnh. Thay vì làm lại toàn bộ {phamVi.tongCanh} cảnh và{" "}
            {phamVi.tongKyTu} ký tự.
          </p>
        )}

        <section className="space-y-3">
          <h2 className="font-semibold text-sm uppercase tracking-wide">
            Đề xuất đã đồng ý ({daDongY.length})
          </h2>
          {daDongY.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
              Chưa đồng ý đề xuất nào. Vào{" "}
              <Link href="/van-de" className="underline">
                danh sách vấn đề
              </Link>{" "}
              để duyệt.
            </p>
          ) : (
            <Card>
              <CardContent className="divide-y p-0">
                {daDongY.map((dx) => {
                  const cau = getCau(dx.cau);
                  return (
                    <div key={dx.id} className="space-y-2 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-sm">
                          Câu {dx.cau}
                        </span>
                        <NhanLoaiThayDoi loai={dx.loaiThayDoi} />
                        {dx.vanDeIds.map((vid) => (
                          <Link
                            key={vid}
                            href={`/van-de/${vid}`}
                            className="font-mono text-muted-foreground text-xs underline"
                          >
                            {vid}
                          </Link>
                        ))}
                      </div>
                      <p className="text-sm text-typography-secondary dark:text-neutral-300">
                        {dx.deXuat}
                      </p>
                      {cau?.loi && (
                        <p className="text-muted-foreground text-xs">
                          Lời hiện tại: {cau.loi}
                        </p>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </section>

        {daBo.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide">
              Đã bỏ ({daBo.length})
            </h2>
            <Card>
              <CardContent className="divide-y p-0">
                {daBo.map((dx) => (
                  <div
                    key={dx.id}
                    className="flex flex-wrap items-center gap-2 p-3"
                  >
                    <span className="text-muted-foreground text-sm">
                      Câu {dx.cau} — {dx.deXuat}
                    </span>
                    {dx.vanDeIds[0] && (
                      <span className="text-muted-foreground text-xs">
                        ({getVanDeById(dx.vanDeIds[0])?.id})
                      </span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={taiKichBan}
            disabled={daDongY.length === 0}
            className="gap-2"
          >
            <Download className="size-4" />
            Tải kịch bản v2
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={xoaHet}
            className="gap-2 text-muted-foreground"
          >
            <RotateCcw className="size-4" />
            Xoá mọi quyết định
          </Button>
        </div>
      </div>
    </PageWrapper>
  );
}

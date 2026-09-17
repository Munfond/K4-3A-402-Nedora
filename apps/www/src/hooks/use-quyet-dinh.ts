"use client";

import { useCallback, useEffect, useState } from "react";

import type { QuyetDinh } from "@/lib/mock-data";

const KHOA = "c5-quyet-dinh";

type BangQuyetDinh = Record<string, QuyetDinh>;

function doc(): BangQuyetDinh {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KHOA);
    return raw ? (JSON.parse(raw) as BangQuyetDinh) : {};
  } catch {
    return {};
  }
}

/** Sự kiện riêng để các component trên cùng một tab cùng cập nhật. */
const SU_KIEN = "c5-quyet-dinh-doi";

/**
 * Quyết định duyệt của đội sản xuất. Bản mock không có database nên giữ ở
 * localStorage — đủ để đi hết luồng duyệt rồi xuất kịch bản.
 */
export function useQuyetDinh() {
  const [bang, setBang] = useState<BangQuyetDinh>({});

  useEffect(() => {
    setBang(doc());

    const dongBo = () => setBang(doc());
    window.addEventListener(SU_KIEN, dongBo);
    window.addEventListener("storage", dongBo);
    return () => {
      window.removeEventListener(SU_KIEN, dongBo);
      window.removeEventListener("storage", dongBo);
    };
  }, []);

  const dat = useCallback((deXuatId: string, quyetDinh: QuyetDinh) => {
    const moi = { ...doc(), [deXuatId]: quyetDinh };
    try {
      window.localStorage.setItem(KHOA, JSON.stringify(moi));
    } catch {
      // Chế độ riêng tư chặn localStorage — vẫn cập nhật trong bộ nhớ.
    }
    window.dispatchEvent(new Event(SU_KIEN));
  }, []);

  const xoaHet = useCallback(() => {
    try {
      window.localStorage.removeItem(KHOA);
    } catch {
      // bỏ qua
    }
    window.dispatchEvent(new Event(SU_KIEN));
  }, []);

  const layQuyetDinh = useCallback(
    (deXuatId: string, macDinh: QuyetDinh): QuyetDinh =>
      bang[deXuatId] ?? macDinh,
    [bang],
  );

  return { bang, dat, xoaHet, layQuyetDinh };
}

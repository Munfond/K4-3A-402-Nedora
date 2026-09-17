"use client";

import { useCallback, useEffect, useState } from "react";
import type { DecisionRecord, DecisionType } from "@/lib/revision/types";

const LAST_RUN_KEY = "revision:lastRunId";

function getDecisionStorageKey(runId: string): string {
  return `revision:decisions:${runId}`;
}

type BangQuyetDinh = Record<string, DecisionRecord>;

function doc(key: string): BangQuyetDinh {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as BangQuyetDinh) : {};
  } catch {
    return {};
  }
}

export function getLastRunId(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(LAST_RUN_KEY) || "";
  } catch {
    return "";
  }
}

export function setLastRunId(runId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_RUN_KEY, runId);
    window.dispatchEvent(
      new CustomEvent("revision:run-changed", { detail: runId }),
    );
  } catch {
    // bỏ qua
  }
}

export function useQuyetDinh(explicitRunId?: string) {
  const [activeRunId, setActiveRunId] = useState<string>(explicitRunId || "");
  const [bang, setBang] = useState<BangQuyetDinh>({});
  const [isStorageFailed, setIsStorageFailed] = useState<boolean>(false);

  // Lấy runId hiện tại nếu không truyền trực tiếp
  useEffect(() => {
    if (explicitRunId) {
      setActiveRunId(explicitRunId);
    } else {
      const last = getLastRunId();
      if (last) setActiveRunId(last);
    }

    const onRunChanged = (e: Event) => {
      const ce = e as CustomEvent<string>;
      if (!explicitRunId && ce.detail) {
        setActiveRunId(ce.detail);
      }
    };
    window.addEventListener("revision:run-changed", onRunChanged);
    return () =>
      window.removeEventListener("revision:run-changed", onRunChanged);
  }, [explicitRunId]);

  const storageKey = activeRunId ? getDecisionStorageKey(activeRunId) : "";
  const eventName = activeRunId
    ? `revision:decisions-changed:${activeRunId}`
    : "";

  // Tải dữ liệu ban đầu
  useEffect(() => {
    if (!storageKey) return;
    setBang(doc(storageKey));

    const dongBo = () => {
      setBang(doc(storageKey));
    };

    window.addEventListener(eventName, dongBo);
    window.addEventListener("storage", dongBo);
    return () => {
      window.removeEventListener(eventName, dongBo);
      window.removeEventListener("storage", dongBo);
    };
  }, [storageKey, eventName]);

  // C3-STO-03: Sửa nhánh lưu thất bại để vẫn cập nhật bộ nhớ và báo chưa lưu
  const dat = useCallback(
    (caseId: string, quyetDinh: DecisionRecord) => {
      setBang((prev) => {
        const moi = { ...prev, [caseId]: quyetDinh };
        if (storageKey) {
          try {
            window.localStorage.setItem(storageKey, JSON.stringify(moi));
            setIsStorageFailed(false);
          } catch {
            // Chế độ riêng tư chặn localStorage — vẫn giữ trong state và báo lỗi
            setIsStorageFailed(true);
          }
        }
        return moi;
      });

      if (eventName) {
        window.dispatchEvent(new Event(eventName));
      }
    },
    [storageKey, eventName],
  );

  const xoaHet = useCallback(() => {
    setBang({});
    if (storageKey) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // bỏ qua
      }
    }
    if (eventName) {
      window.dispatchEvent(new Event(eventName));
    }
  }, [storageKey, eventName]);

  const layQuyetDinh = useCallback(
    (caseId: string): DecisionRecord | undefined => {
      return bang[caseId];
    },
    [bang],
  );

  return {
    runId: activeRunId,
    setRunId: setActiveRunId,
    bang,
    dat,
    xoaHet,
    layQuyetDinh,
    isStorageFailed,
  };
}

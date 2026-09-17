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

/**
 * `scope` = "<videoId>:<versionId>" để mỗi video nhớ run riêng (C3-STO-03).
 * Không truyền scope thì dùng khóa chung cũ (các trang /van-de, /xuat, /lich-su).
 */
function lastRunKey(scope?: string): string {
  return scope ? `${LAST_RUN_KEY}:${scope}` : LAST_RUN_KEY;
}

export function getLastRunId(scope?: string): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(lastRunKey(scope)) || "";
  } catch {
    return "";
  }
}

export function setLastRunId(runId: string, scope?: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(lastRunKey(scope), runId);
    window.dispatchEvent(
      new CustomEvent("revision:run-changed", { detail: runId }),
    );
  } catch {
    // bỏ qua
  }
}

/**
 * `scoped: true` (trang video): chỉ dùng đúng runId truyền vào, không rơi về
 * run cuối cùng của video khác khi chưa có run.
 */
export function useQuyetDinh(
  explicitRunId?: string,
  options: { scoped?: boolean } = {},
) {
  const scoped = options.scoped ?? false;
  const [activeRunId, setActiveRunId] = useState<string>(explicitRunId || "");
  const [bang, setBang] = useState<BangQuyetDinh>({});
  const [isStorageFailed, setIsStorageFailed] = useState<boolean>(false);

  // Lấy runId hiện tại nếu không truyền trực tiếp
  useEffect(() => {
    if (explicitRunId || scoped) {
      setActiveRunId(explicitRunId || "");
    } else {
      const last = getLastRunId();
      if (last) setActiveRunId(last);
    }

    const onRunChanged = (e: Event) => {
      const ce = e as CustomEvent<string>;
      if (!explicitRunId && !scoped && ce.detail) {
        setActiveRunId(ce.detail);
      }
    };
    window.addEventListener("revision:run-changed", onRunChanged);
    return () =>
      window.removeEventListener("revision:run-changed", onRunChanged);
  }, [explicitRunId, scoped]);

  const storageKey = activeRunId ? getDecisionStorageKey(activeRunId) : "";
  const eventName = activeRunId
    ? `revision:decisions-changed:${activeRunId}`
    : "";

  // Tải dữ liệu ban đầu
  useEffect(() => {
    if (!storageKey) {
      setBang({});
      return;
    }
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

  const xoa = useCallback(
    (caseId: string) => {
      setBang((prev) => {
        const moi = { ...prev };
        delete moi[caseId];
        if (storageKey) {
          try {
            window.localStorage.setItem(storageKey, JSON.stringify(moi));
            setIsStorageFailed(false);
          } catch {
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
    xoa,
    xoaHet,
    layQuyetDinh,
    isStorageFailed,
  };
}

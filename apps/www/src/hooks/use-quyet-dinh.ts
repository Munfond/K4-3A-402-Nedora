"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DecisionRecord,
  ReleaseSnapshot,
} from "@feedback/revision-core/types";
import { revisionClient } from "@/lib/revision-client";

const LAST_RUN_KEY = "revision:lastRunId";

function getDecisionStorageKey(runId: string): string {
  return `revision:decisions:draft:${runId}`;
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
    // ignore
  }
}

export function useQuyetDinh(
  explicitRunId?: string,
  options: { scoped?: boolean } = {},
) {
  const scoped = options.scoped ?? false;
  const [activeRunId, setActiveRunId] = useState<string>(explicitRunId || "");
  const [bang, setBang] = useState<BangQuyetDinh>({});
  const [serverVersion, setServerVersion] = useState<number>(0);
  const serverVersionRef = useRef<number>(0);
  serverVersionRef.current = serverVersion;

  const [isSavedToServer, setIsSavedToServer] = useState<boolean>(true);
  const [hasConflict, setHasConflict] = useState<boolean>(false);
  const [isStorageFailed, setIsStorageFailed] = useState<boolean>(false);
  const [isLoadingServer, setIsLoadingServer] = useState<boolean>(false);
  // Gói bản sửa do server tính từ quyết định đã lưu (nguồn có thẩm quyền).
  const [serverSnapshot, setServerSnapshot] = useState<ReleaseSnapshot | null>(
    null,
  );

  // Sync runId
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

  // Refresh decisions from server
  const refreshFromServer = useCallback(
    async (runIdToFetch?: string) => {
      const id = runIdToFetch || activeRunId;
      if (!id) {
        setBang({});
        setServerSnapshot(null);
        setServerVersion(0);
        serverVersionRef.current = 0;
        return;
      }

      setIsLoadingServer(true);
      try {
        const res = await revisionClient.getDecisionsAndRelease(id);
        if (res && res.decisions) {
          setBang(res.decisions);
          setServerSnapshot(res.snapshot ?? null);
          setServerVersion(res.version);
          serverVersionRef.current = res.version;
          setIsSavedToServer(true);
          setHasConflict(false);
        }
      } catch {
        // If server unavailable, fallback to local draft
        const draft = storageKey ? doc(storageKey) : {};
        if (Object.keys(draft).length > 0) {
          setBang(draft);
          setIsSavedToServer(false);
        }
      } finally {
        setIsLoadingServer(false);
      }
    },
    [activeRunId, storageKey],
  );

  useEffect(() => {
    void refreshFromServer();
  }, [refreshFromServer]);

  // Set a decision
  const dat = useCallback(
    async (caseId: string, quyetDinh: DecisionRecord) => {
      // Optimistic update
      setBang((prev) => ({ ...prev, [caseId]: quyetDinh }));

      if (!activeRunId) return;

      try {
        const res = await revisionClient.saveDecision(activeRunId, caseId, {
          type: quyetDinh.type,
          optionId: quyetDinh.optionId,
          reason: quyetDinh.reason,
          expectedVersion: serverVersionRef.current,
        });

        setServerVersion(res.version);
        serverVersionRef.current = res.version;
        setBang(res.decisions);
        setServerSnapshot(res.snapshot ?? null);
        setIsSavedToServer(true);
        setHasConflict(false);

        if (storageKey) {
          try {
            window.localStorage.removeItem(storageKey);
          } catch {}
        }
      } catch (err: any) {
        if (err?.statusCode === 409 || err?.code === "VERSION_CONFLICT") {
          setHasConflict(true);
          const conflictData = err?.data;
          if (conflictData?.state) {
            setServerVersion(conflictData.currentVersion);
            serverVersionRef.current = conflictData.currentVersion;
            setBang(conflictData.state.decisions);
          }
          // Lấy lại gói bản sửa khớp quyết định mới nhất của server.
          void refreshFromServer();
        } else {
          // Server offline / network error: keep local draft
          setIsSavedToServer(false);
          if (storageKey) {
            try {
              window.localStorage.setItem(
                storageKey,
                JSON.stringify({ ...bang, [caseId]: quyetDinh }),
              );
              setIsStorageFailed(false);
            } catch {
              setIsStorageFailed(true);
            }
          }
        }
      }

      if (eventName) {
        window.dispatchEvent(new Event(eventName));
      }
    },
    [activeRunId, bang, storageKey, eventName, refreshFromServer],
  );

  const xoa = useCallback(
    async (caseId: string) => {
      setBang((prev) => {
        const moi = { ...prev };
        delete moi[caseId];
        return moi;
      });

      if (!activeRunId) return;

      try {
        const res = await revisionClient.saveDecision(activeRunId, caseId, {
          type: "bo",
          expectedVersion: serverVersionRef.current,
        });

        setServerVersion(res.version);
        serverVersionRef.current = res.version;
        setBang(res.decisions);
        setServerSnapshot(res.snapshot ?? null);
        setIsSavedToServer(true);
        setHasConflict(false);
      } catch (err: any) {
        if (err?.statusCode === 409 || err?.code === "VERSION_CONFLICT") {
          setHasConflict(true);
        } else {
          setIsSavedToServer(false);
        }
      }

      if (eventName) {
        window.dispatchEvent(new Event(eventName));
      }
    },
    [activeRunId, eventName],
  );

  const xoaHet = useCallback(() => {
    setBang({});
    if (storageKey) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {}
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
    isSavedToServer,
    hasConflict,
    serverVersion,
    isLoadingServer,
    refreshFromServer,
    serverSnapshot,
  };
}

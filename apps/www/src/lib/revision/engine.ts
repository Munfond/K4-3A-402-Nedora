import type {
  ConflictItem,
  DecisionCase,
  DecisionRecord,
  PatchItem,
  ReleaseSnapshot,
  RevisionOption,
  ScriptData,
  SentenceData,
  WorkItem,
  WorkKind,
  WorkSummary,
} from "./types";
import { normalizeUnicodeNfc } from "./sanitize";

export function computeOptionStandaloneWork(
  option: RevisionOption,
  caseId: string,
  script: ScriptData,
): WorkSummary {
  const dummyDecisions: Record<string, DecisionRecord> = {
    [caseId]: {
      type: "chon",
      optionId: option.id,
      at: new Date().toISOString(),
    },
  };
  const snapshot = computeReleaseSnapshot({
    runId: "preview",
    inputHash: "",
    script,
    cases: [
      {
        id: caseId,
        type: "vung",
        title: "",
        issueIds: [],
        sentenceNs: [],
        tuGiay: 0,
        denGiay: 0,
        issues: [],
        options: [option],
        hasDisagreement: false,
        independentSenders: 1,
        mentions: 1,
        flags: [],
      },
    ],
    decisions: dummyDecisions,
  });
  return snapshot.summary;
}

export function computeReleaseSnapshot(params: {
  runId: string;
  inputHash: string;
  script: ScriptData;
  cases: DecisionCase[];
  decisions: Record<string, DecisionRecord>;
}): ReleaseSnapshot {
  const { runId, inputHash, script, cases, decisions } = params;

  const caseMap = new Map<string, DecisionCase>();
  const optionMap = new Map<
    string,
    { option: RevisionOption; caseId: string }
  >();

  for (const c of cases) {
    caseMap.set(c.id, c);
    for (const opt of c.options) {
      optionMap.set(opt.id, { option: opt, caseId: c.id });
    }
  }

  // 1. Thu thập các phương án được chọn
  const selectedOptions: Array<{
    option: RevisionOption;
    caseId: string;
    decision: DecisionRecord;
  }> = [];

  for (const [caseId, dec] of Object.entries(decisions)) {
    if (dec && dec.type === "chon" && dec.optionId) {
      const found = optionMap.get(dec.optionId);
      if (found && found.option.status === "hop-le") {
        selectedOptions.push({
          option: found.option,
          caseId,
          decision: dec,
        });
      }
    }
  }

  // 2. Phát hiện xung đột cứng C3-ENG-03 (CONFLICT_SAME_FIELD)
  // Hai phương án khác hồ sơ ghi cùng (n, field) với giá trị khác nhau
  const patchByTarget = new Map<
    string,
    Array<{
      optionId: string;
      caseId: string;
      value: string;
    }>
  >();

  for (const item of selectedOptions) {
    for (const p of item.option.patches) {
      const key = `${p.n}:${p.field}`;
      const list = patchByTarget.get(key) || [];
      list.push({
        optionId: item.option.id,
        caseId: item.caseId,
        value: p.after.trim(),
      });
      patchByTarget.set(key, list);
    }
  }

  const conflicts: ConflictItem[] = [];
  const blockedOptionIdSet = new Set<string>();

  for (const [key, entries] of patchByTarget.entries()) {
    if (entries.length > 1) {
      // Kiểm tra xem có giá trị nào khác nhau không
      const firstVal = entries[0].value;
      const hasDifferentVal = entries.some((e) => e.value !== firstVal);
      if (hasDifferentVal) {
        const [nStr, field] = key.split(":");
        const n = parseInt(nStr, 10);
        const blockedIds = entries.map((e) => e.optionId);
        for (const id of blockedIds) {
          blockedOptionIdSet.add(id);
        }
        conflicts.push({
          type: "CONFLICT_SAME_FIELD",
          n,
          field,
          values: entries,
          blockedOptionIds: blockedIds,
        });
      }
    }
  }

  const blockedOptionIds = Array.from(blockedOptionIdSet);
  const appliedOptionIds: string[] = [];

  // 3. Áp dụng các phương án không bị xung đột lên bản sao kịch bản
  const draftSentences: SentenceData[] = script.cau.map((c) => ({ ...c }));
  const draftSentenceMap = new Map<number, SentenceData>();
  for (const s of draftSentences) {
    draftSentenceMap.set(s.n, s);
  }

  // Ghi nhận nguồn gốc thay đổi của từng câu để truy vết
  const patchOrigins = new Map<
    string,
    Array<{ optionId: string; caseId: string }>
  >();

  for (const item of selectedOptions) {
    if (blockedOptionIdSet.has(item.option.id)) {
      continue; // Bị chặn do xung đột
    }
    appliedOptionIds.push(item.option.id);

    for (const p of item.option.patches) {
      const target = draftSentenceMap.get(p.n);
      if (target) {
        if (p.field === "loi") {
          target.loi = normalizeUnicodeNfc(p.after);
          target.soKyTu = Array.from(target.loi).length;
        } else if (p.field === "chuTrenManHinh") {
          target.chuTrenManHinh = normalizeUnicodeNfc(p.after);
        } else if (p.field === "yDoHinh") {
          target.yDoHinh = normalizeUnicodeNfc(p.after);
        }

        const key = `${p.n}:${p.field}`;
        const origins = patchOrigins.get(key) || [];
        origins.push({ optionId: item.option.id, caseId: item.caseId });
        patchOrigins.set(key, origins);
      }
    }
  }

  // 4. Tính toán danh sách công việc (C3-ENG-04) bằng cách so sánh bản gốc với bản nháp
  const originalMap = new Map<number, SentenceData>(
    script.cau.map((c) => [c.n, c]),
  );

  const rawWorkItems: WorkItem[] = [];

  for (const draft of draftSentences) {
    const orig = originalMap.get(draft.n);
    if (!orig) continue;

    const loiChanged = (draft.loi || "").trim() !== (orig.loi || "").trim();
    const chuChanged =
      (draft.chuTrenManHinh || "").trim() !==
      (orig.chuTrenManHinh || "").trim();
    const yDoChanged =
      (draft.yDoHinh || "").trim() !== (orig.yDoHinh || "").trim();

    if (loiChanged) {
      const origins = patchOrigins.get(`${draft.n}:loi`) || [];
      const primaryReason =
        origins.length > 0
          ? origins.map((o) => ({
              text: `Đổi lời câu ${draft.n}`,
              optionId: o.optionId,
              caseId: o.caseId,
            }))
          : [{ text: `Đổi lời câu ${draft.n}` }];

      // a. Thu lại câu đó
      rawWorkItems.push({
        key: `thu-lai:${draft.n}`,
        kind: "thu-lai",
        n: draft.n,
        reasons: primaryReason,
        newContent: draft.loi,
        charCount: draft.soKyTu,
      });

      // b. Sửa phụ đề câu đó
      rawWorkItems.push({
        key: `sua-phu-de:${draft.n}`,
        kind: "sua-phu-de",
        n: draft.n,
        reasons: primaryReason,
        newContent: draft.loi,
      });

      // c. Dựng lại cảnh câu đó
      rawWorkItems.push({
        key: `dung-canh:${draft.n}`,
        kind: "dung-canh",
        n: draft.n,
        reasons: primaryReason,
      });

      // d. Mở rộng ngữ cảnh ±1 câu (n-1 và n+1)
      const prevN = draft.n - 1;
      const nextN = draft.n + 1;

      for (const neighborN of [prevN, nextN]) {
        const neighbor = draftSentenceMap.get(neighborN);
        if (neighbor) {
          if (neighbor.dungGiay && !neighbor.loi) {
            // Là câu khoảng lặng dừng giây -> không thu lại, cảnh báo CTX_ACROSS_SILENCE_UNKNOWN
            continue;
          }
          if (neighbor.loi) {
            const contextReason = origins.map((o) => ({
              text: `Thu lại vì lời câu ${draft.n} đổi`,
              optionId: o.optionId,
              caseId: o.caseId,
            }));
            rawWorkItems.push({
              key: `thu-lai:${neighborN}`,
              kind: "thu-lai",
              n: neighborN,
              reasons:
                contextReason.length > 0
                  ? contextReason
                  : [{ text: `Thu lại vì lời câu ${draft.n} đổi` }],
              newContent: neighbor.loi,
              charCount: neighbor.soKyTu,
            });

            rawWorkItems.push({
              key: `dung-canh:${neighborN}`,
              kind: "dung-canh",
              n: neighborN,
              reasons:
                contextReason.length > 0
                  ? contextReason
                  : [{ text: `Thu lại vì lời câu ${draft.n} đổi` }],
            });
          }
        }
      }
    }

    if (chuChanged || yDoChanged) {
      const fieldKey = chuChanged ? "chuTrenManHinh" : "yDoHinh";
      const origins = patchOrigins.get(`${draft.n}:${fieldKey}`) || [];
      const reasonText = chuChanged
        ? `Đổi chữ màn hình câu ${draft.n}`
        : `Đổi ý đồ hình câu ${draft.n}`;
      const fieldReasons =
        origins.length > 0
          ? origins.map((o) => ({
              text: reasonText,
              optionId: o.optionId,
              caseId: o.caseId,
            }))
          : [{ text: reasonText }];

      rawWorkItems.push({
        key: `dung-canh:${draft.n}`,
        kind: "dung-canh",
        n: draft.n,
        reasons: fieldReasons,
      });

      rawWorkItems.push({
        key: `xem-lai-video:${draft.n}`,
        kind: "xem-lai-video",
        n: draft.n,
        reasons: fieldReasons,
      });
    }
  }

  // 5. Hợp nhất danh sách việc theo key `kind:n` (C3-ENG-05)
  const mergedWorkMap = new Map<string, WorkItem>();
  for (const item of rawWorkItems) {
    const existing = mergedWorkMap.get(item.key);
    if (existing) {
      // Gộp reasons, tránh trùng lặp exact
      for (const r of item.reasons) {
        if (
          !existing.reasons.some(
            (er) => er.text === r.text && er.optionId === r.optionId,
          )
        ) {
          existing.reasons.push(r);
        }
      }
    } else {
      mergedWorkMap.set(item.key, {
        ...item,
        reasons: [...item.reasons],
      });
    }
  }

  const workItems = Array.from(mergedWorkMap.values()).sort(
    (a, b) => a.n - b.n || a.kind.localeCompare(b.kind),
  );

  // 6. Tính toán các con số tổng hợp (C3-ENG-06)
  const cauThuLai = Array.from(
    new Set(workItems.filter((w) => w.kind === "thu-lai").map((w) => w.n)),
  ).sort((a, b) => a - b);

  const canhDungLai = Array.from(
    new Set(workItems.filter((w) => w.kind === "dung-canh").map((w) => w.n)),
  ).sort((a, b) => a - b);

  const phuDeSua = Array.from(
    new Set(workItems.filter((w) => w.kind === "sua-phu-de").map((w) => w.n)),
  ).sort((a, b) => a - b);

  const xemLaiVideo = Array.from(
    new Set(
      workItems.filter((w) => w.kind === "xem-lai-video").map((w) => w.n),
    ),
  ).sort((a, b) => a - b);

  // Ký tự thu lại = tổng code point NFC của lời trên BẢN NHÁP của các câu thu lại
  let soKyTuThuLai = 0;
  for (const n of cauThuLai) {
    const s = draftSentenceMap.get(n);
    if (s && s.loi) {
      soKyTuThuLai += Array.from(normalizeUnicodeNfc(s.loi)).length;
    }
  }

  const tongKyTuGoc = script.cau.reduce((sum, c) => sum + (c.soKyTu || 0), 0);

  const summary: WorkSummary = {
    cauThuLai,
    soKyTuThuLai,
    tongKyTuGoc,
    canhDungLai,
    tongCanh: script.cau.length,
    phuDeSua,
    xemLaiVideo,
  };

  // 7. Danh sách các hồ sơ chưa xử lý (hoãn, bỏ, chờ duyệt)
  const unresolvedCases: Array<{
    caseId: string;
    title: string;
    reason: string;
  }> = [];

  for (const c of cases) {
    const dec = decisions[c.id];
    if (!dec || !dec.type) {
      unresolvedCases.push({
        caseId: c.id,
        title: c.title,
        reason: "Chờ duyệt",
      });
    } else if (dec.type === "hoan") {
      unresolvedCases.push({
        caseId: c.id,
        title: c.title,
        reason: `Hoãn: ${dec.reason || "Chưa có lý do"}`,
      });
    } else if (dec.type === "bo") {
      unresolvedCases.push({
        caseId: c.id,
        title: c.title,
        reason: `Bỏ: ${dec.reason || "Chưa có lý do"}`,
      });
    }
  }

  return {
    runId,
    inputHash,
    decisions,
    appliedOptionIds,
    blockedOptionIds,
    conflicts,
    workItems,
    summary,
    draftSentences,
    unresolvedCases,
  };
}

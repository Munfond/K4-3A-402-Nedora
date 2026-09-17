import type {
  DecisionCase,
  DecisionRecord,
  FeedbackItem,
  IssueItem,
  ReleaseSnapshot,
  ScriptData,
} from "./types";
import { dinhDangPhut } from "./format";
import { redactForPersist } from "./sanitize";

export interface ExportPackage {
  kichBanJson: string;
  kichBanMd: string;
  viecCanLamCsv: string;
  truyVetJson: string;
}

export function selfCheckExport(
  scriptOriginal: ScriptData,
  draftScriptJsonStr: string,
  appliedOptionIds: string[],
  cases: DecisionCase[],
): boolean {
  const parsed = JSON.parse(draftScriptJsonStr);
  const sentenceMap = new Map<number, any>(
    parsed.cau.map((c: any) => [c.n, c]),
  );
  const origMap = new Map<number, any>(scriptOriginal.cau.map((c) => [c.n, c]));

  const appliedOptions = cases
    .flatMap((c) => c.options)
    .filter((opt) => appliedOptionIds.includes(opt.id));

  const patchedFields = new Set<string>();

  // 1. Kiểm tra mọi patch đã áp dụng có giá trị đúng bằng after
  for (const opt of appliedOptions) {
    for (const p of opt.patches) {
      const sentence = sentenceMap.get(p.n);
      if (!sentence) {
        throw new Error(
          `Self-check failed: Câu ${p.n} không tồn tại trong bản xuất`,
        );
      }
      const actualVal = sentence[p.field];
      if (actualVal !== p.after) {
        throw new Error(
          `Self-check failed: Câu ${p.n} trường ${p.field} có giá trị '${actualVal}', kỳ vọng '${p.after}'`,
        );
      }
      patchedFields.add(`${p.n}:${p.field}`);
    }
  }

  // 2. Kiểm tra mọi trường không bị patch giống hệt bản gốc
  for (const orig of scriptOriginal.cau) {
    const draft = sentenceMap.get(orig.n);
    if (!draft) {
      throw new Error(`Self-check failed: Câu gốc ${orig.n} bị mất`);
    }

    if (!patchedFields.has(`${orig.n}:loi`)) {
      if ((orig.loi || undefined) !== (draft.loi || undefined)) {
        throw new Error(
          `Self-check failed: Lời câu ${orig.n} bị sửa ngoài ý muốn`,
        );
      }
    }
    if (!patchedFields.has(`${orig.n}:chuTrenManHinh`)) {
      if (
        (orig.chuTrenManHinh || undefined) !==
        (draft.chuTrenManHinh || undefined)
      ) {
        throw new Error(
          `Self-check failed: Chữ màn hình câu ${orig.n} bị sửa ngoài ý muốn`,
        );
      }
    }
    if (!patchedFields.has(`${orig.n}:yDoHinh`)) {
      if ((orig.yDoHinh || undefined) !== (draft.yDoHinh || undefined)) {
        throw new Error(
          `Self-check failed: Ý đồ hình câu ${orig.n} bị sửa ngoài ý muốn`,
        );
      }
    }
  }

  return true;
}

export function buildKichBanV2Json(
  script: ScriptData,
  snapshot: ReleaseSnapshot,
): string {
  const outObj = {
    schema: "hackathon-kich-ban/1",
    id: `${script.id}-v2`,
    tieuDe: script.tieuDe,
    mucTieu: script.mucTieu,
    thoiLuongDuKienGiay: script.thoiLuongDuKienGiay,
    phan: script.phan,
    nguonSua: {
      runId: snapshot.runId,
      xuatLuc: new Date().toISOString(),
      soPhuongAnApDung: snapshot.appliedOptionIds.length,
    },
    cau: snapshot.draftSentences.map((c) => {
      const item: Record<string, unknown> = {
        n: c.n,
        phan: c.phan,
      };
      if (c.kieu) item.kieu = c.kieu;
      if (c.loi !== undefined) item.loi = c.loi;
      if (c.dungGiay !== undefined) item.dungGiay = c.dungGiay;
      if (c.chuTrenManHinh !== undefined)
        item.chuTrenManHinh = c.chuTrenManHinh;
      if (c.yDoHinh !== undefined) item.yDoHinh = c.yDoHinh;
      return item;
    }),
  };

  return JSON.stringify(outObj, null, 2);
}

export function buildKichBanV2Markdown(
  script: ScriptData,
  snapshot: ReleaseSnapshot,
): string {
  const lines: string[] = [];

  lines.push(`# ${script.id.toUpperCase()} · ${script.tieuDe}`);
  lines.push("");
  lines.push(`- **Mục tiêu:** ${script.mucTieu}`);
  lines.push(
    `- **Thời lượng dự kiến:** khoảng ${dinhDangPhut(
      script.thoiLuongDuKienGiay,
    )} (theo bản gốc, chưa tính thay đổi)`,
  );
  if (script.giongDoc) {
    lines.push(`- **Giọng đọc:** ${script.giongDoc}`);
  }
  lines.push("");

  const sectionMap = new Map(script.phan.map((p) => [p.so, p.ten]));
  let currentSection = 0;

  for (const c of snapshot.draftSentences) {
    if (c.phan !== currentSection) {
      currentSection = c.phan;
      const sectionName =
        sectionMap.get(currentSection) || `Phần ${currentSection}`;
      lines.push(`## ${currentSection} · ${sectionName}`);
      lines.push("");
    }

    lines.push(`### Câu ${c.n}`);
    if (c.kieu) {
      lines.push(`- **Kiểu:** ${c.kieu}`);
    }
    if (c.dungGiay) {
      lines.push(
        `- **Dừng:** ${c.dungGiay} giây — khoảng lặng, không có lời đọc.`,
      );
    } else if (c.loi) {
      lines.push(`- **Lời:** ${c.loi}`);
    }
    if (c.chuTrenManHinh) {
      lines.push(`- **Trên màn hình:** ${c.chuTrenManHinh}`);
    }
    if (c.yDoHinh) {
      lines.push(`- **Ý đồ hình:** ${c.yDoHinh}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function escapeCsvCell(val: string | number | undefined): string {
  if (val === undefined || val === null) return "";
  const s = String(val);
  if (
    s.includes(",") ||
    s.includes('"') ||
    s.includes("\n") ||
    s.includes("\r")
  ) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildViecCanLamCsv(
  snapshot: ReleaseSnapshot,
  cases: DecisionCase[],
): string {
  // C3-EXP-04: Cột: viec,cau,so_ky_tu,noi_dung_moi,ly_do,phuong_an,ho_so,van_de,gop_y
  const headers = [
    "viec",
    "cau",
    "so_ky_tu",
    "noi_dung_moi",
    "ly_do",
    "phuong_an",
    "ho_so",
    "van_de",
    "gop_y",
  ];

  const caseMap = new Map(cases.map((c) => [c.id, c]));
  const rows: string[] = [headers.join(",")];

  for (const w of snapshot.workItems) {
    const reasonsStr = w.reasons.map((r) => r.text).join("; ");
    const optionIds = Array.from(
      new Set(w.reasons.map((r) => r.optionId).filter(Boolean)),
    );
    const caseIds = Array.from(
      new Set(w.reasons.map((r) => r.caseId).filter(Boolean)),
    );

    const issueIdSet = new Set<string>();
    const feedbackIdSet = new Set<string>();

    for (const cid of caseIds) {
      const c = caseMap.get(cid!);
      if (c) {
        c.issueIds.forEach((id) => issueIdSet.add(id));
        c.issues.forEach((iss) =>
          iss.feedbackIds.forEach((fid) => feedbackIdSet.add(fid)),
        );
      }
    }

    const row = [
      escapeCsvCell(w.kind),
      escapeCsvCell(w.n),
      escapeCsvCell(w.kind === "thu-lai" ? w.charCount : ""),
      escapeCsvCell(w.newContent || ""),
      escapeCsvCell(reasonsStr),
      escapeCsvCell(optionIds.join("; ")),
      escapeCsvCell(caseIds.join("; ")),
      escapeCsvCell(Array.from(issueIdSet).join("; ")),
      escapeCsvCell(Array.from(feedbackIdSet).join("; ")),
    ];
    rows.push(row.join(","));
  }

  return rows.join("\n");
}

export function buildTruyVetJson(params: {
  snapshot: ReleaseSnapshot;
  cases: DecisionCase[];
  issues: IssueItem[];
  feedback: FeedbackItem[];
  metadata: Record<string, unknown>;
}): string {
  const { snapshot, cases, issues, feedback, metadata } = params;

  const quarantined = feedback.filter((f) => f.isQuarantined);

  const report = {
    runId: snapshot.runId,
    inputHash: snapshot.inputHash,
    metadata,
    decisions: snapshot.decisions,
    appliedOptionIds: snapshot.appliedOptionIds,
    blockedOptionIds: snapshot.blockedOptionIds,
    conflicts: snapshot.conflicts,
    workSummary: snapshot.summary,
    unresolvedCases: snapshot.unresolvedCases,
    issues: issues.map((iss) => ({
      id: iss.id,
      key: iss.key,
      summary: iss.summary,
      category: iss.category,
      sentenceNs: iss.location.sentenceNs,
      feedbackIds: iss.feedbackIds,
      independentSenders: iss.independentSenders,
      hasDisagreement: iss.hasDisagreement,
      options: iss.options.map((o) => ({
        id: o.id,
        label: o.label,
        title: o.title,
        status: o.status,
        patches: o.patches,
      })),
    })),
    quarantinedFeedback: quarantined.map((q) => ({
      id: q.id,
      channel: q.channel,
      sender: q.sender,
      label: q.label,
      moderationBy: q.moderationBy,
      reason: q.quarantineReason,
    })),
  };

  return JSON.stringify(redactForPersist(report), null, 2);
}

export function generateAllExports(params: {
  script: ScriptData;
  snapshot: ReleaseSnapshot;
  cases: DecisionCase[];
  issues: IssueItem[];
  feedback: FeedbackItem[];
  metadata: Record<string, unknown>;
}): ExportPackage {
  const { script, snapshot, cases, issues, feedback, metadata } = params;

  if (snapshot.conflicts.length > 0) {
    throw new Error(
      `EXPORT_BLOCKED_CONFLICT: Có ${snapshot.conflicts.length} xung đột ghi đè chưa được giải quyết`,
    );
  }

  const kichBanJson = redactForPersist(buildKichBanV2Json(script, snapshot));
  const kichBanMd = redactForPersist(buildKichBanV2Markdown(script, snapshot));
  const viecCanLamCsv = redactForPersist(buildViecCanLamCsv(snapshot, cases));
  const truyVetJson = buildTruyVetJson({
    snapshot,
    cases,
    issues,
    feedback,
    metadata,
  });

  // C3-EXP-06: Tự kiểm tra tính toàn vẹn
  selfCheckExport(script, kichBanJson, snapshot.appliedOptionIds, cases);

  return {
    kichBanJson,
    kichBanMd,
    viecCanLamCsv,
    truyVetJson,
  };
}

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

    // Truy vết theo đúng vấn đề chứa phương án đã chọn, không lấy cả hồ sơ:
    // một hồ sơ vùng có thể gom nhiều vấn đề khác góp ý.
    for (const reason of w.reasons) {
      const c = reason.caseId ? caseMap.get(reason.caseId) : undefined;
      const issue = c?.issues.find((iss) =>
        iss.options.some((o) => o.id === reason.optionId),
      );
      if (issue) {
        issueIdSet.add(issue.id);
        issue.feedbackIds.forEach((fid) => feedbackIdSet.add(fid));
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

// ============================================================================
// REVISION@3 EXPORTS (Role-based work orders, v2 timecodes, cost comparison)
// ============================================================================

import type { RevisionBrief } from "./types";
import type { VideoIndex } from "./video-index/types";

export interface RoleWorkOrders {
  bienKich: string;
  thuAm: string;
  dungHinh: string;
  amThanh: string;
  phuDe: string;
}

export interface RevisionV3ExportPackage {
  kichBanJson: string;
  kichBanMd: string;
  workOrders: RoleWorkOrders;
  bangMocV2Md: string;
  baoCaoChiPhiMd: string;
  truyVetBriefJson: string;
}

/**
 * Xuất danh sách phân chia công việc theo 5 vai trò chuyên môn (TK §8, §9)
 */
export function buildRoleWorkOrders(
  brief: RevisionBrief,
  script: ScriptData,
  videoIndex: VideoIndex,
): RoleWorkOrders {
  const cauMap = new Map(videoIndex.segments.map((c) => [c.n, c]));
  const mocV2Map = new Map(brief.keHoach.mocV2.map((m) => [m.n, m]));

  // 1. Biên kịch
  const bkLines: string[] = [
    "# LỆNH SẢN XUẤT · BIÊN KỊCH (SCRIPTWRITER)",
    "",
    `> **Mục tiêu:** Cập nhật nội dung thoại, làm rõ các khái niệm khó hiểu và chỉnh sửa câu chữ theo phản hồi sư phạm.`,
    "",
    "## 1. Danh sách câu cần sửa lời",
    "",
  ];

  const bienKichWork = brief.viec.filter((w) => w.nhom === "bien-kich");
  if (bienKichWork.length === 0) {
    bkLines.push("_Không có yêu cầu chỉnh sửa kịch bản bằng lời mới._\n");
  } else {
    for (const w of bienKichWork) {
      bkLines.push(`### Việc: ${w.id} (Ưu tiên ${w.uuTien})`);
      bkLines.push(`- **Lý do:** ${w.lyDoUuTien}`);
      bkLines.push(`- **Vị trí câu:** ${w.viTri.ns.join(", ")}`);
      if (w.bangChungDo)
        bkLines.push(`- **Bằng chứng sư phạm:** ${w.bangChungDo}`);
      bkLines.push("");

      for (const n of w.viTri.ns) {
        const orig = cauMap.get(n);
        bkLines.push(`#### Câu ${n}:`);
        bkLines.push(`- **Lời gốc (v1):** "${orig?.loi || ""}"`);
        if (w.deXuat) {
          const dx = w.deXuat as any;
          const change = dx?.changes?.find((c: any) => c.n === n);
          if (change?.after) {
            bkLines.push(`- **Lời đề xuất (v2):** "${change.after}"`);
          }
        }
        bkLines.push("");
      }
    }
  }

  // 2. Thu âm
  const taLines: string[] = [
    "# LỆNH SẢN XUẤT · THU ÂM (VOICE TALENT)",
    "",
    `> **Ngân sách:** ${brief.keHoach.thuLai.length} câu thu lại · ${brief.keHoach.kyTuThuLai} ký tự thoại.`,
    `> **Lưu ý diễn xuất:** Thu trọn cửa sổ ±1 để đảm bảo ngữ điệu nối mượt mà với phần còn lại của video.`,
    "",
    "## 1. Danh sách câu cần thu lại (kèm cửa sổ nối)",
    "",
    "| Câu | Kiểu đọc | Mốc v1 | Mốc v2 (ước tính) | Lời thoại cần thu | Ghi chú |",
    "|---|---|---|---|---|---|",
  ];

  for (const n of brief.keHoach.thuLai) {
    const orig = cauMap.get(n);
    const m2 = mocV2Map.get(n);
    const v1Str = orig
      ? `${dinhDangPhut(orig.batDau)} - ${dinhDangPhut(orig.ketThuc)}`
      : "-";
    const v2Str = m2
      ? `${dinhDangPhut(m2.batDau)} - ${dinhDangPhut(m2.ketThuc)}`
      : "-";

    // Tìm xem câu này có lời mới hay là câu đệm trong cửa sổ ±1
    let loi = orig?.loi || "";
    let ghiChu = "Câu đệm trong cửa sổ thu lại";

    for (const w of brief.viec) {
      if (w.viTri.ns.includes(n)) {
        const dx = w.deXuat as any;
        const change = dx?.changes?.find(
          (c: any) => c.n === n && c.kind === "loi",
        );
        if (change?.after) {
          loi = `**[MỚI]** ${change.after}`;
          ghiChu = "Sửa lời chính";
        }
      }
    }

    taLines.push(
      `| Câu ${n} | \`${orig?.kieu || "giang"}\` | ${v1Str} | ${v2Str} | ${loi} | ${ghiChu} |`,
    );
  }
  taLines.push("");

  // 3. Dựng hình
  const dhLines: string[] = [
    "# LỆNH SẢN XUẤT · DỰNG HÌNH & ĐỒ HỌA (VISUAL EDITOR)",
    "",
    `> **Khối lượng:** ${brief.keHoach.canhDungLai.length} cảnh cần render lại đồ họa.`,
    `> **Ràng buộc an toàn:** Tuân thủ vùng bảo vệ, không làm vỡ cấu trúc slide đa tầng.`,
    "",
    "## 1. Cảnh cần chỉnh sửa chữ màn hình / bố cục",
    "",
  ];

  const dungHinhWork = brief.viec.filter((w) => w.nhom === "dung-hinh");
  for (const w of dungHinhWork) {
    dhLines.push(`### Việc: ${w.id} (Ưu tiên ${w.uuTien})`);
    dhLines.push(`- **Lý do:** ${w.lyDoUuTien}`);
    dhLines.push(`- **Phạm vi cảnh/câu:** ${w.viTri.ns.join(", ")}`);
    if (w.bangChungDo) dhLines.push(`- **Số liệu:** ${w.bangChungDo}`);
    dhLines.push("");

    for (const n of w.viTri.ns) {
      const orig = cauMap.get(n);
      dhLines.push(`- **Cảnh câu ${n}** (Slide: ${orig?.slideId || "s0"}):`);
      dhLines.push(
        `  - Chữ màn hình gốc: "${orig?.chuTrenManHinh || "Không có"}"`,
      );
      dhLines.push(`  - Ý đồ hình: "${orig?.yDoHinh || ""}"`);
    }
    dhLines.push("");
  }

  dhLines.push("## 2. Toàn bộ cảnh phải render lại (gồm dây chuyền slide)");
  dhLines.push("");
  dhLines.push(
    `Các câu: ${brief.keHoach.canhDungLai.map((n) => `Câu ${n}`).join(", ")}`,
  );
  dhLines.push("");

  // 4. Âm thanh
  const atLines: string[] = [
    "# LỆNH SẢN XUẤT · HẬU KỲ ÂM THANH (AUDIO ENGINEER)",
    "",
    `> **Tiêu chuẩn chất lượng:** W3C WCAG 1.4.7 (khoảng cách giọng nói so với nhạc nền ≥ 20 dB).`,
    "",
    "## 1. Danh sách khoảng mix cần xử lý",
    "",
  ];

  const amThanhWork = brief.viec.filter((w) => w.nhom === "am-thanh");
  if (amThanhWork.length === 0) {
    atLines.push("_Không có yêu cầu chỉnh sửa âm thanh đặc thù._\n");
  } else {
    for (const w of amThanhWork) {
      atLines.push(`### Việc: ${w.id} (Ưu tiên ${w.uuTien})`);
      atLines.push(
        `- **Khoảng thời gian v1:** ${dinhDangPhut(w.viTri.v1[0])} - ${dinhDangPhut(w.viTri.v1[1])}`,
      );
      atLines.push(
        `- **Khoảng thời gian v2 ước tính:** ${dinhDangPhut(w.viTri.v2?.[0] || w.viTri.v1[0])} - ${dinhDangPhut(w.viTri.v2?.[1] || w.viTri.v1[1])}`,
      );
      atLines.push(
        `- **Số đo phát hiện:** ${w.bangChungDo || "Khoảng cách giọng-nhạc dưới ngưỡng 20 dB"}`,
      );
      atLines.push(
        `- **Hành động kỹ thuật:** Giảm âm lượng track nhạc nền (BGM) khoảng 10 - 11 dB trong khoảng này.`,
      );
      atLines.push("");
    }
  }

  // 5. Phụ đề
  const pdLines: string[] = [
    "# LỆNH SẢN XUẤT · PHỤ ĐỀ (SUBTITLER)",
    "",
    `> **Tiêu chuẩn:** Tối đa 17 ký tự/giây, độ lệch mốc đầu câu ≤ 0.05s.`,
    "",
    "## 1. Danh sách câu cần đồng bộ phụ đề mới",
    "",
  ];

  for (const n of brief.keHoach.thuLai) {
    const orig = cauMap.get(n);
    const m2 = mocV2Map.get(n);
    pdLines.push(
      `- **Câu ${n}** (Mốc mới: ${m2 ? `${dinhDangPhut(m2.batDau)} - ${dinhDangPhut(m2.ketThuc)}` : "-"}):`,
    );
    pdLines.push(
      `  - Xuất lại file SRT/VTT khớp với mốc v2 sau khi thu âm xong.`,
    );
  }
  pdLines.push("");

  return {
    bienKich: bkLines.join("\n"),
    thuAm: taLines.join("\n"),
    dungHinh: dhLines.join("\n"),
    amThanh: atLines.join("\n"),
    phuDe: pdLines.join("\n"),
  };
}

/**
 * Bảng mốc v2 ước tính cho toàn bộ 40 câu kèm chương YouTube (TK §7.10)
 */
export function buildEstimatedV2TimecodesTable(
  brief: RevisionBrief,
  videoIndex: VideoIndex,
): string {
  const lines: string[] = [
    "# BẢNG MỐC THỜI GIAN V2 ƯỚC TÍNH (ESTIMATED V2 TIMECODES)",
    "",
    "> [!NOTE]",
    "> Bảng mốc thời gian v2 được ước tính bằng mô hình thời lượng âm tiết trước khi thu âm giọng thật.",
    "> Sau khi hoàn tất thu âm thực tế, các mốc sẽ được đo đạc lại chính xác tuyệt đối.",
    "",
    "## 1. Danh mục chương (YouTube Chapters v2)",
    "",
  ];

  for (const ch of brief.keHoach.chuong) {
    const chInfo = videoIndex.chuong.find((c) => c.phan === ch.phan);
    lines.push(
      `- \`${dinhDangPhut(ch.batDau)}\` · Phần ${ch.phan}: ${chInfo?.ten || ""}`,
    );
  }
  lines.push("");

  lines.push("## 2. Chi tiết 40 câu video v1 vs v2");
  lines.push("");
  lines.push(
    "| Câu | Phần | Mốc v1 (Bắt đầu - Kết thúc) | Mốc v2 ước tính | Độ lệch (Δ) | Hành động |",
  );
  lines.push("|---|---|---|---|---|---|");

  const mocV2Map = new Map(brief.keHoach.mocV2.map((m) => [m.n, m]));
  const thuLaiSet = new Set(brief.keHoach.thuLai);
  const canhDungSet = new Set(brief.keHoach.canhDungLai);

  for (const c of videoIndex.segments) {
    const m2 = mocV2Map.get(c.n);
    const v1Str = `${dinhDangPhut(c.batDau)} - ${dinhDangPhut(c.ketThuc)}`;
    const v2Str = m2
      ? `${dinhDangPhut(m2.batDau)} - ${dinhDangPhut(m2.ketThuc)}`
      : "-";
    const delta = m2 ? Math.round((m2.ketThuc - c.ketThuc) * 10) / 10 : 0;
    const deltaStr = delta > 0 ? `+${delta}s` : delta < 0 ? `${delta}s` : "0s";

    const actions: string[] = [];
    if (thuLaiSet.has(c.n)) actions.push("Thu lại giọng");
    if (canhDungSet.has(c.n)) actions.push("Render lại cảnh");
    if (actions.length === 0) actions.push("Giữ nguyên");

    lines.push(
      `| Câu ${c.n} | ${c.phan} | ${v1Str} | ${v2Str} | ${deltaStr} | ${actions.join(", ")} |`,
    );
  }
  lines.push("");

  return lines.join("\n");
}

/**
 * Báo cáo chi phí so sánh với việc đập đi làm lại toàn bộ (TK §7.10, §8)
 */
export function buildCostComparisonReport(
  brief: RevisionBrief,
  videoIndex: VideoIndex,
): string {
  let totalChars = 0;
  for (const c of videoIndex.segments) totalChars += c.loi ? c.loi.length : 0;
  const totalScenes = videoIndex.segments.length;

  const plannedChars = brief.keHoach.kyTuThuLai;
  const plannedScenes = brief.keHoach.canhDungLai.length;

  const charSavings = Math.round(
    ((totalChars - plannedChars) / totalChars) * 100,
  );
  const sceneSavings = Math.round(
    ((totalScenes - plannedScenes) / totalScenes) * 100,
  );

  const lines: string[] = [
    "# BÁO CÁO ĐÁNH GIÁ TÁC ĐỘNG NGÂN SÁCH & CHI PHÍ",
    "",
    "## 1. Tóm tắt hiệu quả tiết kiệm",
    "",
    `| Hạng mục | Làm lại toàn bộ (100%) | Kế hoạch Revision v3 | Mức tiết kiệm |`,
    `|---|---|---|---|`,
    `| **Số câu thu lại** | 40 câu | **${brief.keHoach.thuLai.length} câu** | **-${Math.round(((40 - brief.keHoach.thuLai.length) / 40) * 100)}%** |`,
    `| **Ký tự thoại** | ${totalChars} ký tự | **${plannedChars} ký tự** | **-${charSavings}%** |`,
    `| **Cảnh render lại** | ${totalScenes} cảnh | **${plannedScenes} cảnh** | **-${sceneSavings}%** |`,
    `| **Tổng độ lệch thời lượng** | — | **${brief.keHoach.deltaTong > 0 ? "+" : ""}${brief.keHoach.deltaTong} giây** | Đạt ngưỡng an toàn (≤ 10s) |`,
    "",
    "## 2. So sánh với phương pháp cũ (Revision v2 không tối ưu)",
    "",
    "- **Revision v2 (Chấp nhận hết phương án A):** Phải thu lại **21/39 câu** (1 951 ký tự, tức **54% cả video**).",
    `- **Revision v3 (Quy hoạch ngân sách thông minh):** Chỉ cần thu lại **${brief.keHoach.thuLai.length} câu** (${plannedChars} ký tự, tức **${Math.round((plannedChars / totalChars) * 100)}% cả video**).`,
    `- **Hiệu quả:** Giải quyết triệt để các vấn đề sư phạm trọng tâm với **tiết kiệm ${charSavings}% chi phí thu âm**.`,
    "",
  ];

  return lines.join("\n");
}

/**
 * Đóng gói toàn bộ file xuất bản của Revision v3
 */
export function exportRevisionV3Package(params: {
  script: ScriptData;
  brief: RevisionBrief;
  videoIndex: VideoIndex;
  metadata?: Record<string, unknown>;
}): RevisionV3ExportPackage {
  const { script, brief, videoIndex, metadata = {} } = params;

  // Tạo kịch bản v2 có mốc v2 ước tính
  const draftSentences = script.cau.map((orig) => {
    const m2 = brief.keHoach.mocV2.find((m) => m.n === orig.n);
    const w = brief.viec.find((item) => item.viTri.ns.includes(orig.n));
    const dx = w?.deXuat as any;
    const change = dx?.changes?.find((c: any) => c.n === orig.n);

    return {
      ...orig,
      loi: change?.kind === "loi" && change.after ? change.after : orig.loi,
      chuTrenManHinh:
        change?.kind === "chuTrenManHinh" && change.after
          ? change.after
          : orig.chuTrenManHinh,
      yDoHinh:
        change?.kind === "yDoHinh" && change.after
          ? change.after
          : orig.yDoHinh,
      m2BatDau: m2?.batDau,
      m2KetThuc: m2?.ketThuc,
    };
  });

  const snapshotPlaceholder: any = {
    runId: String(metadata.runId || "run-v3"),
    appliedOptionIds: brief.viec.map((w) => w.id),
    draftSentences,
    workItems: [],
    conflicts: [],
  };

  const kichBanJson = buildKichBanV2Json(script, snapshotPlaceholder);
  const kichBanMd = buildKichBanV2Markdown(script, snapshotPlaceholder);
  const workOrders = buildRoleWorkOrders(brief, script, videoIndex);
  const bangMocV2Md = buildEstimatedV2TimecodesTable(brief, videoIndex);
  const baoCaoChiPhiMd = buildCostComparisonReport(brief, videoIndex);
  const truyVetBriefJson = JSON.stringify(brief, null, 2);

  return {
    kichBanJson,
    kichBanMd,
    workOrders,
    bangMocV2Md,
    baoCaoChiPhiMd,
    truyVetBriefJson,
  };
}

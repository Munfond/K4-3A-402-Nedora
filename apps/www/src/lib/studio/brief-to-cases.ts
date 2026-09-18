import type {
  DecisionCase,
  PatchItem,
  RevisionBrief,
  ScriptData,
} from "@feedback/revision-core/types";

/**
 * Chuyển `brief.viec` của revision@3 sang `DecisionCase` mà các cột Studio
 * (case-list-column, case-detail) đang đọc.
 *
 * Studio được viết cho revision@2, nơi việc nằm ở `result.cases`. revision@3
 * trả việc trong `brief.viec` với cấu trúc khác, nên cần lớp chuyển đổi này
 * thay vì sửa lại toàn bộ giao diện.
 */

type WorkItem = RevisionBrief["viec"][number];

interface DeXuatV3 {
  kieu?: string;
  lyDo?: string;
  strategy?: string;
  thayDoiChinh?: string;
  nhamToi?: string;
  moTa?: string;
  conLai?: string | null;
  changes?: Array<{
    kind?: string;
    n?: number;
    after?: string;
    moTa?: string;
  }>;
}

const NHOM_LABEL: Record<string, string> = {
  "bien-kich": "Biên kịch",
  "thu-am": "Thu âm",
  "dung-hinh": "Dựng hình",
  "am-thanh": "Âm thanh",
  "phu-de": "Phụ đề",
};

/** `kind` trong Change của v3 sang `field` của PatchItem v2. */
function mapField(kind?: string): PatchItem["field"] | null {
  if (kind === "loi") return "loi";
  if (kind === "chuTrenManHinh") return "chuTrenManHinh";
  if (kind === "yDoHinh") return "yDoHinh";
  return null;
}

function buildPatches(deXuat: DeXuatV3, script?: ScriptData): PatchItem[] {
  const patches: PatchItem[] = [];
  for (const ch of deXuat.changes ?? []) {
    const field = mapField(ch.kind);
    if (!field || typeof ch.n !== "number" || typeof ch.after !== "string") {
      continue;
    }
    const cau = script?.cau?.find((c) => c.n === ch.n);
    const before =
      field === "loi"
        ? (cau?.loi ?? "")
        : field === "chuTrenManHinh"
          ? (cau?.chuTrenManHinh ?? "")
          : (cau?.yDoHinh ?? "");
    patches.push({ n: ch.n, field, before, after: ch.after });
  }
  return patches;
}

export function briefToCases(
  brief: RevisionBrief | undefined,
  script?: ScriptData,
): DecisionCase[] {
  if (!brief?.viec?.length) return [];

  return brief.viec.map((v: WorkItem): DecisionCase => {
    const deXuat = (v.deXuat ?? {}) as DeXuatV3;
    const canNguoiViet = deXuat.kieu === "can-nguoi-viet";
    const patches = buildPatches(deXuat, script);

    const tieuDe =
      deXuat.thayDoiChinh ||
      deXuat.strategy ||
      deXuat.moTa ||
      v.lyDoUuTien ||
      `Việc ${v.id}`;

    const nhomLabel = NHOM_LABEL[v.nhom] ?? v.nhom;

    return {
      id: v.id,
      // Việc chưa có nội dung sửa cụ thể thì cần người xem lại, không phải
      // một vùng sửa sẵn sàng áp dụng.
      type: canNguoiViet
        ? "can-xac-nhan"
        : patches.length > 0
          ? "vung"
          : "ky-thuat",
      title: `[${nhomLabel}] ${tieuDe}`,
      issueIds: [v.vanDeId],
      sentenceNs: v.viTri?.ns ?? [],
      tuGiay: v.viTri?.v1?.[0] ?? 0,
      denGiay: v.viTri?.v1?.[1] ?? 0,
      issues: [
        {
          id: v.vanDeId,
          key: v.vanDeId,
          summary: deXuat.nhamToi || tieuDe,
          category: "kho-hieu",
          feedbackIds: v.gopYIds ?? [],
          location: {
            status: "da-dinh-vi",
            sentenceNs: v.viTri?.ns ?? [],
            basis: v.bangChungDo ?? "",
          },
          stances: [],
          uncertainties: canNguoiViet && deXuat.lyDo ? [deXuat.lyDo] : [],
          causeHypothesis: null,
          impact: {
            level: "vua",
            reason: v.lyDoUuTien ?? "",
          },
          options: [],
          independentSenders: v.nguoiDocLap ?? 1,
          mentions: v.gopYIds?.length ?? 0,
          sendersVerified: true,
          hasDisagreement: false,
        },
      ],
      options: canNguoiViet
        ? []
        : [
            {
              id: `${v.id}-a`,
              label: "A",
              title: deXuat.strategy || tieuDe,
              rationale: v.lyDoUuTien ?? "",
              patches,
              expectedEffect: "giai-quyet",
              remaining: deXuat.conLai ?? null,
              needsHumanCheck: null,
              unsupportedOperation: null,
              status: "hop-le",
              statusReasons: [],
            },
          ],
      hasDisagreement: false,
      independentSenders: v.nguoiDocLap ?? 1,
      mentions: v.gopYIds?.length ?? 0,
      flags: canNguoiViet ? ["can-nguoi-viet"] : [],
      status: "xong",
    };
  });
}

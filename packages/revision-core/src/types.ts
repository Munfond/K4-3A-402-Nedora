export type Channel = "khao-sat" | "binh-luan" | "tin-nhan" | "van-ban-dan";

export type Label =
  | "gop-y"
  | "khen"
  | "chi-cham-diem"
  | "nhieu"
  | "cong-kich"
  | "cai-lenh"
  | "thong-tin-ca-nhan"
  | "bo-qua";

export type Category =
  | "noi-dung-sai"
  | "kho-hieu"
  | "nhip-nhanh-cham"
  | "giong-doc"
  | "hinh-anh"
  | "loi-ky-thuat";

export type ImpactLevel = "cao" | "vua" | "thap";
export type LocationStatus = "da-dinh-vi" | "can-xac-nhan";

export interface SentenceData {
  n: number;
  phan: number;
  kieu?: string;
  loi?: string;
  dungGiay?: number;
  chuTrenManHinh?: string;
  yDoHinh?: string;
  batDauGiay: number;
  ketThucTiengGiay: number;
  ketThucGiay: number;
  soKyTu: number;
}

export interface ScriptSection {
  so: number;
  ten: string;
}

export interface ScriptData {
  id: string;
  tieuDe: string;
  mucTieu: string;
  thoiLuongDuKienGiay: number;
  phan: ScriptSection[];
  cau: SentenceData[];
  giongDoc?: string;
}

export interface FeedbackItem {
  id: string;
  channel: Channel;
  sender: string;
  sanitizedText: string;
  rawText?: string;
  time: string;
  location?: { sentenceN?: number; timeSeconds?: number };
  survey?: {
    deHieu?: number;
    nhipDo?: number;
    diemSo?: number;
  };
  label: Label;
  moderationBy: "luat" | "model" | "code" | "nguoi-duyet";
  isQuarantined: boolean;
  quarantineReason?: string;
  note?: string;
  sourceRef?: string;
  linkedIssueIds?: string[];
}

export interface NewFeedbackInput {
  id?: string;
  sourceRef?: string;
  text: string;
  channel?: "binh-luan" | "tin-nhan" | "khao-sat";
  sender?: string;
  /** Khảo sát nhập tay: được để trống `text` nếu có ít nhất một điểm. */
  survey?: { deHieu?: number; nhipDo?: number };
  /** Chỉ có khi chính người gửi chọn vị trí (ví dụ từ trình phát). */
  location?: { sentenceN?: number; timeSeconds?: number };
  time?: string;
}

export type { ExportPackage } from "./export";

export interface AnalyzeInput {
  videoId?: string;
  versionId?: string;
  scriptId?: "d1";
  includeD1Feedback?: boolean;
  newFeedback?: NewFeedbackInput[];
  feedbackIds?: string[];
  caseId?: string;
  /** false: bỏ qua cache node, gọi model thật cho mọi node (eval bắt buộc). */
  useCache?: boolean;
}

export type PatchField = "loi" | "chuTrenManHinh" | "yDoHinh";

export interface PatchItem {
  n: number;
  field: PatchField;
  before: string;
  after: string;
}

export type OptionStatus = "hop-le" | "khong-hop-le" | "ngoai-pham-vi";

export interface RevisionOption {
  id: string;
  label: "A" | "B";
  title: string;
  rationale: string;
  patches: PatchItem[];
  expectedEffect: "giai-quyet" | "mot-phan";
  remaining: string | null;
  needsHumanCheck: string | null;
  unsupportedOperation: {
    kind: string;
    description: string;
  } | null;
  status: OptionStatus;
  statusReasons: string[];
  standaloneWork?: WorkSummary;
}

export interface IssueItem {
  id: string;
  key: string;
  summary: string;
  category: Category;
  feedbackIds: string[];
  location: {
    status: LocationStatus;
    sentenceNs: number[];
    basis: string;
  };
  stances: Array<{
    direction: string;
    feedbackIds: string[];
  }>;
  uncertainties: string[];
  causeHypothesis: {
    text: string;
    source: "nguoi-gop-y" | "ai-doi-chieu";
  } | null;
  impact: {
    level: ImpactLevel;
    reason: string;
  };
  options: RevisionOption[];
  independentSenders: number;
  mentions: number;
  sendersVerified: boolean;
  hasDisagreement: boolean;
}

export type CaseType = "vung" | "can-xac-nhan" | "ky-thuat";

export interface DecisionCase {
  id: string; // "rg-from-to" | "cx-issueId" | "kt-issueId"
  type: CaseType;
  title: string;
  issueIds: string[];
  sentenceNs: number[];
  tuGiay: number;
  denGiay: number;
  issues: IssueItem[];
  options: RevisionOption[];
  hasDisagreement: boolean;
  independentSenders: number;
  mentions: number;
  flags: string[];
  status?: "dang-lap-phuong-an" | "xong" | "loi";
}

export type DecisionType = "chon" | "hoan" | "bo" | "giu-nguyen";

export interface DecisionRecord {
  type: DecisionType;
  optionId?: string;
  reason?: string;
  at: string;
}

export interface RunDecisionState {
  version: number;
  decisions: Record<string, DecisionRecord>;
  updatedAt: string;
}

export type WorkKind = "thu-lai" | "dung-canh" | "sua-phu-de" | "xem-lai-video";

export interface WorkItem {
  key: string; // `${kind}:${n}`
  kind: WorkKind;
  n: number;
  reasons: Array<{
    text: string;
    optionId?: string;
    caseId?: string;
  }>;
  newContent?: string;
  charCount?: number;
}

export interface WorkSummary {
  cauThuLai: number[];
  soKyTuThuLai: number;
  tongKyTuGoc: number;
  canhDungLai: number[];
  tongCanh: number;
  phuDeSua: number[];
  xemLaiVideo: number[];
}

export interface ConflictItem {
  type: "CONFLICT_SAME_FIELD";
  n: number;
  field: string;
  values: Array<{
    optionId: string;
    caseId: string;
    value: string;
  }>;
  blockedOptionIds: string[];
}

export interface ValidationFinding {
  code: string;
  level: "chan" | "loi" | "canh-bao" | "ghi-nhan";
  message: string;
  target?: string;
}

export interface ValidationChecks {
  schemaOk: boolean;
  feedbackCoverageOk: boolean;
  evidenceOk: boolean;
  locationsOk: boolean;
  patchesOk: boolean;
}

export interface RevisionRunResult {
  runId: string;
  inputHash: string;
  script: ScriptData;
  feedback: FeedbackItem[];
  issues: IssueItem[];
  cases: DecisionCase[];
  validation: {
    findings: ValidationFinding[];
    checks: ValidationChecks;
  };
  unassignedFeedback: FeedbackItem[];
  quarantinedFeedback: FeedbackItem[];
  brief?: RevisionBrief;
}

import type { PlanSimulation } from "./timeline/types";

export interface RevisionBrief {
  canhBao?: string[];
  pheu: {
    gopY: number;
    cachLy: number;
    choDuyet: number;
    y: number;
    vanDe: number;
    theoNhom: Record<string, number>;
    deXuat: number;
    quaThamDinh: number;
  };
  viec: Array<{
    id: string;
    nhom: "bien-kich" | "thu-am" | "dung-hinh" | "am-thanh" | "phu-de";
    uuTien: number;
    lyDoUuTien: string;
    vanDeId: string;
    gopYIds: string[];
    nguoiDocLap: number;
    viTri: { ns: number[]; v1: [number, number]; v2?: [number, number] };
    bangChungDo?: string;
    deXuat?: unknown;
    cachKhac?: unknown;
    chiPhi: PlanSimulation;
  }>;
  cauHoi: Array<{
    id: string;
    noiDung: string;
    luaChon: string[];
    gopYIds: string[];
  }>;
  ghiNhan: Array<{ gopYIds: string[]; lyDo: string }>;
  vungBaoVe: Array<{ ns: number[]; gopYIds: string[] }>;
  keHoach: PlanSimulation;
  nganSach: { cauThuLai: number; deltaTongGiay: number };
}

export interface RunAttemptMetadata {
  attemptNumber: number;
  status: "xong" | "loi";
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface RunMetadata {
  runId: string;
  status: "xong" | "loi" | "dang-chay" | "da-huy";
  createdAt: string;
  inputHash: string;
  modelId: string;
  promptVersion: string;
  promptHash: string;
  schemaVersion: string;
  policyVersion: string;
  graphVersion?: string;
  attempts: RunAttemptMetadata[];
  checks?: ValidationChecks;
  totalFeedback: number;
  newFeedbackCount: number;
  independentSenders: number;
  caseCount: number;
  durationMs: number;
  caseId?: string;
  retryOf?: string;
  videoId?: string;
  versionId?: string;
  /** "gia-lap" khi dùng model giả (eval --mock); run cũ không có trường này. */
  mode?: "that" | "gia-lap";
  /** false khi run được yêu cầu bỏ qua cache node. */
  useCache?: boolean;
  totalTokens?: number;
  error?: {
    code: string;
    message: string;
  };
}

export interface ReleaseSnapshot {
  runId: string;
  inputHash: string;
  decisions: Record<string, DecisionRecord>;
  appliedOptionIds: string[];
  blockedOptionIds: string[];
  conflicts: ConflictItem[];
  workItems: WorkItem[];
  summary: WorkSummary;
  draftSentences: SentenceData[];
  unresolvedCases: Array<{
    caseId: string;
    title: string;
    reason: string;
  }>;
}

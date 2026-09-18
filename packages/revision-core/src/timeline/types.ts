import type { SegmentIndex } from "../video-index/types";

export type Change =
  | { kind: "loi"; n: number; after: string; kieu?: SegmentIndex["kieu"] }
  | { kind: "chuTrenManHinh" | "yDoHinh"; n: number; after: string }
  | { kind: "kieu"; n: number; kieu: SegmentIndex["kieu"] }
  | { kind: "dung"; n: number; giay: number } // đổi dungGiay hoặc khoảng lặng cuối
  | {
      kind: "ky-thuat";
      tu: number;
      den: number;
      viec: "mix" | "phu-de" | "khac";
      moTa: string;
    };

export interface PlanSimulation {
  thuLai: number[];
  kyTuThuLai: number;
  canhDungLai: number[];
  trangPhuDe: number;
  deltaTong: number;
  mocV2: Array<{
    n: number;
    batDau: number;
    ketThuc: number;
    dai: [number, number];
  }>;
  chuong: Array<{ phan: number; batDau: number }>;
  viPham: Array<{
    ma: "T1" | "T2" | "T3" | "T4" | "T5" | "T6";
    n?: number;
    chiTiet: string;
  }>;
  chongLan: Array<{
    loai:
      | "cung-truong"
      | "cua-so-thu"
      | "ky-thuat-giao"
      | "cung-slide"
      | "vung-bao-ve"
      | "bang-chung-chung";
    ns: number[];
    xuLy: string;
  }>;
  soVoiLamLaiToanBo: { kyTu: number; canh: number };
}

export type ConflictType =
  | "ghi-de-loi-nhieu-lan"
  | "lech-thoi-gian-vuot-nguong"
  | "nhanh-cham-trai-nguoc"
  | "sua-vung-bao-ve"
  | "lech-slide-chua-re-render"
  | "lech-nhac-chua-mix";

export interface ConflictResolutionOption {
  id: string;
  label: string;
  description: string;
}

export interface Conflict {
  id: string;
  type: ConflictType;
  severity: "chan" | "canh-bao"; // chan = chặn xuất bản, canh-bao = cảnh báo
  affectedSentences: number[];
  affectedSlideIds?: string[];
  description: string;
  resolutionOptions: ConflictResolutionOption[];
}

export interface RevisionBudgetSummary {
  soCauThuLai: number;
  tongKyTuThuLai: number;
  soSlideCanRender: number;
  soTrangPhuDeChinhSua: number;
  deltaThoiLuongGiay: number;
  gioThuAmUocTinh: number;
  gioRenderUocTinh: number;
  gioAudioMixUocTinh: number;
  phanTramTietKiemSoVoiLamLai: number;
  datNguongNganSach: boolean; // mặc định <= 8 câu (701 ký tự), |delta| <= 10s
}

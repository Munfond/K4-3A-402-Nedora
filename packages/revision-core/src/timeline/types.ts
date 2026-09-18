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

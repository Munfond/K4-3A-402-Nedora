export type Intent =
  | "noi-dung-sai"
  | "kho-hieu"
  | "nhip-toc-do"
  | "nhip-khoang-dung"
  | "giong-doc"
  | "hinh-anh"
  | "am-thanh"
  | "phu-de"
  | "de-nghi-chung"
  | "khen-giu"
  | "chi-cham-diem"
  | "nhieu";

export interface Claim {
  id: string;
  feedbackId: string;
  sender: string;
  role: "hv" | "tg" | "gv" | "khac";
  intent: Intent;
  intentPhu?: Intent;
  trich: string; // ≤ 80 ký tự, từ bản đã ẩn PII
  goiYViTri?: string;
  mocNoi?: { tu: number; den: number; nguon: string };
  chieu?: string;
  giaThuyet?: { text: string; nguon: "nguoi-gop-y" | "ai-doi-chieu" };
  baoGianTiep: boolean;
  lanHoiLai: number;
}

export interface Localization {
  claimId: string;
  cach:
    | "nguoi-gui-chon"
    | "moc-thoi-gian"
    | "truy-xuat"
    | "agent"
    | "khong-dinh-vi";
  trongTam: number[];
  ngCanh: number[];
  doChac: number; // 0..1
  ungVien?: Array<{ n: number; diem: number; lyDo: string }>;
  kiemChung?:
    | "khop"
    | "khong-khop-video"
    | "nguoc-kich-ban"
    | "khong-du-can-cu"
    | "moc-mau-thuan";
}

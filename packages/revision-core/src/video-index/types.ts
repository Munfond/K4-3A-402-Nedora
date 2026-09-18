export interface SegmentIndex {
  n: number;
  phan: number;
  phanTen: string;
  batDau: number;
  ketThucTieng: number;
  ketThuc: number;
  soFrame: number; // giây
  loi?: string;
  dungGiay?: number;
  chuTrenManHinh?: string;
  yDoHinh?: string;
  kieu: "ke" | "giang" | "nhe" | "hoi" | "nhan"; // vắng trong kịch bản = "giang"
  amTiet: number;
  tocDo?: number; // âm tiết/giây của lời gốc
  khoangLangCuoi: number; // ketThuc - ketThucTieng
  slideId?: string;
  viTriTrongSlide?: number;
  slideDungDan: boolean;
  khungCuoi?: string; // đường dẫn ảnh khung cuối
  tinHieuHinh: {
    doDaiChuManHinh: number;
    soThanhPhanChu: number;
    soCauCungSlide: number;
  }; // từ kịch bản + slide, không OCR
  trangPhuDe: Array<{
    text: string;
    batDau: number;
    ketThuc: number;
    kyTuMoiGiay: number;
  }>;
  amThanh?: {
    rmsLoi: number;
    rmsLang: number;
    khoangCachDb: number;
  };
  thuatNguMoi: string[]; // thuật ngữ lần đầu xuất hiện ở câu này
}

export interface VideoIndex {
  videoId: string;
  versionId: string;
  hash: string;
  builtAt: string;
  segments: SegmentIndex[];
  tocDoGiong: {
    trungBinh: number;
    doLech: number;
    saiSoP90: number;
  }; // từ calibrate
  luatKhoangLang: {
    thuong: number;
    cuoiPhan: number;
    truocCauDung: number;
  };
  chuong: Array<{
    phan: number;
    ten: string;
    batDau: number;
  }>;
  tongThoiLuong: number;
  thieu: string[]; // phần không dựng được, kèm lý do (ví dụ "ffmpeg không có")
}

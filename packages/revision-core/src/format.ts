import type {
  Category,
  Channel,
  ImpactLevel,
  Label,
  OptionStatus,
  PatchField,
} from "./types";

export const VIDEO_SRC = "/video/d1.mp4";

export const nhanLoaiVanDe: Record<Category, string> = {
  "noi-dung-sai": "Nội dung sai",
  "kho-hieu": "Khó hiểu",
  "nhip-nhanh-cham": "Nhịp nhanh chậm",
  "giong-doc": "Giọng đọc",
  "hinh-anh": "Hình ảnh",
  "loi-ky-thuat": "Lỗi kỹ thuật",
};

export const nhanMucNghiemTrong: Record<ImpactLevel, string> = {
  cao: "Cao",
  vua: "Vừa",
  thap: "Thấp",
};

export const nhanKenh: Record<Channel, string> = {
  "khao-sat": "Khảo sát",
  "binh-luan": "Bình luận",
  "tin-nhan": "Tin nhắn",
  "van-ban-dan": "Văn bản dán",
};

export const nhanLoaiThayDoi: Record<PatchField, string> = {
  loi: "Đổi lời",
  chuTrenManHinh: "Đổi chữ trên màn hình",
  yDoHinh: "Đổi ý đồ hình",
};

export const nhanCanhBao: Record<string, string> = {
  "cai-lenh": "Cài lệnh ẩn",
  "cong-kich": "Công kích cá nhân",
  "thong-tin-ca-nhan": "Có thông tin cá nhân",
};

export const nhanLabel: Record<Label, string> = {
  "gop-y": "Góp ý",
  khen: "Khen ngợi",
  "chi-cham-diem": "Chỉ chấm điểm",
  nhieu: "Nhiễu",
  "cong-kich": "Công kích",
  "cai-lenh": "Cài lệnh",
  "thong-tin-ca-nhan": "Thông tin cá nhân",
  "bo-qua": "Bỏ qua",
};

export const nhanTrangThaiPhuongAn: Record<OptionStatus, string> = {
  "hop-le": "Hợp lệ",
  "khong-hop-le": "Không hợp lệ",
  "ngoai-pham-vi": "Ngoài phạm vi CP3",
};

export function laLoiKyThuat(category: Category): boolean {
  return category === "loi-ky-thuat";
}

export function dinhDangPhut(giay: number): string {
  if (Number.isNaN(giay) || giay < 0) return "0:00";
  const phut = Math.floor(giay / 60);
  const giayLe = Math.floor(giay % 60);
  return `${phut}:${giayLe.toString().padStart(2, "0")}`;
}

export function fragmentVideo(tuGiay: number, denGiay: number): string {
  return `${VIDEO_SRC}#t=${tuGiay},${denGiay}`;
}

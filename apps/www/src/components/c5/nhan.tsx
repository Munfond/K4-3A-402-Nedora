import {
  AlertTriangle,
  Eye,
  Gauge,
  Image as ImageIcon,
  Mic,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import type {
  Category,
  Channel,
  ImpactLevel,
  PatchField,
} from "@/lib/revision/types";
import {
  nhanCanhBao,
  nhanKenh,
  nhanLoaiThayDoi,
  nhanLoaiVanDe,
  nhanMucNghiemTrong,
} from "@/lib/revision/format";
import { cn } from "@/lib/utils";

const iconLoai: Record<Category, ReactNode> = {
  "noi-dung-sai": <AlertTriangle className="size-3.5" />,
  "kho-hieu": <Eye className="size-3.5" />,
  "nhip-nhanh-cham": <Gauge className="size-3.5" />,
  "giong-doc": <Mic className="size-3.5" />,
  "hinh-anh": <ImageIcon className="size-3.5" />,
  "loi-ky-thuat": <Wrench className="size-3.5" />,
};

export function NhanLoaiVanDe({
  loai,
  className,
}: {
  loai: Category;
  className?: string;
}) {
  const laKyThuat = loai === "loi-ky-thuat";
  return (
    <Badge
      className={cn(
        "gap-1.5 rounded-md px-2 py-0.5 font-medium text-xs ring-1",
        laKyThuat
          ? "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-900"
          : "bg-neutral-100 text-neutral-700 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-700",
        className,
      )}
    >
      {iconLoai[loai]}
      {nhanLoaiVanDe[loai] || loai}
    </Badge>
  );
}

const styleNghiemTrong: Record<ImpactLevel, string> = {
  cao: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-900",
  vua: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900",
  thap: "bg-green-50 text-green-700 ring-green-200 dark:bg-green-950 dark:text-green-300 dark:ring-green-900",
};

export function NhanNghiemTrong({
  muc,
  className,
}: {
  muc: ImpactLevel;
  className?: string;
}) {
  return (
    <Badge
      className={cn(
        "rounded-md px-2 py-0.5 font-medium text-xs ring-1",
        styleNghiemTrong[muc] || styleNghiemTrong.vua,
        className,
      )}
    >
      Ưu tiên {(nhanMucNghiemTrong[muc] || muc).toLowerCase()}
    </Badge>
  );
}

export function NhanKenh({
  kenh,
  className,
}: {
  kenh: Channel;
  className?: string;
}) {
  return (
    <Badge
      className={cn(
        "rounded-md bg-neutral-100 px-2 py-0.5 font-medium text-neutral-600 text-xs ring-1 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-700",
        className,
      )}
    >
      {nhanKenh[kenh] || kenh}
    </Badge>
  );
}

export function NhanThayDoi({
  loai,
  className,
}: {
  loai: PatchField;
  className?: string;
}) {
  return (
    <Badge
      className={cn(
        "rounded-md bg-neutral-100 px-2 py-0.5 font-medium text-neutral-600 text-xs ring-1 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-700",
        className,
      )}
    >
      {nhanLoaiThayDoi[loai] || loai}
    </Badge>
  );
}

export function NhanCanhBaoBadge({
  canhBao,
  className,
}: {
  canhBao: string;
  className?: string;
}) {
  return (
    <Badge
      className={cn(
        "gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-medium text-amber-700 text-xs ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900",
        className,
      )}
    >
      <ShieldAlert className="size-3.5" />
      {nhanCanhBao[canhBao] || canhBao}
    </Badge>
  );
}

import { ShieldAlert } from "lucide-react";

import { NhanCanhBao, NhanKenh } from "@/components/c5/nhan";
import type { GopY } from "@/lib/mock-data";
import { nhanCanhBao } from "@/lib/mock-data";

function dinhDangThoiDiem(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function GopYItem({ gopY }: { gopY: GopY }) {
  return (
    <div className="space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-muted-foreground text-xs">
          {gopY.id}
        </span>
        <NhanKenh kenh={gopY.kenh} />
        <span className="rounded-md bg-neutral-100 px-2 py-0.5 font-mono text-neutral-600 text-xs dark:bg-neutral-800 dark:text-neutral-300">
          {gopY.nguoiGui}
        </span>
        {gopY.canhBao && <NhanCanhBao canhBao={gopY.canhBao} />}
        <span className="ml-auto text-muted-foreground text-xs">
          {dinhDangThoiDiem(gopY.thoiDiem)}
        </span>
      </div>

      {gopY.canhBao ? (
        // Không trích nguyên văn lời công kích hay lệnh cài cắm vào báo cáo.
        <p className="flex items-center gap-2 rounded-md border border-red-200 border-dashed bg-red-50/50 px-3 py-2 text-red-700 text-sm dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <ShieldAlert className="size-4 shrink-0" />
          Nội dung bị giữ lại: {nhanCanhBao[gopY.canhBao].toLowerCase()}. Không
          đưa vào phân tích và không trích nguyên văn.
        </p>
      ) : gopY.noiDung ? (
        <p className="text-sm text-typography-secondary dark:text-neutral-300">
          {gopY.noiDung}
        </p>
      ) : (
        <p className="text-muted-foreground text-sm italic">
          (chỉ chấm điểm, không viết ý kiến)
        </p>
      )}

      {(gopY.deHieu != null || gopY.nhipDo != null) && (
        <div className="flex flex-wrap gap-3 text-muted-foreground text-xs">
          {gopY.deHieu != null && <span>Dễ hiểu: {gopY.deHieu}/5</span>}
          {gopY.nhipDo != null && <span>Nhịp độ: {gopY.nhipDo}/5</span>}
        </div>
      )}
    </div>
  );
}

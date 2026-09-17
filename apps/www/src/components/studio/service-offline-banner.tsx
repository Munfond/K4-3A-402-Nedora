"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getServiceUrl } from "@/lib/revision-client";

interface ServiceOfflineBannerProps {
  serviceUrl?: string;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}

export function ServiceOfflineBanner({
  serviceUrl,
  error,
  onRetry,
  className = "",
}: ServiceOfflineBannerProps) {
  const url = serviceUrl || getServiceUrl();

  return (
    <div
      role="alert"
      className={`rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 p-4 text-xs text-amber-900 dark:text-amber-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-amber-950 dark:text-amber-100">
            Không kết nối được Revision service ({url})
          </p>
          <p className="text-amber-800 dark:text-amber-300/90 text-[11px]">
            Vui lòng kiểm tra tiến trình <code>revision-service</code> đang chạy
            tại cổng 8000 (khởi chạy bằng lệnh <code>pnpm dev:revision</code>).
          </p>
        </div>
      </div>
      {onRetry && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="h-7 text-xs border-amber-500/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 shrink-0 gap-1.5"
        >
          <RefreshCw className="size-3" />
          Thử kết nối lại
        </Button>
      )}
    </div>
  );
}

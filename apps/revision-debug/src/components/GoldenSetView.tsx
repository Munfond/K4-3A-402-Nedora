import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Award,
  ExternalLink,
} from "lucide-react";
import { debugApi } from "../lib/debug-api";

interface GoldenSetViewProps {
  onSelectRun: (runId: string) => void;
}

export const GoldenSetView: React.FC<GoldenSetViewProps> = ({
  onSelectRun,
}) => {
  const [evalRuns, setEvalRuns] = useState<any[]>([]);
  const [selectedEvalId, setSelectedEvalId] = useState<string>("");
  const [evalDetail, setEvalDetail] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvalRuns = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await debugApi.getEvalRuns();
      setEvalRuns(data.evalRuns || []);
      if (data.evalRuns && data.evalRuns.length > 0 && !selectedEvalId) {
        setSelectedEvalId(data.evalRuns[0].id);
      }
    } catch (err: any) {
      setError(err.message || "Lỗi tải danh sách Golden set");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvalRuns();
  }, []);

  useEffect(() => {
    if (!selectedEvalId) return;
    const loadDetail = async () => {
      try {
        const detail = await debugApi.getEvalRunDetail(selectedEvalId);
        setEvalDetail(detail);
      } catch (err: any) {
        console.error("Failed to load eval run detail", err);
      }
    };
    loadDetail();
  }, [selectedEvalId]);

  const cases = evalDetail?.manifest?.cases || [];

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Award className="size-5 text-amber-400" />
            Đánh giá Golden Set (AR-14, AR-15)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Kết quả đối chuẩn chất lượng độc lập trên các case mẫu chuẩn hóa
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedEvalId}
            onChange={(e) => setSelectedEvalId(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-sky-500 font-mono"
          >
            {evalRuns.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id} {r.manifest?.mode ? `(${r.manifest.mode})` : ""}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={loadEvalRuns}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-950/20 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      {evalDetail?.manifest && (
        <div className="grid grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-500 text-[11px] block">
              Lượt đánh giá
            </span>
            <span className="font-mono font-bold text-slate-200">
              {evalDetail.manifest.id}
            </span>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-500 text-[11px] block">
              Chế độ / Model
            </span>
            <span className="font-mono text-slate-200 font-medium">
              {evalDetail.manifest.mode || "gia-lap"} ·{" "}
              {evalDetail.manifest.model || "mock"}
            </span>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-500 text-[11px] block">Tỷ lệ Đạt</span>
            <span className="font-mono text-emerald-400 font-bold">
              {evalDetail.manifest.summary
                ? `${evalDetail.manifest.summary.passCount}/${evalDetail.manifest.summary.totalCases} (${Math.round(
                    (evalDetail.manifest.summary.passCount /
                      evalDetail.manifest.summary.totalCases) *
                      100,
                  )}%)`
                : "100%"}
            </span>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-500 text-[11px] block">Thời gian</span>
            <span className="font-mono text-slate-200">
              {evalDetail.manifest.summary?.durationMs
                ? `${(evalDetail.manifest.summary.durationMs / 1000).toFixed(1)}s`
                : "—"}
            </span>
          </div>
        </div>
      )}

      {/* Cases Table */}
      <div className="flex-1 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/40">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-mono bg-slate-950">
              <th className="py-2.5 px-3">Case ID</th>
              <th className="py-2.5 px-3">Tầng</th>
              <th className="py-2.5 px-3">Kỳ vọng (Expected)</th>
              <th className="py-2.5 px-3">Thực tế (Actual)</th>
              <th className="py-2.5 px-3">Trạng thái</th>
              <th className="py-2.5 px-3">Lý do</th>
              <th className="py-2.5 px-3">Liên kết Run</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {cases.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  {isLoading
                    ? "Đang nạp dữ liệu..."
                    : "Chưa có case nào trong lượt này."}
                </td>
              </tr>
            ) : (
              cases.map((c: any) => {
                const passed = c.status === "pass" || c.passed === true;
                return (
                  <tr
                    key={c.caseId || c.id}
                    className="hover:bg-slate-800/30 font-sans"
                  >
                    <td className="py-3 px-3 font-mono font-medium text-slate-200">
                      {c.caseId || c.id}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                        {c.tier || "T1"}
                      </span>
                    </td>
                    <td
                      className="py-3 px-3 text-slate-300 max-w-xs truncate"
                      title={c.expected}
                    >
                      {c.expected || "—"}
                    </td>
                    <td
                      className="py-3 px-3 text-slate-300 max-w-xs truncate"
                      title={c.actual}
                    >
                      {c.actual || "—"}
                    </td>
                    <td className="py-3 px-3">
                      {passed ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-medium font-mono text-[11px]">
                          <CheckCircle2 className="size-3.5" /> ĐẠT
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-400 font-medium font-mono text-[11px]">
                          <XCircle className="size-3.5" /> KHÔNG ĐẠT
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-400 max-w-xs truncate text-[11px]">
                      {c.reason || c.message || "—"}
                    </td>
                    <td className="py-3 px-3 font-mono">
                      {c.runId ? (
                        <button
                          type="button"
                          onClick={() => onSelectRun(c.runId)}
                          className="flex items-center gap-1 text-sky-400 hover:text-sky-300 hover:underline"
                        >
                          <code className="text-[11px]">
                            {c.runId.slice(0, 16)}...
                          </code>
                          <ExternalLink className="size-3" />
                        </button>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

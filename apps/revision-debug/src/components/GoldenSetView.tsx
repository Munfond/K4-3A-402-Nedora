import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Award,
  ExternalLink,
  Key,
} from "lucide-react";
import { debugApi, getDebugToken, setDebugToken } from "../lib/debug-api";

interface GoldenSetViewProps {
  onSelectRun: (runId: string) => void;
}

function formatCellContent(val: any): React.ReactNode {
  if (val == null) return <span className="text-slate-500">—</span>;
  if (
    typeof val === "string" ||
    typeof val === "number" ||
    typeof val === "boolean"
  ) {
    return <span>{String(val)}</span>;
  }
  if (Array.isArray(val)) {
    return (
      <ul className="list-disc list-inside space-y-0.5 max-h-24 overflow-y-auto">
        {val.map((item, idx) => (
          <li key={idx} className="truncate">
            {typeof item === "object" ? JSON.stringify(item) : String(item)}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof val === "object") {
    if (val.issues || val.reject) {
      const issues = Array.isArray(val.issues) ? val.issues : [];
      const reject = Array.isArray(val.reject) ? val.reject : [];
      return (
        <div className="space-y-1 text-[11px]">
          {issues.length > 0 && (
            <div>
              <span className="text-sky-400 font-semibold">
                Vấn đề ({issues.length}):
              </span>{" "}
              {issues
                .map(
                  (it: any) =>
                    `${it.issueId || it.id || it.type || "issue"}${it.sentenceIds?.length ? ` (câu ${it.sentenceIds.join(",")})` : ""}`,
                )
                .join("; ")}
            </div>
          )}
          {reject.length > 0 && (
            <div>
              <span className="text-rose-400 font-semibold">
                Loại ({reject.length}):
              </span>{" "}
              {reject
                .map((r: any) => r.id || r.feedbackId || JSON.stringify(r))
                .join(", ")}
            </div>
          )}
          {issues.length === 0 && reject.length === 0 && (
            <span className="text-slate-500 font-mono">
              {"{ issues: [], reject: [] }"}
            </span>
          )}
        </div>
      );
    }
    return (
      <div className="space-y-0.5 text-[11px] max-h-24 overflow-y-auto">
        {Object.entries(val).map(([k, v]) => (
          <div key={k} className="truncate">
            <span className="text-slate-400 font-mono">{k}:</span>{" "}
            <span className="text-slate-200">
              {typeof v === "object" ? JSON.stringify(v) : String(v)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return <span>{String(val)}</span>;
}

export const GoldenSetView: React.FC<GoldenSetViewProps> = ({
  onSelectRun,
}) => {
  const [evalRuns, setEvalRuns] = useState<any[]>([]);
  const [selectedEvalId, setSelectedEvalId] = useState<string>("");
  const [evalDetail, setEvalDetail] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState(getDebugToken());
  const [isAuthError, setIsAuthError] = useState(false);

  const loadEvalRuns = async () => {
    setIsLoading(true);
    setError(null);
    setIsAuthError(false);
    try {
      const data = await debugApi.getEvalRuns();
      setEvalRuns(data.evalRuns || []);
      if (data.evalRuns && data.evalRuns.length > 0 && !selectedEvalId) {
        setSelectedEvalId(data.evalRuns[0].id);
      }
    } catch (err: any) {
      const msg = err.message || "Lỗi tải danh sách Golden set";
      setError(msg);
      if (
        err.statusCode === 401 ||
        msg.includes("401") ||
        msg.includes("UNAUTHORIZED")
      ) {
        setIsAuthError(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToken = (e: React.FormEvent) => {
    e.preventDefault();
    setDebugToken(tokenInput.trim());
    loadEvalRuns();
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
        if (err.statusCode === 401) {
          setIsAuthError(true);
        }
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

        {/* Run Selector & Reload */}
        <div className="flex items-center gap-3">
          {evalRuns.length > 0 && (
            <select
              value={selectedEvalId}
              onChange={(e) => setSelectedEvalId(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-sky-500 font-mono"
            >
              {evalRuns.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id} ({r.manifest?.model || "mock"})
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={loadEvalRuns}
            disabled={isLoading}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition disabled:opacity-50"
            title="Tải lại kết quả Golden set"
          >
            <RefreshCw
              className={`size-4 ${isLoading ? "animate-spin text-sky-400" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Auth / Error banner */}
      {isAuthError && (
        <form
          onSubmit={handleSaveToken}
          className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3"
        >
          <Key className="size-5 text-amber-400 shrink-0" />
          <div className="flex-1">
            <span className="text-amber-200 text-xs font-semibold block">
              Yêu cầu token debug (401 Unauthorized)
            </span>
            <span className="text-slate-400 text-[11px]">
              Vui lòng nhập REVISION_DEBUG_TOKEN (≥ 24 ký tự) đã cấu hình trên
              service:
            </span>
          </div>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Dán token debug..."
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-mono w-64 focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition"
          >
            Lưu & Thử lại
          </button>
        </form>
      )}

      {error && !isAuthError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-400 text-xs">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Eval Summary Banner */}
      {evalDetail?.manifest && (
        <div className="grid grid-cols-4 gap-4">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-500 text-[11px] block">
              Bộ Golden Set
            </span>
            <span className="font-mono text-slate-200 font-medium">
              {evalDetail.manifest.dataset || "v1"}
            </span>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-500 text-[11px] block">Mô hình</span>
            <span className="font-mono text-slate-200 font-medium">
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
                const expectedTitle =
                  typeof c.expected === "object"
                    ? JSON.stringify(c.expected, null, 2)
                    : String(c.expected || "");
                const actualTitle =
                  typeof c.actual === "object"
                    ? JSON.stringify(c.actual, null, 2)
                    : String(c.actual || "");

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
                      className="py-3 px-3 text-slate-300 max-w-xs"
                      title={expectedTitle}
                    >
                      {formatCellContent(c.expected)}
                    </td>
                    <td
                      className="py-3 px-3 text-slate-300 max-w-xs"
                      title={actualTitle}
                    >
                      {formatCellContent(c.actual)}
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

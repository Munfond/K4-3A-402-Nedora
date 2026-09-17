import React from "react";
import {
  X,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Layers,
  Sparkles,
} from "lucide-react";

interface ComparisonViewProps {
  runA: string;
  runB: string;
  comparison: Record<
    string,
    {
      nodeId: string;
      statusA?: string;
      statusB?: string;
      msA?: number;
      msB?: number;
      tokensA?: { input: number; output: number };
      tokensB?: { input: number; output: number };
      outputMatches: boolean;
    }
  > | null;
  onClose: () => void;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  runA,
  runB,
  comparison,
  onClose,
}) => {
  if (!comparison) return null;

  const entries = Object.values(comparison);

  const totalTokens = (t?: { input: number; output: number }) => {
    return t ? t.input + t.output : 0;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
      <div className="flex flex-col w-full max-w-5xl max-h-[85vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Layers className="size-4 text-sky-400" />
              So sánh 2 Run theo từng Node (AR-13)
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
              <span>
                Gốc (A): <code className="text-slate-200">{runA}</code>
              </span>
              <ArrowRight className="size-3 text-slate-600" />
              <span>
                Con/Mới (B): <code className="text-sky-300">{runB}</code>
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono">
                <th className="py-2.5 px-3">Node / Vùng</th>
                <th className="py-2.5 px-3">Trạng thái (A → B)</th>
                <th className="py-2.5 px-3">Thời gian (A → B)</th>
                <th className="py-2.5 px-3">Tokens (A → B)</th>
                <th className="py-2.5 px-3">Khớp Output</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {entries.map((item) => {
                const tokA = totalTokens(item.tokensA);
                const tokB = totalTokens(item.tokensB);
                const diffTime = (item.msB ?? 0) - (item.msA ?? 0);
                const diffTok = tokB - tokA;

                return (
                  <tr key={item.nodeId} className="hover:bg-slate-800/30">
                    <td className="py-3 px-3 font-mono font-medium text-slate-200">
                      {item.nodeId}
                    </td>

                    <td className="py-3 px-3">
                      <span className="text-slate-400">
                        {item.statusA || "—"}
                      </span>
                      <span className="text-slate-600 mx-1.5">→</span>
                      <span
                        className={
                          item.statusB === "xong"
                            ? "text-emerald-400 font-medium"
                            : "text-slate-300"
                        }
                      >
                        {item.statusB || "—"}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-mono">
                      <span className="text-slate-400">
                        {item.msA ?? "—"}ms
                      </span>
                      <span className="text-slate-600 mx-1.5">→</span>
                      <span className="text-slate-200">
                        {item.msB ?? "—"}ms
                      </span>
                      {diffTime !== 0 && (
                        <span
                          className={`ml-2 text-[10px] ${
                            diffTime < 0 ? "text-emerald-400" : "text-amber-400"
                          }`}
                        >
                          ({diffTime > 0 ? `+${diffTime}` : diffTime}ms)
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 font-mono">
                      <span className="text-slate-400">{tokA}</span>
                      <span className="text-slate-600 mx-1.5">→</span>
                      <span className="text-slate-200">{tokB}</span>
                      {diffTok !== 0 && (
                        <span className="ml-2 text-[10px] text-sky-400">
                          ({diffTok > 0 ? `+${diffTok}` : diffTok})
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      {item.outputMatches ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                          <CheckCircle2 className="size-3.5" /> Khớp 100%
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
                          <Sparkles className="size-3.5" /> Khác biệt (Replay)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface CorrelationData {
  symbols: string[];
  matrix: number[][];
  period_days: number;
  is_mock?: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function corrColor(v: number): string {
  if (v >= 0.7) return "bg-emerald-500/80 text-white";
  if (v >= 0.4) return "bg-emerald-500/40 text-emerald-200";
  if (v >= 0.1) return "bg-emerald-500/15 text-zinc-400";
  if (v > -0.1) return "bg-zinc-800 text-zinc-500";
  if (v > -0.4) return "bg-red-500/15 text-zinc-400";
  if (v > -0.7) return "bg-red-500/40 text-red-200";
  return "bg-red-500/80 text-white";
}

const SYMBOLS = "EURUSD,GBPUSD,USDJPY,XAUUSD,USDCAD,AUDUSD,USDCHF,BTCUSD";

export function CorrelationHeatmap() {
  const [data, setData] = useState<CorrelationData | null>(null);
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/api/v1/market/correlation?symbols=${SYMBOLS}&period=${period}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period]);

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          Correlation Matrix
        </span>
        <div className="ml-auto flex gap-1">
          {[14, 30, 60].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded transition-colors",
                period === p ? "bg-primary/20 text-primary" : "text-zinc-600 hover:text-zinc-300"
              )}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="h-4 w-4 border-2 border-zinc-600 border-t-primary rounded-full animate-spin" />
        </div>
      ) : !data ? (
        <div className="text-center text-xs text-zinc-600 py-8">Could not load correlation data</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr>
                  <td className="w-14" />
                  {data.symbols.map((s) => (
                    <th key={s} className="text-center text-zinc-500 font-normal pb-1 px-0.5 w-12">
                      <span className="writing-mode-vertical">{s.slice(0, 6)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.symbols.map((rowSym, ri) => (
                  <tr key={rowSym}>
                    <td className="text-zinc-500 font-medium py-0.5 pr-1 whitespace-nowrap text-[10px]">
                      {rowSym.slice(0, 6)}
                    </td>
                    {data.matrix[ri].map((val, ci) => (
                      <td key={ci} className="py-0.5 px-0.5">
                        <div
                          title={`${rowSym} vs ${data.symbols[ci]}: ${val.toFixed(2)}`}
                          className={cn(
                            "w-10 h-7 flex items-center justify-center rounded text-[9px] font-mono font-semibold cursor-default transition-all",
                            corrColor(val)
                          )}
                        >
                          {ri === ci ? "1.00" : val.toFixed(2)}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-1.5 text-[9px] text-zinc-600">
            <div className="h-2.5 w-2.5 rounded-sm bg-emerald-500/80" /> <span>Strong +</span>
            <div className="h-2.5 w-2.5 rounded-sm bg-zinc-800 ml-1" /> <span>Neutral</span>
            <div className="h-2.5 w-2.5 rounded-sm bg-red-500/80 ml-1" /> <span>Strong −</span>
            {data.is_mock && <span className="ml-auto italic text-zinc-700">Historical mock</span>}
          </div>
          <div className="text-[9px] text-zinc-700">
            Based on {period}-day returns · Pearson correlation
          </div>
        </>
      )}
    </div>
  );
}

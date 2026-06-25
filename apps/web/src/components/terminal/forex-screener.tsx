"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScreenerRow {
  symbol: string;
  price: number;
  change_pct: number;
  change_abs: number;
  high: number;
  low: number;
  volatility: number;
  direction: "up" | "down";
}

type SortKey = "change_pct" | "volatility";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Props {
  onSymbolSelect?: (symbol: string) => void;
}

export function ForexScreener({ onSymbolSelect }: Props) {
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>("change_pct");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async (sort: SortKey) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/market/screener?sort_by=${sort}&limit=15`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setRows(json);
      setLastUpdated(new Date());
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(sortBy);
    const id = setInterval(() => fetchData(sortBy), 60_000);
    return () => clearInterval(id);
  }, [sortBy]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 shrink-0">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Screener</span>
        <div className="ml-auto flex items-center gap-1">
          {(["change_pct", "volatility"] as SortKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setSortBy(k)}
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded transition-colors",
                sortBy === k ? "bg-primary/20 text-primary" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {k === "change_pct" ? "Change" : "Vol"}
            </button>
          ))}
          <button
            onClick={() => fetchData(sortBy)}
            disabled={loading}
            className="ml-1 text-zinc-600 hover:text-zinc-300 disabled:opacity-40"
          >
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && rows.length === 0 ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-8 bg-zinc-800/40 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-zinc-950 z-10">
              <tr className="text-zinc-600 border-b border-zinc-800">
                <th className="text-left px-3 py-1.5 font-normal">Symbol</th>
                <th className="text-right px-2 py-1.5 font-normal">Price</th>
                <th className="text-right px-3 py-1.5 font-normal">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.symbol}
                  onClick={() => onSymbolSelect?.(row.symbol)}
                  className="hover:bg-zinc-800/50 cursor-pointer border-b border-zinc-900 transition-colors"
                >
                  <td className="px-3 py-1.5">
                    <span className="font-semibold text-zinc-200">{row.symbol}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-zinc-300">
                    {row.price > 100 ? row.price.toFixed(2) : row.price.toFixed(5)}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <div className={cn("flex items-center justify-end gap-0.5 font-medium", row.direction === "up" ? "text-emerald-400" : "text-red-400")}>
                      {row.direction === "up" ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                      {row.change_pct > 0 ? "+" : ""}{row.change_pct.toFixed(2)}%
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {lastUpdated && (
        <div className="px-3 py-1 text-[9px] text-zinc-700 border-t border-zinc-900 shrink-0">
          Updated {lastUpdated.toLocaleTimeString()} · 60s refresh
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MacroSeries {
  date: string;
  value: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const SERIES_META: Record<string, { label: string; unit: string; description: string }> = {
  FEDFUNDS: { label: "Fed Funds Rate", unit: "%", description: "US Federal Funds Rate" },
  CPIAUCSL: { label: "CPI", unit: "", description: "US Consumer Price Index" },
  UNRATE: { label: "Unemployment", unit: "%", description: "US Unemployment Rate" },
  T10Y2Y: { label: "Yield Curve", unit: "%", description: "10Y-2Y Treasury Spread" },
  DGS10: { label: "10Y Treasury", unit: "%", description: "10-Year Treasury Rate" },
  DGS2: { label: "2Y Treasury", unit: "%", description: "2-Year Treasury Rate" },
};

const DEFAULT_SERIES = "FEDFUNDS,CPIAUCSL,UNRATE,T10Y2Y";

export function MacroPanel() {
  const [data, setData] = useState<Record<string, MacroSeries[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetch_ = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/v1/market/macro?series=${DEFAULT_SERIES}&limit=2`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch_();
    return () => { cancelled = true; };
  }, []);

  const seriesIds = DEFAULT_SERIES.split(",");

  return (
    <div className="flex flex-col gap-0.5 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Macro</span>
        <span className="text-[9px] text-muted-foreground/50 ml-auto">FRED Data</span>
      </div>
      {seriesIds.map((sid) => {
        const meta = SERIES_META[sid] ?? { label: sid, unit: "", description: sid };
        const points = data[sid] ?? [];
        const latest = points[points.length - 1]?.value;
        const prev = points[points.length - 2]?.value;
        const change = latest !== undefined && prev !== undefined ? latest - prev : null;

        return (
          <div key={sid} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/20 transition-colors">
            <div>
              <div className="text-[11px] font-medium text-zinc-300">{meta.label}</div>
              <div className="text-[9px] text-zinc-600">{meta.description}</div>
            </div>
            <div className="text-right">
              {loading ? (
                <div className="h-3 w-12 bg-zinc-800 rounded animate-pulse" />
              ) : (
                <>
                  <div className="text-[12px] font-mono font-semibold text-zinc-200">
                    {latest !== undefined ? `${latest.toFixed(2)}${meta.unit}` : "—"}
                  </div>
                  {change !== null && (
                    <div className={`flex items-center gap-0.5 text-[10px] justify-end ${change > 0 ? "text-emerald-400" : change < 0 ? "text-red-400" : "text-zinc-500"}`}>
                      {change > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : change < 0 ? <TrendingDown className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
                      {change > 0 ? "+" : ""}{change.toFixed(2)}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
      <div className="mt-1 text-[9px] text-zinc-700 text-center">
        Source: St. Louis Fed (FRED) · Monthly
      </div>
    </div>
  );
}

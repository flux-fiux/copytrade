"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface SentimentData {
  symbol: string;
  long_pct: number;
  short_pct: number;
  long_count: number;
  short_count: number;
  total_signals: number;
  period_hours: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Props {
  symbol: string;
}

export function CommunitySentiment({ symbol }: Props) {
  const [data, setData] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchSentiment() {
      try {
        const res = await fetch(`${API_BASE}/api/v1/market/sentiment?symbol=${encodeURIComponent(symbol)}`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    setData(null);
    fetchSentiment();
    const interval = setInterval(fetchSentiment, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [symbol]);

  return (
    <div className="px-3 py-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sentiment</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">{symbol}</span>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-full rounded" />
          <Skeleton className="h-5 w-full rounded" />
        </div>
      ) : !data ? (
        <div className="text-xs text-muted-foreground text-center py-2">No data available</div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-emerald-400 w-10">LONG</span>
              <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full transition-all duration-700"
                  style={{ width: `${data.long_pct}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-emerald-400 w-8 text-right">{data.long_pct}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-red-400 w-10">SHORT</span>
              <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-400 rounded-full transition-all duration-700"
                  style={{ width: `${data.short_pct}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-red-400 w-8 text-right">{data.short_pct}%</span>
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {data.total_signals} signals · {data.period_hours}h
            </span>
          </div>

          <div className="mt-1">
            <span className="text-[9px] text-muted-foreground/60">Platform community data · Updated live</span>
          </div>
        </>
      )}
    </div>
  );
}

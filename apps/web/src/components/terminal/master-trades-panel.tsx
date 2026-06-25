"use client";

import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useMasterTrades } from "@/hooks/useMasterTrades";
import { Skeleton } from "@/components/ui/skeleton";

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function truncate(name: string, max = 12): string {
  return name.length > max ? name.slice(0, max) + "…" : name;
}

interface Props {
  symbol: string;
}

export function MasterTradesPanel({ symbol }: Props) {
  const { trades, loading } = useMasterTrades(symbol);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Master Trades</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">{symbol}</span>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2 p-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-9 w-full rounded" />
          ))}
        </div>
      ) : trades.length === 0 ? (
        <div className="px-3 py-6 text-center text-xs text-muted-foreground">
          No trades yet for {symbol}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border/30">
          {trades.slice(0, 20).map((t) => {
            const isBuy = t.direction === "BUY";
            return (
              <div key={t.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors">
                <div className={`shrink-0 ${isBuy ? "text-emerald-400" : "text-red-400"}`}>
                  {isBuy ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-medium truncate">{truncate(t.master_name)}</span>
                    <span className={`text-[11px] font-mono font-semibold ${
                      t.profit == null ? "text-muted-foreground" :
                      t.profit > 0 ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {t.profit == null ? "—" : (t.profit > 0 ? "+" : "") + t.profit.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {t.open_price != null ? t.open_price.toFixed(5) : "—"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(t.closed_at ?? t.opened_at)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Trade {
  id: string;
  symbol: string;
  direction: "BUY" | "SELL";
  volume: number;
  openPrice: number;
  closePrice?: number;
  profit?: number;
  openedAt: string;
  closedAt?: string;
  status: "OPEN" | "CLOSED";
}

interface Props { trades: Trade[]; }

export function RecentTradesTable({ trades }: Props) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
            <th className="px-4 py-3 text-left">Symbol</th>
            <th className="px-4 py-3 text-left">Dir</th>
            <th className="px-4 py-3 text-right hidden sm:table-cell">Volume</th>
            <th className="px-4 py-3 text-right hidden md:table-cell">Open</th>
            <th className="px-4 py-3 text-right hidden md:table-cell">Close</th>
            <th className="px-4 py-3 text-right">P&amp;L</th>
            <th className="px-4 py-3 text-left hidden lg:table-cell">Opened</th>
          </tr>
        </thead>
        <tbody>
          {trades.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No recent trades</td></tr>
          )}
          {trades.map(t => (
            <tr key={t.id} className="border-t border-border/50 hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3 font-medium">{t.symbol}</td>
              <td className="px-4 py-3">
                <Badge className={t.direction === "BUY"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-red-500/10 text-red-400 border-red-500/30"}>
                  {t.direction === "BUY"
                    ? <TrendingUp className="h-3 w-3 mr-1 inline" />
                    : <TrendingDown className="h-3 w-3 mr-1 inline" />}
                  {t.direction}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">{t.volume}</td>
              <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">{t.openPrice.toFixed(5)}</td>
              <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">{t.closePrice?.toFixed(5) ?? "—"}</td>
              <td className={`px-4 py-3 text-right font-medium ${(t.profit ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {t.profit != null ? `${t.profit >= 0 ? "+" : ""}$${t.profit.toFixed(2)}` : "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                {new Date(t.openedAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

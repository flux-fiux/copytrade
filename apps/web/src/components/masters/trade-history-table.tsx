"use client";

import { Badge } from "@/components/ui/badge";

interface Trade {
  id: number;
  symbol: string;
  direction: "BUY" | "SELL";
  openTime: string;
  closeTime: string;
  pips: number;
  pnl: number;
}

const trades: Trade[] = [
  { id: 1, symbol: "EURUSD", direction: "BUY", openTime: "2024-06-20 08:14", closeTime: "2024-06-20 14:32", pips: 42, pnl: 840 },
  { id: 2, symbol: "XAUUSD", direction: "BUY", openTime: "2024-06-19 13:05", closeTime: "2024-06-19 21:18", pips: 280, pnl: 2240 },
  { id: 3, symbol: "GBPUSD", direction: "SELL", openTime: "2024-06-19 09:22", closeTime: "2024-06-19 12:47", pips: -18, pnl: -360 },
  { id: 4, symbol: "USDJPY", direction: "SELL", openTime: "2024-06-18 02:30", closeTime: "2024-06-18 08:15", pips: 65, pnl: 1300 },
  { id: 5, symbol: "EURUSD", direction: "SELL", openTime: "2024-06-17 15:40", closeTime: "2024-06-18 01:10", pips: 38, pnl: 760 },
  { id: 6, symbol: "XAUUSD", direction: "BUY", openTime: "2024-06-17 09:00", closeTime: "2024-06-17 14:25", pips: -45, pnl: -900 },
  { id: 7, symbol: "GBPJPY", direction: "BUY", openTime: "2024-06-16 07:12", closeTime: "2024-06-16 16:44", pips: 98, pnl: 1960 },
  { id: 8, symbol: "AUDUSD", direction: "BUY", openTime: "2024-06-15 11:30", closeTime: "2024-06-15 18:00", pips: 31, pnl: 620 },
  { id: 9, symbol: "EURUSD", direction: "BUY", openTime: "2024-06-14 08:55", closeTime: "2024-06-14 20:30", pips: 55, pnl: 1100 },
  { id: 10, symbol: "USDCAD", direction: "SELL", openTime: "2024-06-13 13:00", closeTime: "2024-06-13 23:45", pips: -12, pnl: -240 },
];

export function TradeHistoryTable() {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="grid grid-cols-[1fr_80px_1fr_1fr_70px_90px] gap-3 px-4 py-2.5 bg-muted/40 text-xs text-muted-foreground font-medium uppercase tracking-wide border-b border-border">
        <div>Symbol</div>
        <div>Side</div>
        <div>Open</div>
        <div>Close</div>
        <div className="text-right">Pips</div>
        <div className="text-right">P&L</div>
      </div>
      {trades.map((t) => (
        <div
          key={t.id}
          className="grid grid-cols-[1fr_80px_1fr_1fr_70px_90px] gap-3 px-4 py-3 border-b border-border/40 text-sm hover:bg-muted/20 transition-colors items-center"
        >
          <div className="font-semibold">{t.symbol}</div>
          <div>
            <Badge
              variant="outline"
              className={t.direction === "BUY"
                ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10 text-[11px]"
                : "border-red-500/50 text-red-400 bg-red-500/10 text-[11px]"}
            >
              {t.direction}
            </Badge>
          </div>
          <div className="text-muted-foreground text-xs">{t.openTime}</div>
          <div className="text-muted-foreground text-xs">{t.closeTime}</div>
          <div className={`text-right font-medium ${t.pips >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {t.pips >= 0 ? "+" : ""}{t.pips}
          </div>
          <div className={`text-right font-semibold ${t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {t.pnl >= 0 ? "+" : ""}${t.pnl.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}

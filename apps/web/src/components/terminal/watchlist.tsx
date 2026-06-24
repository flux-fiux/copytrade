"use client";

import { Plus, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";

const watchlist = [
  { symbol: "EURUSD", price: "1.08423", pct: "+0.11%", up: true },
  { symbol: "GBPUSD", price: "1.26841", pct: "+0.27%", up: true },
  { symbol: "USDJPY", price: "157.482", pct: "-0.15%", up: false },
  { symbol: "XAUUSD", price: "2,341.50", pct: "+0.35%", up: true },
  { symbol: "BTCUSD", price: "67,240", pct: "-1.20%", up: false },
  { symbol: "US30", price: "39,148", pct: "+0.32%", up: true },
  { symbol: "USDCAD", price: "1.36124", pct: "-0.13%", up: false },
  { symbol: "NZDUSD", price: "0.60482", pct: "+0.08%", up: true },
  { symbol: "EURGBP", price: "0.85521", pct: "-0.04%", up: false },
  { symbol: "USDCHF", price: "0.91124", pct: "+0.06%", up: true },
];

interface Props {
  activeSymbol: string;
  onSelect: (s: string) => void;
}

export function WatchList({ activeSymbol, onSelect }: Props) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Watchlist</span>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {watchlist.map((item) => (
        <button
          key={item.symbol}
          onClick={() => onSelect(item.symbol)}
          className={`flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors text-left
            ${activeSymbol === item.symbol ? "bg-muted/60 border-l-2 border-primary" : "border-l-2 border-transparent"}`}
        >
          <div>
            <div className="text-xs font-semibold">{item.symbol}</div>
            <div className="text-[11px] text-muted-foreground font-mono">{item.price}</div>
          </div>
          <div className={`flex items-center gap-0.5 text-[11px] font-medium ${item.up ? "text-emerald-400" : "text-red-400"}`}>
            {item.up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            {item.pct}
          </div>
        </button>
      ))}
    </div>
  );
}

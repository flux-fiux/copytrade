"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, TrendingUp, TrendingDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { connectSocket } from "@/lib/socket";

const SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "BTCUSD", "US30", "USDCAD", "NZDUSD", "EURGBP", "USDCHF"];

interface QuoteState { price: string; pct: string; up: boolean; raw: number; rawPc: number }

const FALLBACK: Record<string, QuoteState> = {
  EURUSD: { price: "1.08423", pct: "+0.11%", up: true,  raw: 1.08423, rawPc: 1.08305 },
  GBPUSD: { price: "1.26841", pct: "+0.27%", up: true,  raw: 1.26841, rawPc: 1.26499 },
  USDJPY: { price: "157.482", pct: "-0.15%", up: false, raw: 157.482, rawPc: 157.718 },
  XAUUSD: { price: "2,341.50", pct: "+0.35%", up: true, raw: 2341.5, rawPc: 2333.3 },
  BTCUSD: { price: "67,240",  pct: "-1.20%", up: false, raw: 67240, rawPc: 68058 },
  US30:   { price: "39,148",  pct: "+0.32%", up: true,  raw: 39148, rawPc: 38998 },
  USDCAD: { price: "1.36124", pct: "-0.13%", up: false, raw: 1.36124, rawPc: 1.36301 },
  NZDUSD: { price: "0.60482", pct: "+0.08%", up: true,  raw: 0.60482, rawPc: 0.60434 },
  EURGBP: { price: "0.85521", pct: "-0.04%", up: false, raw: 0.85521, rawPc: 0.85555 },
  USDCHF: { price: "0.91124", pct: "+0.06%", up: true,  raw: 0.91124, rawPc: 0.91069 },
};

function fmt(v: number): string {
  if (v > 10000) return v.toLocaleString("en", { maximumFractionDigits: 0 });
  if (v > 100)   return v.toFixed(2);
  return v.toFixed(5);
}

interface Props { activeSymbol: string; onSelect: (s: string) => void }

export function WatchList({ activeSymbol, onSelect }: Props) {
  const t = useTranslations("terminal");
  const [quotes, setQuotes] = useState<Record<string, QuoteState>>(FALLBACK);

  const onQuote = useCallback((data: { symbol?: string; c?: number; pc?: number; price?: number }) => {
    const sym = data.symbol;
    if (!sym) return;
    const price = data.c ?? data.price ?? 0;
    const pc = data.pc ?? (quotes[sym]?.rawPc ?? price);
    if (!price) return;
    const diff = pc > 0 ? ((price - pc) / pc) * 100 : 0;
    setQuotes(prev => ({
      ...prev,
      [sym]: {
        price: fmt(price),
        pct: `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}%`,
        up: diff >= 0,
        raw: price,
        rawPc: pc,
      },
    }));
  }, [quotes]);

  useEffect(() => {
    const sock = connectSocket();
    sock.emit("subscribe:market", SYMBOLS);
    sock.on("quote", onQuote);
    return () => {
      sock.off("quote", onQuote);
      sock.emit("unsubscribe:market", SYMBOLS);
    };
  }, [onQuote]);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("watchlist")}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {SYMBOLS.map((sym) => {
        const item = quotes[sym] ?? FALLBACK[sym];
        return (
          <button
            key={sym}
            onClick={() => onSelect(sym)}
            className={`flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors text-left
              ${activeSymbol === sym ? "bg-muted/60 border-l-2 border-primary" : "border-l-2 border-transparent"}`}
          >
            <div>
              <div className="text-xs font-semibold">{sym}</div>
              <div className="text-[11px] text-muted-foreground font-mono">{item.price}</div>
            </div>
            <div className={`flex items-center gap-0.5 text-[11px] font-medium ${item.up ? "text-emerald-400" : "text-red-400"}`}>
              {item.up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
              {item.pct}
            </div>
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { api } from "@/lib/api-client";
import { connectSocket } from "@/lib/socket";

const SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "BTCUSD", "US30", "USDCAD", "AUDUSD"];

const FALLBACK: Record<string, QuoteState> = {
  EURUSD: { price: "1.08423", pct: "+0.11%", up: true },
  GBPUSD: { price: "1.26841", pct: "+0.27%", up: true },
  USDJPY: { price: "157.482", pct: "-0.15%", up: false },
  XAUUSD: { price: "2341.50", pct: "+0.35%", up: true },
  BTCUSD: { price: "67240",   pct: "-1.20%", up: false },
  US30:   { price: "39148",   pct: "+0.32%", up: true  },
  USDCAD: { price: "1.36124", pct: "-0.13%", up: false },
  AUDUSD: { price: "0.65481", pct: "+0.12%", up: true  },
};

interface QuoteState { price: string; pct: string; up: boolean }

function rawToState(sym: string, q: { c: number; pc: number }): QuoteState {
  const pctVal = q.pc ? ((q.c - q.pc) / q.pc) * 100 : 0;
  const up = pctVal >= 0;
  const decimals = sym === "USDJPY" ? 3
    : sym === "XAUUSD" || sym === "BTCUSD" || sym === "US30" ? 2
    : 5;
  return {
    price: q.c.toFixed(decimals),
    pct: `${up ? "+" : ""}${pctVal.toFixed(2)}%`,
    up,
  };
}

export function QuoteBar() {
  const [quotes, setQuotes] = useState<Record<string, QuoteState>>(FALLBACK);
  const wsActive = useRef(false);

  // WebSocket real-time layer
  useEffect(() => {
    const sock = connectSocket();

    sock.emit("subscribe:market", SYMBOLS);

    function onQuote(data: { symbol: string; c: number; pc: number }) {
      if (!data.symbol || !data.c) return;
      wsActive.current = true;
      setQuotes((prev) => ({ ...prev, [data.symbol]: rawToState(data.symbol, data) }));
    }
    sock.on("quote", onQuote);

    return () => {
      sock.off("quote", onQuote);
      sock.emit("unsubscribe:market", SYMBOLS);
    };
  }, []);

  // REST polling fallback — only polls if WebSocket hasn't delivered data yet
  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval>;

    async function fetchAll() {
      if (wsActive.current) return;
      const results: Record<string, QuoteState> = { ...FALLBACK };
      await Promise.allSettled(
        SYMBOLS.map(async (sym) => {
          try {
            const q = await api.market.quote(sym);
            if (!q.c || !q.pc) return;
            results[sym] = rawToState(sym, q);
          } catch { /* keep fallback */ }
        }),
      );
      if (!cancelled) setQuotes(results);
    }

    fetchAll();
    interval = setInterval(fetchAll, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <div className="flex items-center gap-0 border-b border-border/50 bg-muted/20 overflow-x-auto scrollbar-none">
      {SYMBOLS.map((sym) => {
        const q = quotes[sym] ?? FALLBACK[sym];
        return (
          <div
            key={sym}
            className="flex items-center gap-2 px-4 py-2 border-r border-border/30 cursor-pointer hover:bg-muted/40 transition-colors shrink-0"
          >
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground">{sym}</div>
              <div className="text-sm font-bold font-mono">{q.price}</div>
            </div>
            <div className={`text-xs font-medium flex items-center gap-0.5 ${q.up ? "text-emerald-400" : "text-red-400"}`}>
              {q.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {q.pct}
            </div>
          </div>
        );
      })}
    </div>
  );
}

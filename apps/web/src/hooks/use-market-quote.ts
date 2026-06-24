"use client";

import { useEffect, useState } from "react";
import { connectSocket } from "@/lib/socket";

export interface Quote {
  symbol: string;
  c: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

export function useMarketQuote(symbol: string): Quote | null {
  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => {
    if (!symbol) return;
    const sock = connectSocket();

    sock.emit("subscribe:market", [symbol]);

    function onQuote(data: Quote) {
      if (data.symbol === symbol) setQuote(data);
    }
    sock.on("quote", onQuote);

    return () => {
      sock.off("quote", onQuote);
      sock.emit("unsubscribe:market", [symbol]);
    };
  }, [symbol]);

  return quote;
}

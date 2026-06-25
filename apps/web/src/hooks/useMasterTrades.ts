"use client";

import { useState, useEffect } from "react";

export interface MasterTrade {
  id: string;
  master_name: string;
  direction: "BUY" | "SELL";
  volume: number;
  open_price: number | null;
  close_price: number | null;
  profit: number | null;
  opened_at: string | null;
  closed_at: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function useMasterTrades(symbol: string) {
  const [trades, setTrades] = useState<MasterTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetch_trades() {
      try {
        const res = await fetch(`${API_BASE}/api/v1/market/master-trades?symbol=${encodeURIComponent(symbol)}&limit=20`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) {
          setTrades(data);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    fetch_trades();
    const interval = setInterval(fetch_trades, 30_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [symbol]);

  return { trades, loading };
}

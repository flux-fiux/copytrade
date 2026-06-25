"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import {
  Radio, TrendingUp, TrendingDown, Loader2, RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface Signal {
  id: string;
  master_id: string;
  master_username?: string;
  symbol: string;
  direction: "BUY" | "SELL";
  signal_type: "OPEN" | "CLOSE" | "MODIFY";
  volume: number;
  open_price?: number;
  close_price?: number;
  profit?: number;
  opened_at: string;
  closed_at?: string;
  status?: string;
}

const MOCK_SIGNALS: Signal[] = [
  { id: "s1", master_id: "1", master_username: "AlphaWave FX", symbol: "EURUSD", direction: "BUY", signal_type: "OPEN", volume: 0.10, open_price: 1.08234, profit: 24.80, opened_at: new Date(Date.now() - 3600000 * 2).toISOString() },
  { id: "s2", master_id: "2", master_username: "GoldTrader Pro", symbol: "XAUUSD", direction: "SELL", signal_type: "CLOSE", volume: 0.05, open_price: 2341.50, close_price: 2328.20, profit: 41.20, opened_at: new Date(Date.now() - 3600000 * 5).toISOString(), closed_at: new Date(Date.now() - 3600000).toISOString() },
  { id: "s3", master_id: "1", master_username: "AlphaWave FX", symbol: "GBPUSD", direction: "BUY", signal_type: "OPEN", volume: 0.08, open_price: 1.26841, profit: -12.40, opened_at: new Date(Date.now() - 3600000 * 8).toISOString() },
  { id: "s4", master_id: "2", master_username: "GoldTrader Pro", symbol: "USDJPY", direction: "SELL", signal_type: "CLOSE", volume: 0.10, open_price: 157.48, close_price: 157.12, profit: 18.60, opened_at: new Date(Date.now() - 3600000 * 12).toISOString(), closed_at: new Date(Date.now() - 3600000 * 4).toISOString() },
  { id: "s5", master_id: "1", master_username: "AlphaWave FX", symbol: "EURUSD", direction: "BUY", signal_type: "OPEN", volume: 0.10, open_price: 1.08012, profit: 8.20, opened_at: new Date(Date.now() - 3600000 * 24).toISOString() },
];

export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSignals = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      const res = await fetch(`${apiUrl}/api/v1/signals/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("API unavailable");
      const data = await res.json();
      setSignals(Array.isArray(data) ? data : MOCK_SIGNALS);
    } catch {
      setSignals(MOCK_SIGNALS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchSignals(); }, [fetchSignals]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSignals();
  };

  const totalPnl = signals.reduce((sum, s) => sum + (s.profit ?? 0), 0);
  const openCount = signals.filter(s => s.signal_type === "OPEN").length;
  const closedCount = signals.filter(s => s.signal_type === "CLOSE").length;

  return (
    <div className="px-6 py-6">
      <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Copy Signals</h1>
              <p className="text-sm text-muted-foreground mt-1">Signals received from your subscribed masters</p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              Refresh
            </button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Card className="border-border/60">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Total P&L</div>
                <div className={cn("text-xl font-bold mt-1", totalPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Open Positions</div>
                <div className="text-xl font-bold mt-1 text-blue-400">{openCount}</div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Closed Trades</div>
                <div className="text-xl font-bold mt-1">{closedCount}</div>
              </CardContent>
            </Card>
          </div>

          {/* Signal list */}
          {loading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading signals…
            </div>
          ) : signals.length === 0 ? (
            <Card className="border-border/60 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Radio className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold mb-1">No signals yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Subscribe to a master trader to start receiving signals.
                </p>
                <Link href="/leaderboard" className={cn(buttonVariants({ size: "sm" }))}>
                  Browse Masters
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/60 overflow-hidden">
              <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Recent Signals</h2>
                <span className="text-xs text-muted-foreground">{signals.length} total</span>
              </div>
              <div className="divide-y divide-border/50">
                {signals.map(signal => {
                  const pnl = signal.profit ?? 0;
                  const isOpen = signal.signal_type === "OPEN" && !signal.closed_at;
                  return (
                    <div key={signal.id} className="flex items-center gap-4 px-4 py-3">
                      <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted shrink-0">
                        {signal.direction === "BUY"
                          ? <TrendingUp className="h-4 w-4 text-emerald-400" />
                          : <TrendingDown className="h-4 w-4 text-red-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-sm">{signal.symbol}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] px-1.5",
                              signal.direction === "BUY" ? "text-emerald-400 border-emerald-500/30" : "text-red-400 border-red-500/30"
                            )}
                          >
                            {signal.direction}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] px-1.5", isOpen ? "text-blue-400 border-blue-500/30" : "text-muted-foreground")}
                          >
                            {isOpen ? "OPEN" : "CLOSED"}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {signal.master_username ?? "Unknown Master"} · {signal.volume} lot
                          {signal.open_price && ` @ ${signal.open_price}`}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={cn("text-sm font-bold", pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                          {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(signal.opened_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
    </div>
  );
}

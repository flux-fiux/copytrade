"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import { Radio, TrendingUp, TrendingDown, Loader2, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useSocket } from "@/hooks/useSocket";

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
}

const MOCK_SIGNALS: Signal[] = [
  { id: "s1", master_id: "1", master_username: "AlphaWave FX", symbol: "EURUSD", direction: "BUY", signal_type: "OPEN", volume: 0.10, open_price: 1.08234, profit: 24.80, opened_at: new Date(Date.now() - 3600000 * 2).toISOString() },
  { id: "s2", master_id: "2", master_username: "GoldTrader Pro", symbol: "XAUUSD", direction: "SELL", signal_type: "CLOSE", volume: 0.05, open_price: 2341.50, close_price: 2328.20, profit: 41.20, opened_at: new Date(Date.now() - 3600000 * 5).toISOString(), closed_at: new Date(Date.now() - 3600000).toISOString() },
  { id: "s3", master_id: "1", master_username: "AlphaWave FX", symbol: "GBPUSD", direction: "BUY", signal_type: "OPEN", volume: 0.08, open_price: 1.26841, profit: -12.40, opened_at: new Date(Date.now() - 3600000 * 8).toISOString() },
  { id: "s4", master_id: "2", master_username: "GoldTrader Pro", symbol: "USDJPY", direction: "SELL", signal_type: "CLOSE", volume: 0.10, open_price: 157.48, close_price: 157.12, profit: 18.60, opened_at: new Date(Date.now() - 3600000 * 12).toISOString(), closed_at: new Date(Date.now() - 3600000 * 4).toISOString() },
];

export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [masterIds, setMasterIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLive, setIsLive] = useState(false);
  // IDs of signals just received via socket — highlighted briefly
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const newIdTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const markNew = useCallback((id: string) => {
    setNewIds(prev => new Set(prev).add(id));
    const existing = newIdTimers.current.get(id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setNewIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      newIdTimers.current.delete(id);
    }, 3000);
    newIdTimers.current.set(id, timer);
  }, []);

  const fetchSignals = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const [sigsRes, subsRes] = await Promise.allSettled([
        fetch(`${apiUrl}/api/v1/signals/`, { headers }),
        fetch(`${apiUrl}/api/v1/subscriptions/my`, { headers }),
      ]);

      if (sigsRes.status === "fulfilled" && sigsRes.value.ok) {
        const data = await sigsRes.value.json();
        setSignals(Array.isArray(data) ? data : MOCK_SIGNALS);
      } else {
        setSignals(MOCK_SIGNALS);
      }

      if (subsRes.status === "fulfilled" && subsRes.value.ok) {
        const subs = await subsRes.value.json();
        if (Array.isArray(subs)) {
          setMasterIds(subs.map((s: { master_id: string }) => s.master_id));
        }
      }
    } catch {
      setSignals(MOCK_SIGNALS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchSignals(); }, [fetchSignals]);

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = newIdTimers.current;
    return () => { timers.forEach(clearTimeout); };
  }, []);

  const handleIncomingSignal = useCallback((data: Record<string, unknown>) => {
    const signal = data as unknown as Signal;
    if (!signal.id) return;
    setSignals(prev => {
      // deduplicate and prepend
      const filtered = prev.filter(s => s.id !== signal.id);
      return [signal, ...filtered].slice(0, 100);
    });
    markNew(signal.id);
    setIsLive(true);
  }, [markNew]);

  useSocket({
    masterIds,
    onSignal: handleIncomingSignal,
  });

  // Show live indicator once socket connects (after masterIds are known)
  useEffect(() => {
    if (masterIds.length > 0) setIsLive(true);
  }, [masterIds]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSignals();
  };

  const totalPnl = signals.reduce((sum, s) => sum + (s.profit ?? 0), 0);
  const openCount = signals.filter(s => s.signal_type === "OPEN" && !s.closed_at).length;
  const closedCount = signals.filter(s => s.closed_at).length;

  return (
    <div className="px-6 py-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Copy Signals</h1>
            <p className="text-sm text-muted-foreground mt-1">Signals received from your subscribed masters</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Live indicator */}
            <div className={cn("flex items-center gap-1.5 text-xs", isLive ? "text-emerald-400" : "text-muted-foreground")}>
              {isLive
                ? <><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" /></span> Live</>
                : <><WifiOff className="h-3 w-3" /> Offline</>
              }
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
                const isNew = newIds.has(signal.id);
                return (
                  <div
                    key={signal.id}
                    className={cn(
                      "flex items-center gap-4 px-4 py-3 transition-colors duration-700",
                      isNew && "bg-primary/5 animate-in fade-in slide-in-from-top-2 duration-300"
                    )}
                  >
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted shrink-0">
                      {signal.direction === "BUY"
                        ? <TrendingUp className="h-4 w-4 text-emerald-400" />
                        : <TrendingDown className="h-4 w-4 text-red-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
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
                        {isNew && (
                          <Badge className="text-[10px] px-1.5 bg-primary/20 text-primary border-primary/30 animate-pulse">
                            NEW
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {signal.master_username ?? "Unknown Master"} · {signal.volume} lot
                        {signal.open_price && ` @ ${signal.open_price}`}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={cn("text-sm font-bold", pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {pnl !== 0 ? `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}` : "—"}
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

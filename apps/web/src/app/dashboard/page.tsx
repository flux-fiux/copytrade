"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { TrendingUp, TrendingDown, ArrowUpRight, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/lib/api-client";
import { useSocket } from "@/hooks/useSocket";

interface CopyTradeRow {
  id: string;
  symbol: string;
  master_id: string;
  master_name?: string;
  direction: string;
  volume: number;
  profit?: number;
  created_at: string;
}

interface Subscription {
  id: string;
  master_id: string;
  status: string;
}

export default function DashboardPage() {
  const [displayName, setDisplayName] = useState("Trader");
  const [followerId, setFollowerId] = useState<string | undefined>();
  const [copyTrades, setCopyTrades] = useState<CopyTradeRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const markNew = useCallback((id: string) => {
    setNewIds(prev => new Set(prev).add(id));
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.set(id, setTimeout(() => {
      setNewIds(prev => { const s = new Set(prev); s.delete(id); return s; });
      timers.current.delete(id);
    }, 4000));
  }, []);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      if (session?.user?.id) setFollowerId(session.user.id);

      const [user, subs, trades] = await Promise.allSettled([
        token ? api.users.me(token) : Promise.reject(),
        fetch(`${apiUrl}/api/v1/subscriptions/my`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${apiUrl}/api/v1/copy-trades/?limit=20`, { headers }).then(r => r.ok ? r.json() : []),
      ]);

      if (user.status === "fulfilled") {
        setDisplayName(user.value.display_name ?? user.value.username ?? session?.user?.email?.split("@")[0] ?? "Trader");
      }
      if (subs.status === "fulfilled" && Array.isArray(subs.value)) setSubscriptions(subs.value);
      if (trades.status === "fulfilled" && Array.isArray(trades.value)) setCopyTrades(trades.value);
    } catch {
      // use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCopytrade = useCallback((data: Record<string, unknown>) => {
    const trade = data as unknown as CopyTradeRow;
    if (!trade.id) return;
    setCopyTrades(prev => {
      const filtered = prev.filter(t => t.id !== trade.id);
      return [trade, ...filtered].slice(0, 50);
    });
    markNew(trade.id);
  }, [markNew]);

  useSocket({ followerId, onCopytrade: handleCopytrade });

  const activeSubs = subscriptions.filter(s => s.status === "ACTIVE").length;
  const totalPnl = useMemo(
    () => copyTrades.reduce((s, t) => s + (t.profit ?? 0), 0),
    [copyTrades]
  );
  const todayTrades = useMemo(() => {
    const today = new Date().toDateString();
    return copyTrades.filter(t => new Date(t.created_at).toDateString() === today).length;
  }, [copyTrades]);

  return (
    <div className="px-6 py-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          {loading ? (
            <div className="h-7 w-48 rounded bg-muted/40 animate-pulse" />
          ) : (
            <h1 className="text-2xl font-bold">Welcome back, {displayName}</h1>
          )}
          <p className="text-muted-foreground mt-1 text-sm">Here&apos;s your portfolio overview</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Total P&L",
              value: loading ? "—" : `${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`,
              sub: "All copy trades",
              color: loading ? "" : totalPnl >= 0 ? "text-emerald-400" : "text-red-400",
            },
            {
              label: "Active Subscriptions",
              value: loading ? "—" : String(activeSubs),
              sub: activeSubs > 0 ? `${activeSubs} master${activeSubs !== 1 ? "s" : ""}` : "None yet",
              color: "",
            },
            {
              label: "Copy Trades Today",
              value: loading ? "—" : String(todayTrades),
              sub: todayTrades > 0 ? "Executed today" : "No trades today",
              color: "",
            },
            {
              label: "Total Copy Trades",
              value: loading ? "—" : String(copyTrades.length),
              sub: "All time",
              color: "",
            },
          ].map((s) => (
            <Card key={s.label} className="border-border/60">
              <CardContent className="p-4">
                {loading ? (
                  <div className="space-y-2">
                    <div className="h-3 w-20 rounded bg-muted/40 animate-pulse" />
                    <div className="h-6 w-16 rounded bg-muted/40 animate-pulse" />
                  </div>
                ) : (
                  <>
                    <div className="text-xs text-muted-foreground font-medium mb-1">{s.label}</div>
                    <div className={cn("text-xl font-bold", s.color)}>{s.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{s.sub}</div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent copy trades */}
        <Card className="border-border/60 mb-6">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-sm">Recent Copy Trades</h2>
              {followerId && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                  </span>
                  Live
                </span>
              )}
            </div>
            <Link href="/dashboard/signals" className="text-xs text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </div>

          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-10 rounded bg-muted/40 animate-pulse" />)}
            </div>
          ) : copyTrades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <TrendingUp className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No copy trades yet.</p>
              <p className="text-xs mt-1">Subscribe to a master to start copying.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {copyTrades.slice(0, 8).map((t) => {
                const pnl = t.profit ?? 0;
                const isNew = newIds.has(t.id);
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "flex items-center gap-4 px-4 py-3 transition-colors duration-700",
                      isNew && "bg-primary/5 animate-in fade-in slide-in-from-top-2 duration-300"
                    )}
                  >
                    <div className="font-mono text-sm font-semibold w-16">{t.symbol}</div>
                    <div className="flex-1 text-xs text-muted-foreground truncate">
                      {t.master_name ?? `${t.master_id.slice(0, 8)}…`}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5",
                        t.direction === "BUY" ? "text-emerald-400 border-emerald-500/30" : "text-red-400 border-red-500/30"
                      )}
                    >
                      {t.direction}
                    </Badge>
                    <div className="text-xs text-muted-foreground w-12 text-right">{t.volume}</div>
                    <div className={cn("text-sm font-bold w-20 text-right", pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                    </div>
                    {isNew && (
                      <Badge className="text-[10px] px-1.5 bg-primary/20 text-primary border-primary/30 animate-pulse shrink-0">
                        NEW
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Quick links */}
        <div className="flex gap-3 flex-wrap">
          <Link href="/dashboard/accounts" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}>
            <Plus className="h-4 w-4" /> Connect MT4 Account
          </Link>
          <Link href="/leaderboard" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}>
            <ArrowUpRight className="h-4 w-4" /> Browse Masters
          </Link>
          {activeSubs > 0 && (
            <Link href="/dashboard/subscriptions" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              My Subscriptions
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

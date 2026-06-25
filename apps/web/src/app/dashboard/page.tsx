"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import {
  TrendingUp, TrendingDown, ArrowUpRight, Plus, Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/lib/api-client";

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
  const [copyTrades, setCopyTrades] = useState<CopyTradeRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [totalPnl, setTotalPnl] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";

      const [user, subs, trades] = await Promise.allSettled([
        token ? api.users.me(token) : Promise.reject(),
        token ? fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/subscriptions/my`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.ok ? r.json() : []) : Promise.resolve([]),
        token ? fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/copy-trades/?limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.ok ? r.json() : []) : Promise.resolve([]),
      ]);

      if (user.status === "fulfilled") {
        setDisplayName(user.value.display_name ?? user.value.username ?? session?.user?.email?.split("@")[0] ?? "Trader");
      }
      if (subs.status === "fulfilled" && Array.isArray(subs.value)) {
        setSubscriptions(subs.value);
      }
      if (trades.status === "fulfilled" && Array.isArray(trades.value)) {
        setCopyTrades(trades.value);
        const pnl = (trades.value as CopyTradeRow[]).reduce((s, t) => s + (t.profit ?? 0), 0);
        setTotalPnl(pnl);
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeSubs = subscriptions.filter(s => s.status === "ACTIVE").length;
  const todayTrades = copyTrades.filter(t => {
    const d = new Date(t.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

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
                value: totalPnl !== null ? `${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}` : "—",
                sub: "All copy trades",
                up: totalPnl !== null ? totalPnl >= 0 : undefined,
              },
              {
                label: "Active Subscriptions",
                value: loading ? "—" : String(activeSubs),
                sub: activeSubs > 0 ? `${activeSubs} master${activeSubs !== 1 ? "s" : ""}` : "None yet",
              },
              {
                label: "Copy Trades Today",
                value: loading ? "—" : String(todayTrades),
                sub: todayTrades > 0 ? "Executed today" : "No trades today",
              },
              {
                label: "Total Copy Trades",
                value: loading ? "—" : String(copyTrades.length),
                sub: "All time",
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
                      <div className={cn(
                        "text-xl font-bold",
                        s.up === true ? "text-emerald-400" : s.up === false ? "text-red-400" : ""
                      )}>
                        {s.value}
                      </div>
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
              <h2 className="font-semibold text-sm">Recent Copy Trades</h2>
              <Link href="/dashboard/signals" className="text-xs text-muted-foreground hover:text-foreground">View all</Link>
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
                  const up = pnl >= 0;
                  return (
                    <div key={t.id} className="flex items-center gap-4 px-4 py-3">
                      <div className="font-mono text-sm font-semibold w-16">{t.symbol}</div>
                      <div className="flex-1 text-xs text-muted-foreground truncate">
                        {t.master_name ?? `${t.master_id.slice(0, 8)}…`}
                      </div>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] px-1.5", t.direction === "BUY" ? "text-emerald-400 border-emerald-500/30" : "text-red-400 border-red-500/30")}
                      >
                        {t.direction}
                      </Badge>
                      <div className="text-xs text-muted-foreground w-12 text-right">{t.volume}</div>
                      <div className={cn("text-sm font-bold w-16 text-right", up ? "text-emerald-400" : "text-red-400")}>
                        {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                      </div>
                      {up ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> : <TrendingDown className="h-3.5 w-3.5 text-red-400 shrink-0" />}
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
              <Link href="/dashboard/subscriptions" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}>
                My Subscriptions
              </Link>
            )}
          </div>
      </div>
    </div>
  );
}

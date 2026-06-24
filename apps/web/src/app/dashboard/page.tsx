"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Cpu, BookOpen, Radio, DollarSign, Settings,
  TrendingUp, TrendingDown, ArrowUpRight, Plus
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const sidebarLinks = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/accounts", label: "My Accounts", icon: Cpu },
  { href: "/dashboard/subscriptions", label: "Subscriptions", icon: BookOpen },
  { href: "/dashboard/signals", label: "Signals", icon: Radio },
  { href: "/dashboard/earnings", label: "Earnings", icon: DollarSign },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const statCards = [
  { label: "Portfolio Value", value: "$12,480", sub: "+$840 this month", up: true },
  { label: "Active Subscriptions", value: "3", sub: "AlphaWave, GoldPro, NightFX" },
  { label: "Monthly P&L", value: "+$840", sub: "+7.2% return", up: true },
  { label: "Copy Trades Today", value: "18", sub: "Across 3 masters" },
];

const recentTrades = [
  { symbol: "EURUSD", master: "AlphaWave FX", dir: "BUY", volume: "0.10", pnl: "+$24.80", up: true },
  { symbol: "XAUUSD", master: "GoldTrader Pro", dir: "SELL", volume: "0.05", pnl: "+$41.20", up: true },
  { symbol: "GBPUSD", master: "NightScalper", dir: "BUY", volume: "0.08", pnl: "-$12.40", up: false },
  { symbol: "USDJPY", master: "AlphaWave FX", dir: "SELL", volume: "0.10", pnl: "+$18.60", up: true },
  { symbol: "BTCUSD", master: "GoldTrader Pro", dir: "BUY", volume: "0.01", pnl: "-$8.20", up: false },
];

function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 border-r border-border/50 shrink-0 flex flex-col">
      <div className="px-4 py-4 border-b border-border/50">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dashboard</div>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {sidebarLinks.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href) && !exact ? pathname.startsWith(href) : false;
          const isActive = exact ? pathname === href : pathname.startsWith(href) && pathname !== "/dashboard";
          const finalActive = exact ? pathname === href : isActive;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                finalActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex h-[calc(100vh-64px)]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Welcome back, Trader</h1>
            <p className="text-muted-foreground mt-1 text-sm">Here&apos;s your portfolio overview</p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statCards.map((s) => (
              <Card key={s.label} className="border-border/60">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground font-medium mb-1">{s.label}</div>
                  <div className={cn("text-xl font-bold", s.up === true ? "text-emerald-400" : s.up === false ? "text-red-400" : "")}>
                    {s.value}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{s.sub}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent copy trades */}
          <Card className="border-border/60 mb-6">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <h2 className="font-semibold text-sm">Recent Copy Trades</h2>
              <Link href="/dashboard/trades" className="text-xs text-muted-foreground hover:text-foreground">View all</Link>
            </div>
            <div className="divide-y divide-border/50">
              {recentTrades.map((t, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <div className="font-mono text-sm font-semibold w-16">{t.symbol}</div>
                  <div className="flex-1 text-xs text-muted-foreground">{t.master}</div>
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] px-1.5", t.dir === "BUY" ? "text-emerald-400 border-emerald-500/30" : "text-red-400 border-red-500/30")}
                  >
                    {t.dir}
                  </Badge>
                  <div className="text-xs text-muted-foreground w-12 text-right">{t.volume}</div>
                  <div className={cn("text-sm font-bold w-16 text-right", t.up ? "text-emerald-400" : "text-red-400")}>
                    {t.pnl}
                  </div>
                  {t.up ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> : <TrendingDown className="h-3.5 w-3.5 text-red-400" />}
                </div>
              ))}
            </div>
          </Card>

          {/* Quick links */}
          <div className="flex gap-3">
            <Link href="/dashboard/accounts" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}>
              <Plus className="h-4 w-4" /> Connect MT4 Account
            </Link>
            <Link href="/leaderboard" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}>
              <ArrowUpRight className="h-4 w-4" /> Browse Masters
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

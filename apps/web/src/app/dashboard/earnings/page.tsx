"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Cpu, BookOpen, Radio, DollarSign, Settings,
  TrendingUp, TrendingDown, Wallet, ArrowUpRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const sidebarLinks = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/accounts", label: "My Accounts", icon: Cpu },
  { href: "/dashboard/subscriptions", label: "Subscriptions", icon: BookOpen },
  { href: "/dashboard/signals", label: "Signals", icon: Radio },
  { href: "/dashboard/earnings", label: "Earnings", icon: DollarSign },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const monthlyData = [
  { month: "Jan 2026", subscription: 580, performance: 0, payout: 464, status: "PAID" },
  { month: "Feb 2026", subscription: 720, performance: 148, payout: 694.40, status: "PAID" },
  { month: "Mar 2026", subscription: 840, performance: 223, payout: 849.60, status: "PAID" },
  { month: "Apr 2026", subscription: 960, performance: 187, payout: 918.40, status: "PAID" },
  { month: "May 2026", subscription: 1080, performance: 312, payout: 1113.60, status: "PAID" },
  { month: "Jun 2026", subscription: 1240, performance: 0, payout: 992, status: "PENDING" },
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
          const active = exact ? pathname === href : pathname.startsWith(href) && pathname !== "/dashboard";
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
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

export default function EarningsPage() {
  const totalEarned = monthlyData.filter(m => m.status === "PAID").reduce((s, m) => s + m.payout, 0);
  const pending = monthlyData.filter(m => m.status === "PENDING").reduce((s, m) => s + m.payout, 0);
  const totalFollowers = 1240;
  const avgMonthlyGrowth = 16.4;

  return (
    <div className="flex h-[calc(100vh-64px)]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Earnings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Your income as a signal provider — platform takes 20%, you keep 80%
            </p>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            <Card className="border-border/60">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Total Earned</div>
                <div className="text-xl font-bold mt-1 text-emerald-400">${totalEarned.toLocaleString("en", { minimumFractionDigits: 2 })}</div>
                <div className="text-[10px] text-muted-foreground mt-1">Lifetime</div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Pending</div>
                <div className="text-xl font-bold mt-1 text-yellow-400">${pending.toFixed(2)}</div>
                <div className="text-[10px] text-muted-foreground mt-1">This month</div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Followers</div>
                <div className="text-xl font-bold mt-1">{totalFollowers.toLocaleString()}</div>
                <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-emerald-400" /> Active
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">MoM Growth</div>
                <div className="text-xl font-bold mt-1 text-blue-400">+{avgMonthlyGrowth}%</div>
                <div className="text-[10px] text-muted-foreground mt-1">Subscriber revenue</div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue breakdown */}
          <Card className="border-border/60 mb-6">
            <div className="px-4 py-3 border-b border-border/50">
              <h2 className="text-sm font-semibold">Revenue Breakdown</h2>
            </div>
            <div className="p-4 grid grid-cols-3 gap-4 text-sm">
              <div className="rounded-lg bg-muted/40 p-4">
                <div className="text-xs text-muted-foreground mb-1">Subscription Revenue</div>
                <div className="text-lg font-bold">80%</div>
                <div className="text-xs text-muted-foreground mt-1">Your cut after platform fee</div>
              </div>
              <div className="rounded-lg bg-muted/40 p-4">
                <div className="text-xs text-muted-foreground mb-1">Performance Fee</div>
                <div className="text-lg font-bold">80%</div>
                <div className="text-xs text-muted-foreground mt-1">High-water mark basis</div>
              </div>
              <div className="rounded-lg bg-muted/40 p-4">
                <div className="text-xs text-muted-foreground mb-1">Platform Fee</div>
                <div className="text-lg font-bold text-muted-foreground">20%</div>
                <div className="text-xs text-muted-foreground mt-1">Deducted automatically</div>
              </div>
            </div>
          </Card>

          {/* Monthly history */}
          <Card className="border-border/60">
            <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Monthly History</h2>
              <span className="text-xs text-muted-foreground">Paid via USDT</span>
            </div>
            <div className="divide-y divide-border/50">
              {[...monthlyData].reverse().map((row) => (
                <div key={row.month} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{row.month}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Sub: ${row.subscription} + Perf: ${row.performance}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-emerald-400">${row.payout.toFixed(2)}</div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] w-16 justify-center",
                      row.status === "PAID" ? "text-emerald-400 border-emerald-500/30" : "text-yellow-400 border-yellow-500/30"
                    )}
                  >
                    {row.status}
                  </Badge>
                  {row.status === "PAID" ? (
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Payout info */}
          <div className="mt-4 flex items-start gap-3 text-xs text-muted-foreground bg-muted/30 border border-border/50 rounded-lg p-4">
            <Wallet className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              Payouts are processed on the 1st of each month via USDT (TRC20) to your registered wallet address.
              Performance fees are calculated using the high-water mark method.{" "}
              <Link href="/dashboard/settings" className="text-foreground hover:underline inline-flex items-center gap-1">
                Manage payout wallet <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

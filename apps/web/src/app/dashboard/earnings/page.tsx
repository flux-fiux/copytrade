"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface EarningRow {
  month: string;
  subscription_usd: number;
  performance_usd: number;
  payout_usd: number;
  status: "PAID" | "PENDING";
}

interface EarningsSummary {
  total_earned: number;
  pending: number;
  followers_count: number;
  monthly_history: EarningRow[];
}

const MOCK: EarningsSummary = {
  total_earned: 4039.60,
  pending: 992,
  followers_count: 1240,
  monthly_history: [
    { month: "Jun 2026", subscription_usd: 1240, performance_usd: 0, payout_usd: 992, status: "PENDING" },
    { month: "May 2026", subscription_usd: 1080, performance_usd: 312, payout_usd: 1113.60, status: "PAID" },
    { month: "Apr 2026", subscription_usd: 960, performance_usd: 187, payout_usd: 918.40, status: "PAID" },
    { month: "Mar 2026", subscription_usd: 840, performance_usd: 223, payout_usd: 849.60, status: "PAID" },
    { month: "Feb 2026", subscription_usd: 720, performance_usd: 148, payout_usd: 694.40, status: "PAID" },
    { month: "Jan 2026", subscription_usd: 580, performance_usd: 0, payout_usd: 464, status: "PAID" },
  ],
};

export default function EarningsPage() {
  const [data, setData] = useState<EarningsSummary>(MOCK);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setLoading(false); return; }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/v1/users/me/earnings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // use mock
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="px-6 py-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Earnings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your income as a signal provider — platform takes 20%, you keep 80%
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading earnings…
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Total Earned</div>
                  <div className="text-xl font-bold mt-1 text-emerald-400">
                    ${data.total_earned.toLocaleString("en", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">Lifetime</div>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Pending</div>
                  <div className="text-xl font-bold mt-1 text-yellow-400">${data.pending.toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">This month</div>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Active Followers</div>
                  <div className="text-xl font-bold mt-1">{data.followers_count.toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-emerald-400" /> Copying now
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Revenue breakdown */}
            <Card className="border-border/60 mb-6">
              <div className="px-4 py-3 border-b border-border/50">
                <h2 className="text-sm font-semibold">Revenue Split</h2>
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
                {data.monthly_history.map((row) => (
                  <div key={row.month} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{row.month}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Sub: ${row.subscription_usd} + Perf: ${row.performance_usd}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-emerald-400">${row.payout_usd.toFixed(2)}</div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] w-16 justify-center",
                        row.status === "PAID"
                          ? "text-emerald-400 border-emerald-500/30"
                          : "text-yellow-400 border-yellow-500/30"
                      )}
                    >
                      {row.status}
                    </Badge>
                    {row.status === "PAID"
                      ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      : <TrendingDown className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                    }
                  </div>
                ))}
              </div>
            </Card>

            <div className="mt-4 flex items-start gap-3 text-xs text-muted-foreground bg-muted/30 border border-border/50 rounded-lg p-4">
              <Wallet className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                Payouts are processed on the 1st of each month via USDT (TRC20) to your registered wallet address.
                Performance fees use the high-water mark method.{" "}
                <Link href="/dashboard/settings" className="text-foreground hover:underline inline-flex items-center gap-1">
                  Manage payout wallet <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

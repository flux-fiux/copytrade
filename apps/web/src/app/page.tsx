import Link from "next/link";
import { TrendingUp, BarChart2, Shield, Users, ArrowRight, Star, CheckCircle2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface LiveMaster {
  master_id: string;
  username: string;
  return_pct: number;
  max_drawdown: number;
  win_rate: number;
  followers_count: number;
  risk_grade: string;
  trading_days: number;
}

const FALLBACK_MASTERS: LiveMaster[] = [
  { master_id: "1", username: "AlphaWave FX", return_pct: 142.3, max_drawdown: 8.2, win_rate: 68.4, followers_count: 1240, risk_grade: "A+", trading_days: 385 },
  { master_id: "2", username: "GoldTrader Pro", return_pct: 98.7, max_drawdown: 11.4, win_rate: 61.2, followers_count: 876, risk_grade: "A", trading_days: 248 },
  { master_id: "3", username: "Momentum King", return_pct: 76.1, max_drawdown: 14.9, win_rate: 58.7, followers_count: 654, risk_grade: "B+", trading_days: 192 },
];

async function fetchTopMasters(): Promise<LiveMaster[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/leaderboard/?period=1M&page=1&per_page=3`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return FALLBACK_MASTERS;
    const data = await res.json();
    const entries: LiveMaster[] = (data.entries ?? []).slice(0, 3);
    return entries.length > 0 ? entries : FALLBACK_MASTERS;
  } catch {
    return FALLBACK_MASTERS;
  }
}

const features = [
  {
    icon: TrendingUp,
    title: "Copy Top Traders",
    description: "Follow verified signal providers and automatically replicate their trades in real-time across MT4/MT5 accounts.",
  },
  {
    icon: BarChart2,
    title: "Financial Terminal",
    description: "Professional charts, real-time quotes, economic calendar, and market screener — all in one place.",
  },
  {
    icon: Shield,
    title: "Risk Management",
    description: "Set drawdown limits, lot size multipliers, and symbol filters. Auto-pause if risk thresholds are breached.",
  },
  {
    icon: Users,
    title: "Community Rankings",
    description: "Transparent leaderboards with Sharpe ratio, max drawdown, win rate, and independently verified track records.",
  },
];

const gradeColor: Record<string, string> = {
  "A+": "text-emerald-400",
  "A": "text-green-400",
  "B+": "text-blue-400",
  "B": "text-yellow-400",
};

const trustPoints = [
  "Verified track records — no demo accounts",
  "Transparent drawdown & Sharpe ratio for every Master",
  "Instant copy execution via MetaAPI (< 5ms)",
];

export default async function HomePage() {
  const topMasters = await fetchTopMasters();

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-background to-background/80 py-24 px-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="container mx-auto relative text-center max-w-3xl">
          <Badge variant="outline" className="mb-6 border-primary/30 text-primary">
            <Star className="mr-1 h-3 w-3" /> Now in Beta — Free to join
          </Badge>
          <h1 className="text-3xl sm:text-5xl xl:text-7xl font-bold tracking-tight mb-6 leading-tight">
            Copy the World&apos;s Best<br />
            <span className="text-primary">Forex Traders</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-6 max-w-xl mx-auto leading-relaxed">
            Connect your MT4/MT5 account, subscribe to verified signal providers, and let our engine replicate every trade automatically.
          </p>
          <ul className="flex flex-col sm:flex-row gap-2 justify-center mb-8">
            {trustPoints.map((p) => (
              <li key={p} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                {p}
              </li>
            ))}
          </ul>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth/register" className={cn(buttonVariants({ size: "lg" }))}>
              Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link href="/leaderboard" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
              Browse Masters
            </Link>
          </div>
        </div>
      </section>

      {/* Top Masters Preview — SSR live data */}
      <section className="py-16 px-4 border-b border-border/40">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold">Top Signal Providers</h2>
              <p className="text-muted-foreground mt-1">Ranked by risk-adjusted returns this month</p>
            </div>
            <Link href="/leaderboard" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              View All <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {topMasters.map((m, i) => (
              <Link
                key={m.master_id}
                href={`/masters/${m.master_id}`}
                className="block"
              >
                <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="text-2xl font-bold text-muted-foreground/40 w-8 shrink-0">#{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{m.username}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.trading_days}d verified · {m.followers_count.toLocaleString()} followers · Win {m.win_rate.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-muted-foreground">Max DD</div>
                      <div className="text-sm font-medium text-destructive">{m.max_drawdown.toFixed(1)}%</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Return</div>
                      <div className="text-sm font-bold text-emerald-400">+{m.return_pct.toFixed(1)}%</div>
                    </div>
                    <div className={cn("text-lg font-bold shrink-0", gradeColor[m.risk_grade] ?? "text-muted-foreground")}>
                      {m.risk_grade}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 border-b border-border/40">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-center mb-12">Everything you need to trade smarter</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="border-border/60">
                <CardContent className="p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-4">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-muted/20 text-center">
        <div className="container mx-auto max-w-xl">
          <h2 className="text-2xl font-bold mb-3">Ready to start copying?</h2>
          <p className="text-muted-foreground mb-8">
            Connect your MT4/MT5 account in minutes. No technical setup required.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth/register" className={cn(buttonVariants({ size: "lg" }))}>
              Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link href="/terminal" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
              Open Terminal
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

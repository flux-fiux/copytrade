import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, Users, Calendar, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SubscriptionCard } from "@/components/masters/subscription-card";
import { EquityCurve } from "@/components/masters/equity-curve";
import { TradeCalendar } from "@/components/masters/trade-calendar";
import { StatsRadar } from "@/components/masters/stats-radar";
import { RecentTradesTable } from "@/components/masters/recent-trades-table";
import { AiSummary } from "@/components/masters/ai-summary";
import { api } from "@/lib/api-client";

interface Trade {
  id: string;
  symbol: string;
  direction: "BUY" | "SELL";
  volume: number;
  openPrice: number;
  closePrice?: number;
  profit?: number;
  openedAt: string;
  closedAt?: string;
  status: "OPEN" | "CLOSED";
}

function getMockMasterData(id: string) {
  const names: Record<string, string> = {
    "1": "AlphaWave FX",
    "2": "GoldTrader Pro",
    "3": "Momentum King",
  };
  const name = names[id] ?? `Master ${id}`;

  const equityCurve = Array.from({ length: 180 }, (_, i) => {
    const date = new Date(Date.now() - (180 - i) * 86400000);
    const equity = 10000 * (1 + (i / 180) * 1.42 + Math.sin(i / 10) * 0.02);
    const peak = 10000 * (1 + (i / 180) * 1.45);
    return {
      date: date.toISOString().slice(0, 10),
      equity: Math.round(equity),
      drawdown: Math.max(0, (peak - equity) / peak * 100),
    };
  });

  const calendar = Array.from({ length: 90 }, (_, i) => {
    const date = new Date(Date.now() - (90 - i) * 86400000);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return null;
    const pnl = ((i * 7 + 3) % 10 > 6 ? -1 : 1) * ((i * 13 + 7) % 800);
    return {
      date: date.toISOString().slice(0, 10),
      pnl: Math.round(pnl * 100) / 100,
      trades: (i % 5) + 1,
    };
  }).filter((d): d is { date: string; pnl: number; trades: number } => d !== null);

  const recentTrades: Trade[] = Array.from({ length: 10 }, (_, i) => ({
    id: `t${i}`,
    symbol: ["EURUSD", "XAUUSD", "GBPUSD", "USDJPY"][i % 4],
    direction: (i % 3 === 0 ? "SELL" : "BUY") as "BUY" | "SELL",
    volume: Math.round(0.1 * (i + 1) * 10) / 10,
    openPrice: 1.08234 + i * 0.001,
    closePrice: i % 5 === 0 ? undefined : 1.08434 + i * 0.001,
    profit: i % 5 === 0 ? undefined : (i % 3 === 0 ? -1 : 1) * (i * 47 + 23),
    openedAt: new Date(Date.now() - i * 3600000 * 6).toISOString(),
    closedAt: i % 5 === 0 ? undefined : new Date(Date.now() - i * 3600000 * 4).toISOString(),
    status: (i % 5 === 0 ? "OPEN" : "CLOSED") as "OPEN" | "CLOSED",
  }));

  return {
    id,
    name,
    bio: "Professional FX trader with 8+ years experience. Specializing in EUR/USD and XAU/USD with a momentum-based systematic approach.",
    return_pct: 142.3,
    max_drawdown: 8.2,
    sharpe: 2.84,
    sortino: 3.12,
    win_rate: 68.4,
    followers: 1240,
    trading_days: 385,
    grade: "A+",
    profit_factor: 2.41,
    total_trades: 2847,
    equityCurve,
    calendar,
    recentTrades,
  };
}

export const dynamic = "force-dynamic";

const gradeColors: Record<string, string> = {
  "A+": "border-emerald-500/50 text-emerald-400 bg-emerald-500/10",
  "A": "border-green-500/50 text-green-400 bg-green-500/10",
  "B+": "border-blue-500/50 text-blue-400 bg-blue-500/10",
  "B": "border-yellow-500/50 text-yellow-400 bg-yellow-500/10",
};

export default async function MasterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let apiMaster: { username?: string; display_name?: string } | null = null;
  let apiScore: { total_return_pct?: number; max_drawdown_pct?: number; sharpe_ratio?: number; win_rate_pct?: number; risk_grade?: string } | null = null;
  let apiSignals: { id: string; symbol: string; direction: string; volume: number; open_price?: number; profit?: number; opened_at: string; closed_at?: string }[] = [];

  try {
    const detail = await api.leaderboard.getMaster(id);
    apiMaster = detail.master;
    apiScore = detail.score;
    apiSignals = detail.recent_signals ?? [];
  } catch {
    // API not available — fall back to mock
  }

  const mockData = getMockMasterData(id);
  const master = {
    ...mockData,
    name: apiMaster?.display_name ?? apiMaster?.username ?? mockData.name,
    return_pct: apiScore?.total_return_pct ?? mockData.return_pct,
    max_drawdown: apiScore?.max_drawdown_pct ?? mockData.max_drawdown,
    sharpe: apiScore?.sharpe_ratio ?? mockData.sharpe,
    win_rate: apiScore?.win_rate_pct ?? mockData.win_rate,
    grade: apiScore?.risk_grade ?? mockData.grade,
    recentTrades: apiSignals.length > 0
      ? apiSignals.map((s, i) => ({
          id: s.id,
          symbol: s.symbol,
          direction: s.direction as "BUY" | "SELL",
          volume: s.volume,
          openPrice: s.open_price ?? 0,
          profit: s.profit,
          openedAt: s.opened_at,
          closedAt: s.closed_at,
          status: (s.closed_at ? "CLOSED" : "OPEN") as "OPEN" | "CLOSED",
        }))
      : mockData.recentTrades,
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Link href="/leaderboard" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-6 -ml-2")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Leaderboard
        </Link>

        {/* Header */}
        <div className="flex flex-col lg:flex-row gap-6 mb-8">
          <div className="flex-1">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary shrink-0">
                {master.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold">{master.name}</h1>
                  <Badge className={cn("text-sm font-bold px-2.5 border", gradeColors[master.grade] ?? "")}>
                    {master.grade}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1 text-sm max-w-xl">{master.bio}</p>
                <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />{master.followers.toLocaleString()} followers
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />{master.trading_days} days track record
                  </span>
                  <span className="flex items-center gap-1">
                    <Award className="h-3.5 w-3.5" />{master.total_trades.toLocaleString()} trades
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:w-72 shrink-0">
            <Suspense fallback={<div className="h-48 rounded-lg bg-muted/30 animate-pulse" />}>
              <SubscriptionCard masterId={id} />
            </Suspense>
          </div>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {[
            { label: "Total Return", value: `+${master.return_pct}%`, color: "text-emerald-400" },
            { label: "Max Drawdown", value: `${master.max_drawdown}%`, color: "text-red-400" },
            { label: "Sharpe Ratio", value: master.sharpe.toFixed(2), color: "text-blue-400" },
            { label: "Sortino", value: master.sortino.toFixed(2), color: "text-blue-400" },
            { label: "Win Rate", value: `${master.win_rate}%`, color: "text-amber-400" },
            { label: "Profit Factor", value: master.profit_factor.toFixed(2), color: "text-purple-400" },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
              <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
          <div className="xl:col-span-2 rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-4">Equity Curve &amp; Drawdown</h3>
            <EquityCurve data={master.equityCurve} />
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-4">Performance Profile</h3>
            <StatsRadar
              winRate={master.win_rate}
              sharpe={master.sharpe}
              returnPct={master.return_pct}
              consistency={82}
              riskScore={100 - master.max_drawdown * 3}
            />
          </div>
        </div>

        {/* Trade Calendar */}
        <div className="rounded-lg border border-border bg-card p-5 mb-8">
          <h3 className="text-sm font-semibold mb-4">Daily P&amp;L Calendar (Last 90 days)</h3>
          <TradeCalendar data={master.calendar} />
        </div>

        {/* AI Strategy Analysis */}
        <div className="mb-8">
          <AiSummary masterId={id} />
        </div>

        {/* Recent Trades */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Recent Trades</h3>
          <RecentTradesTable trades={master.recentTrades} />
        </div>
      </div>
    </div>
  );
}

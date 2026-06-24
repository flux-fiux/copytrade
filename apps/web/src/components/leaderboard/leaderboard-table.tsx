"use client";

import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowUpRight, Users, TrendingUp } from "lucide-react";
import type { LeaderboardEntry } from "@/lib/api-client";

interface Master {
  id: string;
  rank: number;
  name: string;
  return_pct: number;
  max_drawdown: number;
  sharpe: number;
  win_rate: number;
  followers: number;
  trading_days: number;
  grade: string;
}

const MOCK_DATA: Master[] = [
  { id: "1", rank: 1, name: "AlphaWave FX", return_pct: 142.3, max_drawdown: 8.2, sharpe: 2.84, win_rate: 68.4, followers: 1240, trading_days: 385, grade: "A+" },
  { id: "2", rank: 2, name: "GoldTrader Pro", return_pct: 98.7, max_drawdown: 11.4, sharpe: 2.31, win_rate: 61.2, followers: 876, trading_days: 248, grade: "A" },
  { id: "3", rank: 3, name: "Momentum King", return_pct: 76.1, max_drawdown: 14.9, sharpe: 1.92, win_rate: 58.7, followers: 654, trading_days: 192, grade: "B+" },
  { id: "4", rank: 4, name: "SilverBull FX", return_pct: 61.4, max_drawdown: 12.1, sharpe: 1.74, win_rate: 62.3, followers: 412, trading_days: 310, grade: "B+" },
  { id: "5", rank: 5, name: "NightScalper", return_pct: 54.8, max_drawdown: 18.3, sharpe: 1.44, win_rate: 71.2, followers: 321, trading_days: 156, grade: "B" },
  { id: "6", rank: 6, name: "CryptoTrend AI", return_pct: 49.2, max_drawdown: 22.7, sharpe: 1.21, win_rate: 55.1, followers: 289, trading_days: 98, grade: "B" },
  { id: "7", rank: 7, name: "GridMaster EU", return_pct: 38.6, max_drawdown: 9.8, sharpe: 1.68, win_rate: 58.4, followers: 198, trading_days: 412, grade: "A" },
  { id: "8", rank: 8, name: "SwingKing AU", return_pct: 31.2, max_drawdown: 16.4, sharpe: 1.14, win_rate: 52.8, followers: 143, trading_days: 204, grade: "B" },
];

function apiEntriesToMasters(entries: LeaderboardEntry[]): Master[] {
  return entries.map(e => ({
    id: e.master_id,
    rank: e.rank,
    name: e.username,
    return_pct: e.return_pct,
    max_drawdown: e.max_drawdown,
    sharpe: e.sharpe_ratio,
    win_rate: e.win_rate,
    followers: e.followers_count,
    trading_days: e.trading_days,
    grade: e.risk_grade,
  }));
}

const gradeStyles: Record<string, string> = {
  "A+": "border-emerald-500/50 text-emerald-400 bg-emerald-500/10",
  "A": "border-green-500/50 text-green-400 bg-green-500/10",
  "B+": "border-blue-500/50 text-blue-400 bg-blue-500/10",
  "B": "border-yellow-500/50 text-yellow-400 bg-yellow-500/10",
  "C": "border-orange-500/50 text-orange-400 bg-orange-500/10",
  "D": "border-red-500/50 text-red-400 bg-red-500/10",
};

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-yellow-400 font-bold text-lg">🥇</span>;
  if (rank === 2) return <span className="text-zinc-300 font-bold text-lg">🥈</span>;
  if (rank === 3) return <span className="text-amber-600 font-bold text-lg">🥉</span>;
  return <span className="text-muted-foreground font-medium text-sm">#{rank}</span>;
}

interface Props {
  apiEntries?: LeaderboardEntry[] | null;
}

export function LeaderboardTable({ apiEntries }: Props) {
  const data = apiEntries && apiEntries.length > 0 ? apiEntriesToMasters(apiEntries) : MOCK_DATA;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="grid grid-cols-[2.5rem_1fr_auto_auto] md:grid-cols-[2.5rem_1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-3 bg-muted/40 text-xs text-muted-foreground font-medium uppercase tracking-wide border-b border-border">
        <div>#</div>
        <div>Provider</div>
        <div className="text-right hidden lg:block">Return</div>
        <div className="text-right hidden md:block">Max DD</div>
        <div className="text-right hidden xl:block">Sharpe</div>
        <div className="text-right hidden md:block">Followers</div>
        <div className="text-right">Grade</div>
      </div>

      {data.map((master) => (
        <Link
          key={master.id}
          href={`/masters/${master.id}`}
          className="grid grid-cols-[2.5rem_1fr_auto_auto] md:grid-cols-[2.5rem_1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-4 items-center border-b border-border/50 hover:bg-muted/30 transition-colors group"
        >
          <div className="flex justify-center"><RankBadge rank={master.rank} /></div>

          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                {master.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <span className="font-semibold truncate block">{master.name}</span>
              <span className="text-xs text-muted-foreground">{master.trading_days}d track record</span>
            </div>
          </div>

          <div className="text-right hidden lg:block">
            <div className="flex items-center justify-end gap-1 text-emerald-400 font-bold">
              <TrendingUp className="h-3.5 w-3.5" />
              +{master.return_pct.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Win {master.win_rate.toFixed(0)}%</div>
          </div>

          <div className="text-right hidden md:block">
            <div className="text-destructive font-medium text-sm">{master.max_drawdown.toFixed(1)}%</div>
            <Progress value={master.max_drawdown} max={30} className="h-1 w-16 mt-1.5 ml-auto [&>div]:bg-destructive/60" />
          </div>

          <div className="text-right hidden xl:block">
            <div className="font-medium text-sm">{master.sharpe.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Sharpe</div>
          </div>

          <div className="text-right hidden md:block">
            <div className="flex items-center justify-end gap-1 text-sm">
              <Users className="h-3 w-3 text-muted-foreground" />
              {master.followers.toLocaleString()}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className={`text-xs font-bold px-2 border ${gradeStyles[master.grade] ?? ""}`}>
              {master.grade}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              className="hidden group-hover:flex h-7 px-2 gap-1 text-xs"
              onClick={(e) => e.preventDefault()}
            >
              Copy <ArrowUpRight className="h-3 w-3" />
            </Button>
          </div>
        </Link>
      ))}

      <div className="px-4 py-4 text-center border-t border-border/50">
        <Button variant="outline" size="sm">Load more traders</Button>
      </div>
    </div>
  );
}

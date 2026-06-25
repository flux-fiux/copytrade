import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Users, Award, Activity } from "lucide-react";

export interface PlatformStats {
  verified_providers: number;
  active_followers: number;
  avg_sharpe: number;
  trades_today: number;
}

const FALLBACK: PlatformStats = {
  verified_providers: 0,
  active_followers: 0,
  avg_sharpe: 0,
  trades_today: 0,
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function LeaderboardStats({ data }: { data?: PlatformStats | null }) {
  const s = data ?? FALLBACK;

  const stats = [
    { label: "Verified Providers", value: fmt(s.verified_providers), icon: Award, sub: "On-chain audited" },
    { label: "Active Followers",   value: fmt(s.active_followers),   icon: Users, sub: "Unique subscribers" },
    { label: "Avg Sharpe Ratio",   value: s.avg_sharpe.toFixed(2),  icon: TrendingUp, sub: "Top masters" },
    { label: "Trades Today",       value: fmt(s.trades_today),       icon: Activity, sub: "Live copying" },
  ] as const;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(({ label, value, icon: Icon, sub }) => (
        <Card key={label} className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{sub}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

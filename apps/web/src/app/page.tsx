import Link from "next/link";
import { TrendingUp, BarChart2, Shield, Users, ArrowRight, Star } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const stats = [
  { label: "Active Traders", value: "12,400+" },
  { label: "Copy Trades Executed", value: "2.8M+" },
  { label: "Avg Monthly Return", value: "8.4%" },
  { label: "Countries", value: "80+" },
];

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

const topMasters = [
  { name: "AlphaWave FX", return: "+142.3%", drawdown: "8.2%", followers: 1240, grade: "A+", period: "12M" },
  { name: "GoldTrader Pro", return: "+98.7%", drawdown: "11.4%", followers: 876, grade: "A", period: "8M" },
  { name: "Momentum King", return: "+76.1%", drawdown: "14.9%", followers: 654, grade: "B+", period: "6M" },
];

const gradeColor: Record<string, string> = {
  "A+": "text-emerald-400",
  "A": "text-green-400",
  "B+": "text-blue-400",
  "B": "text-yellow-400",
};

export default function HomePage() {
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
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto leading-relaxed">
            Connect your MT4/MT5 account, subscribe to verified signal providers, and let our engine replicate every trade automatically.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/leaderboard" className={cn(buttonVariants({ size: "lg" }))}>
              Browse Traders <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link href="/terminal" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
              Open Terminal
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-border/40 bg-muted/20 py-10 px-4">
        <div className="container mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Top Masters Preview */}
      <section className="py-16 px-4 border-b border-border/40">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold">Top Signal Providers</h2>
              <p className="text-muted-foreground mt-1">Ranked by risk-adjusted returns</p>
            </div>
            <Link href="/leaderboard" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              View All <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {topMasters.map((m, i) => (
              <Card key={m.name} className="hover:border-primary/40 transition-colors cursor-pointer">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="text-2xl font-bold text-muted-foreground/40 w-8">#{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{m.name}</div>
                    <div className="text-xs text-muted-foreground">{m.period} verified • {m.followers.toLocaleString()} followers</div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="text-xs text-muted-foreground">Max DD</div>
                    <div className="text-sm font-medium text-destructive">{m.drawdown}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Return</div>
                    <div className="text-sm font-bold text-emerald-400">{m.return}</div>
                  </div>
                  <div className={`text-lg font-bold ${gradeColor[m.grade] ?? "text-muted-foreground"}`}>
                    {m.grade}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-center mb-12">Everything you need to trade smarter</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
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
      <section className="py-16 px-4 border-t border-border/40 bg-muted/20 text-center">
        <div className="container mx-auto max-w-xl">
          <h2 className="text-2xl font-bold mb-3">Ready to start copying?</h2>
          <p className="text-muted-foreground mb-8">Connect your MT4/MT5 account in minutes. No technical setup required.</p>
          <Link href="/auth/register" className={cn(buttonVariants({ size: "lg" }))}>
            Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

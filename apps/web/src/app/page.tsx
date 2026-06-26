import Link from "next/link";
import {
  TrendingUp, BarChart2, Shield, Users, ArrowRight, CheckCircle2,
  Zap, FlaskConical, Brain, Calculator, Clock, Globe, ChevronRight,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Hero } from "@/components/marketing/hero";
import { PriceTicker } from "@/components/marketing/price-ticker";
import { Modules } from "@/components/marketing/modules";
import { AiSpotlight } from "@/components/marketing/ai-spotlight";

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
  { master_id: "1", username: "AlphaWave FX",   return_pct: 142.3, max_drawdown: 8.2,  win_rate: 68.4, followers_count: 1240, risk_grade: "A+", trading_days: 385 },
  { master_id: "2", username: "GoldTrader Pro",  return_pct: 98.7,  max_drawdown: 11.4, win_rate: 61.2, followers_count: 876,  risk_grade: "A",  trading_days: 248 },
  { master_id: "3", username: "Momentum King",   return_pct: 76.1,  max_drawdown: 14.9, win_rate: 58.7, followers_count: 654,  risk_grade: "B+", trading_days: 192 },
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

const gradeColor: Record<string, string> = {
  "A+": "text-emerald-400", "A": "text-green-400",
  "B+": "text-blue-400",    "B": "text-yellow-400",
};

export default async function HomePage() {
  const [topMasters, t] = await Promise.all([fetchTopMasters(), getTranslations("home")]);

  const HOW_IT_WORKS = [
    { step: "01", title: t("how1_title"), desc: t("how1_desc"), cta: "dashboard/accounts" },
    { step: "02", title: t("how2_title"), desc: t("how2_desc"), cta: "leaderboard" },
    { step: "03", title: t("how3_title"), desc: t("how3_desc"), cta: "dashboard" },
  ];

  const FEATURES = [
    { icon: TrendingUp,   title: t("feat1_title"), desc: t("feat1_desc") },
    { icon: FlaskConical, title: t("feat2_title"), desc: t("feat2_desc") },
    { icon: BarChart2,    title: t("feat3_title"), desc: t("feat3_desc") },
    { icon: Shield,       title: t("feat4_title"), desc: t("feat4_desc") },
    { icon: Brain,        title: t("feat5_title"), desc: t("feat5_desc") },
    { icon: Calculator,   title: t("feat6_title"), desc: t("feat6_desc") },
    { icon: Users,        title: t("feat7_title"), desc: t("feat7_desc") },
    { icon: Clock,        title: t("feat8_title"), desc: t("feat8_desc") },
  ];

  const PRICING: Array<{
    name: string; price: string; period: string; color: string;
    badge?: string; items: string[];
    cta: { label: string; href: string; primary: boolean };
  }> = [
    {
      name: t("plan_free_name"),
      price: "$0",
      period: t("plan_free_period"),
      color: "border-border/60",
      items: [t("plan_free_i1"), t("plan_free_i2"), t("plan_free_i3"), t("plan_free_i4")],
      cta: { label: t("plan_free_cta"), href: "/auth/register", primary: false },
    },
    {
      name: t("plan_follower_name"),
      price: "$29+",
      period: t("plan_follower_period"),
      color: "border-primary/50 shadow-lg shadow-primary/5",
      badge: t("pricing_popular"),
      items: [t("plan_follower_i1"), t("plan_follower_i2"), t("plan_follower_i3"), t("plan_follower_i4"), t("plan_follower_i5")],
      cta: { label: t("plan_follower_cta"), href: "/leaderboard", primary: true },
    },
    {
      name: t("plan_master_name"),
      price: "Free",
      period: t("plan_master_period"),
      color: "border-border/60",
      items: [t("plan_master_i1"), t("plan_master_i2"), t("plan_master_i3"), t("plan_master_i4"), t("plan_master_i5")],
      cta: { label: t("plan_master_cta"), href: "/dashboard/apply-master", primary: false },
    },
  ];

  const TERMINAL_FEATURES = [
    t("terminal_feat1"),
    t("terminal_feat2"),
    t("terminal_feat3"),
    t("terminal_feat4"),
    t("terminal_feat5"),
  ];

  return (
    <div className="flex flex-col">

      {/* ── Hero + repositioned landing ──────────────────────────────────── */}
      <Hero />
      <PriceTicker />
      <Modules />
      <AiSpotlight />

      {/* ── How it Works ─────────────────────────────────────────────────── */}
      <section className="py-20 px-4 border-b border-border/40">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-center mb-2">{t("how_title")}</h2>
          <p className="text-center text-muted-foreground mb-12 text-sm">{t("how_subtitle")}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.step} className="relative">
                <div className="text-5xl font-black text-primary/10 mb-3 leading-none">{step.step}</div>
                <h3 className="font-semibold text-base mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{step.desc}</p>
                <Link href={`/${step.cta}`} className="text-xs text-primary hover:text-primary/80 inline-flex items-center gap-1 transition-colors">
                  {t("how_get_started")} <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Paper Trading Callout ─────────────────────────────────────────── */}
      <section className="py-10 px-4 border-b border-border/40 bg-amber-500/5">
        <div className="container mx-auto max-w-3xl">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-shrink-0 h-14 w-14 rounded-2xl bg-amber-500/20 flex items-center justify-center">
              <FlaskConical className="h-7 w-7 text-amber-400" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <div className="font-bold text-lg mb-1">
                {t("paper_heading")} — <span className="text-amber-400">{t("paper_heading_highlight")}</span>
              </div>
              <p className="text-sm text-muted-foreground">{t("paper_desc")}</p>
            </div>
            <Link href="/leaderboard" className={cn(buttonVariants({ variant: "outline" }), "shrink-0 border-amber-500/40 text-amber-400 hover:bg-amber-500/10")}>
              {t("paper_cta")}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Top Masters ──────────────────────────────────────────────────── */}
      <section className="py-16 px-4 border-b border-border/40">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold">{t("top_providers")}</h2>
              <p className="text-muted-foreground mt-1 text-sm">{t("top_providers_subtitle")} · {t("updated_hourly")}</p>
            </div>
            <Link href="/leaderboard" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              {t("view_all")} <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {topMasters.map((m, i) => (
              <Link key={m.master_id} href={`/masters/${m.master_id}`} className="block">
                <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="text-2xl font-bold text-muted-foreground/30 w-8 shrink-0 font-mono">#{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{m.username}</div>
                      <div className="text-xs text-muted-foreground">
                        {t("masters_record", { n: m.trading_days })} · {t("masters_followers", { n: m.followers_count.toLocaleString() })} · {t("masters_win_rate", { n: m.win_rate.toFixed(1) })}
                      </div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-muted-foreground">{t("masters_max_dd")}</div>
                      <div className="text-sm font-medium text-red-400">-{m.max_drawdown.toFixed(1)}%</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">{t("masters_return")}</div>
                      <div className="text-sm font-bold text-emerald-400">+{m.return_pct.toFixed(1)}%</div>
                    </div>
                    <div className={cn("text-lg font-bold shrink-0 w-8 text-center", gradeColor[m.risk_grade] ?? "text-muted-foreground")}>
                      {m.risk_grade}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              <CheckCircle2 className="inline h-3 w-3 text-emerald-400 mr-1" />
              {t("verified_badge")}
            </p>
          </div>
        </div>
      </section>

      {/* ── Features 8-grid ──────────────────────────────────────────────── */}
      <section className="py-16 px-4 border-b border-border/40">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-center mb-3">{t("features_title")}</h2>
          <p className="text-center text-muted-foreground text-sm mb-12">{t("features_subtitle")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <Card key={title} className="border-border/60 hover:border-border transition-colors">
                <CardContent className="p-5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 mb-3">
                    <Icon className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm mb-1.5">{title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section className="py-16 px-4 border-b border-border/40 bg-muted/10">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-center mb-3">{t("pricing_title")}</h2>
          <p className="text-center text-muted-foreground text-sm mb-12">{t("pricing_subtitle")}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PRICING.map((plan) => (
              <Card key={plan.name} className={cn("border relative", plan.color)}>
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground text-xs px-3">{plan.badge}</Badge>
                  </div>
                )}
                <CardContent className="p-6">
                  <div className="mb-4">
                    <div className="text-sm text-muted-foreground font-medium mb-1">{plan.name}</div>
                    <div className="flex items-end gap-1">
                      <span className="text-3xl font-bold">{plan.price}</span>
                      <span className="text-xs text-muted-foreground mb-1">/{plan.period}</span>
                    </div>
                  </div>
                  <ul className="space-y-2 mb-6">
                    {plan.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.cta.href}
                    className={cn(
                      buttonVariants({ variant: plan.cta.primary ? "default" : "outline", size: "sm" }),
                      "w-full"
                    )}
                  >
                    {plan.cta.label}
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Terminal Teaser ───────────────────────────────────────────────── */}
      <section className="py-16 px-4 border-b border-border/40">
        <div className="container mx-auto max-w-4xl">
          <div className="flex flex-col md:flex-row items-center gap-10">
            <div className="flex-1">
              <Badge variant="outline" className="mb-4 border-primary/30 text-primary text-xs">
                <Globe className="mr-1.5 h-3 w-3" /> {t("terminal_badge")}
              </Badge>
              <h2 className="text-2xl font-bold mb-4">{t("terminal_title")}</h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">{t("terminal_desc")}</p>
              <ul className="space-y-2 mb-6">
                {TERMINAL_FEATURES.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <Zap className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
              <Link href="/terminal" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
                <BarChart2 className="h-4 w-4" /> {t("terminal_cta")}
              </Link>
            </div>
            <div className="flex-1 rounded-xl border border-border/60 bg-card p-4 font-mono text-xs space-y-2 text-muted-foreground">
              <div className="text-primary font-semibold text-sm mb-3 flex items-center gap-2">
                <BarChart2 className="h-4 w-4" /> {t("terminal_preview")}
              </div>
              {[
                { label: "EURUSD",  val: "1.08312",  chg: "+0.24%", pos: true },
                { label: "XAUUSD",  val: "2,341.50", chg: "-0.12%", pos: false },
                { label: "GBPUSD",  val: "1.27140",  chg: "+0.31%", pos: true },
                { label: "USDJPY",  val: "157.23",   chg: "-0.08%", pos: false },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center py-1 border-b border-border/30 last:border-0">
                  <span className="text-foreground font-medium">{row.label}</span>
                  <span>{row.val}</span>
                  <span className={row.pos ? "text-emerald-400" : "text-red-400"}>{row.chg}</span>
                </div>
              ))}
              <div className="pt-2 text-[10px] flex gap-2 flex-wrap">
                {["MA20", "EMA50", "BB", "RSI", "MACD"].map((ind) => (
                  <span key={ind} className="border border-border/50 rounded px-1.5 py-0.5 text-foreground/60">{ind}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="py-20 px-4 text-center bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto max-w-xl">
          <h2 className="text-3xl font-bold mb-3">{t("cta_title")}</h2>
          <p className="text-muted-foreground mb-8 text-sm">{t("cta_subtitle")}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth/register" className={cn(buttonVariants({ size: "lg" }))}>
              {t("cta_button")} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link href="/leaderboard" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
              {t("cta_browse_masters")}
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-6">{t("cta_disclaimer")}</p>
        </div>
      </section>

    </div>
  );
}

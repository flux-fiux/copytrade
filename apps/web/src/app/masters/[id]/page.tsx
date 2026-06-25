"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import {
  ArrowLeft, Shield, Users, Calendar,
  Star, AlertTriangle, CheckCircle2, Loader2, FlaskConical, BadgeCheck,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { AnalyticsTabs } from "@/components/masters/analytics-tabs";
import { ReviewsSection } from "@/components/masters/reviews-section";
import { AnnouncementsSection } from "@/components/masters/announcements-section";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface MasterDetail {
  master: { id: string; username: string; display_name?: string; apply_strategy?: string; is_certified?: boolean };
  score: {
    total_return_pct?: number;
    max_drawdown_pct?: number;
    sharpe_ratio?: number;
    win_rate_pct?: number;
    risk_grade?: string;
    followers_count?: number;
    trading_days?: number;
  } | null;
  followers_count: number;
  recent_signals: Signal[];
}

interface Signal {
  id: string;
  symbol: string;
  direction: string;
  signal_type: string;
  volume: number;
  open_price?: number;
  profit?: number;
  opened_at: string;
}

interface Plan {
  id: string;
  name: string;
  price_usd: number;
  performance_fee_pct: number;
}

interface MT4Account {
  id: string;
  broker_name: string;
  login: string;
  account_type: string;
  connection_status: string;
}

const GRADE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  "A+": { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/40" },
  A:   { bg: "bg-green-500/10",   text: "text-green-400",   border: "border-green-500/40" },
  "B+":{ bg: "bg-blue-500/10",    text: "text-blue-400",    border: "border-blue-500/40" },
  B:   { bg: "bg-yellow-500/10",  text: "text-yellow-400",  border: "border-yellow-500/40" },
  C:   { bg: "bg-orange-500/10",  text: "text-orange-400",  border: "border-orange-500/40" },
  D:   { bg: "bg-red-500/10",     text: "text-red-400",     border: "border-red-500/40" },
};

const DEFAULT_PLAN: Plan = { id: "default", name: "Standard", price_usd: 29, performance_fee_pct: 0 };

const MOCK_MASTER: MasterDetail = {
  master: { id: "1", username: "AlphaWave FX", display_name: "AlphaWave FX" },
  score: { total_return_pct: 142.3, max_drawdown_pct: 8.2, sharpe_ratio: 2.41, win_rate_pct: 71.3, risk_grade: "A+", followers_count: 312, trading_days: 385 },
  followers_count: 312,
  recent_signals: [
    { id: "s1", symbol: "EURUSD", direction: "BUY",  signal_type: "OPEN",  volume: 0.1,  open_price: 1.08312, profit: 48.2,  opened_at: "2026-06-25T10:00:00Z" },
    { id: "s2", symbol: "XAUUSD", direction: "SELL", signal_type: "OPEN",  volume: 0.05, open_price: 2324.5,  profit: -12.3, opened_at: "2026-06-25T09:30:00Z" },
    { id: "s3", symbol: "GBPUSD", direction: "BUY",  signal_type: "CLOSE", volume: 0.2,  open_price: 1.27140, profit: 91.0,  opened_at: "2026-06-24T16:00:00Z" },
    { id: "s4", symbol: "USDJPY", direction: "SELL", signal_type: "OPEN",  volume: 0.1,  open_price: 157.23,  profit: 22.5,  opened_at: "2026-06-24T14:00:00Z" },
  ],
};

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn("text-2xl font-bold font-mono", color)}>{value}</p>
    </div>
  );
}

// ── Subscribe Drawer ──────────────────────────────────────────────────────────

function SubscribeDrawer({
  masterId, masterName, plans, onClose, onSuccess,
}: {
  masterId: string;
  masterName: string;
  plans: Plan[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useTranslations("master_profile");
  const [selectedPlan, setSelectedPlan] = useState<Plan>(plans[0] ?? DEFAULT_PLAN);
  const [accounts, setAccounts] = useState<MT4Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [lotMultiplier, setLotMultiplier] = useState(1.0);
  const [maxDrawdown, setMaxDrawdown] = useState(20);
  const [mode, setMode] = useState<"live" | "paper">("live");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const res = await fetch(`${API_BASE}/api/v1/mt4-accounts/`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data: MT4Account[] = await res.json();
          const followers = data.filter((a) => a.account_type === "FOLLOWER");
          setAccounts(followers);
          if (followers.length > 0) setSelectedAccount(followers[0].id);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("请先登录。"); setSubmitting(false); return; }
      const body: Record<string, unknown> = {
        master_id: masterId,
        lot_multiplier: lotMultiplier,
        max_drawdown_pct: maxDrawdown,
        mode,
      };
      if (selectedPlan.id !== "default") body.plan_id = selectedPlan.id;
      if (selectedAccount && mode === "live") body.follower_account_id = selectedAccount;
      const res = await fetch(`${API_BASE}/api/v1/subscriptions/subscribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Subscription failed");
      }
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const platformFee = selectedPlan.price_usd * 0.2;
  const masterGets = selectedPlan.price_usd - platformFee;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 z-50 max-w-lg mx-auto rounded-t-2xl border border-border bg-background p-6 shadow-2xl">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />
        <h2 className="text-lg font-bold mb-1">{t("subscribe_drawer_title", { name: masterName })}</h2>
        <p className="text-sm text-muted-foreground mb-4">{t("subscribe_drawer_subtitle")}</p>

        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setMode("live")}
            className={cn(
              "rounded-lg border p-3 text-sm transition-colors text-left",
              mode === "live" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            )}
          >
            <div className="font-medium mb-0.5">{t("live_mode")}</div>
            <div className="text-xs text-muted-foreground">{t("live_mode_desc")}</div>
          </button>
          <button
            onClick={() => setMode("paper")}
            className={cn(
              "rounded-lg border p-3 text-sm transition-colors text-left",
              mode === "paper" ? "border-amber-500 bg-amber-500/5" : "border-border hover:border-amber-500/30"
            )}
          >
            <div className="font-medium mb-0.5 flex items-center gap-1.5">
              <FlaskConical className="h-3.5 w-3.5 text-amber-400" />
              {t("paper_mode")}
            </div>
            <div className="text-xs text-muted-foreground">{t("paper_mode_desc")}</div>
          </button>
        </div>

        {mode === "paper" && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-400">
            {t("paper_notice")}
          </div>
        )}

        {plans.length > 1 && (
          <div className="mb-4">
            <label className="text-xs font-medium text-muted-foreground block mb-2">{t("select_plan")}</label>
            <div className="grid gap-2">
              {plans.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlan(p)}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-3 text-sm transition-colors text-left",
                    selectedPlan.id === p.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  )}
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="font-mono text-primary">${p.price_usd}{t("per_month")}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === "live" && (
          accounts.length > 0 ? (
            <div className="mb-4">
              <label className="text-xs font-medium text-muted-foreground block mb-2">{t("copy_to")}</label>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.broker_name} #{a.login} ({a.connection_status})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-400 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {t("no_follower_account")}
              <Link href="/dashboard/accounts" className="underline">{t("bind_account")}</Link>
            </div>
          )
        )}

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              {t("lot_label")} <span className="text-foreground font-mono">{lotMultiplier.toFixed(1)}×</span>
            </label>
            <input type="range" min={0.1} max={3} step={0.1} value={lotMultiplier}
              onChange={(e) => setLotMultiplier(Number(e.target.value))} className="w-full accent-primary" />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
              <span>0.1×</span><span>3.0×</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              {t("dd_label")} <span className="text-foreground font-mono">{maxDrawdown}%</span>
            </label>
            <input type="range" min={5} max={50} step={5} value={maxDrawdown}
              onChange={(e) => setMaxDrawdown(Number(e.target.value))} className="w-full accent-primary" />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
              <span>5%</span><span>50%</span>
            </div>
          </div>
        </div>

        {mode === "live" && (
          <div className="rounded-lg bg-muted/40 p-3 mb-4 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("sub_fee")}</span>
              <span className="font-mono">${selectedPlan.price_usd}{t("per_month")}</span>
            </div>
            {selectedPlan.performance_fee_pct > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("perf_fee")}</span>
                <span className="font-mono">{selectedPlan.performance_fee_pct}% {t("profit_pct")}</span>
              </div>
            )}
            <div className="flex justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/50">
              <span>{t("platform_fee")}</span>
              <span className="font-mono">${platformFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-medium pt-0.5">
              <span>{t("master_gets")}</span>
              <span className="font-mono text-emerald-400">${masterGets.toFixed(2)}{t("per_month")}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400">{error}</div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={submitting || (mode === "live" && accounts.length === 0)}
          className={cn("w-full", mode === "paper" && "bg-amber-500 hover:bg-amber-600 text-black")}
        >
          {submitting
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("subscribing")}</>
            : mode === "paper"
            ? <><FlaskConical className="h-4 w-4 mr-2" />{t("start_paper")}</>
            : t("subscribe_price", { price: selectedPlan.price_usd })}
        </Button>
        <button onClick={onClose} className="w-full text-center text-xs text-muted-foreground mt-3 hover:text-foreground">
          {t("cancel")}
        </button>
      </div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MasterDetailPage() {
  const t = useTranslations("master_profile");
  const tc = useTranslations("common");
  const locale = useLocale();
  const params = useParams();
  const router = useRouter();
  const masterId = params.id as string;

  const [detail, setDetail]               = useState<MasterDetail | null>(null);
  const [plans, setPlans]                 = useState<Plan[]>([]);
  const [loading, setLoading]             = useState(true);
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [isSubscribed, setIsSubscribed]   = useState(false);
  const [aiSummary, setAiSummary]         = useState<string | null>(null);
  const [aiLoading, setAiLoading]         = useState(false);
  const [authed, setAuthed]               = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/leaderboard/${masterId}`);
      setDetail(res.ok ? await res.json() : MOCK_MASTER);
    } catch { setDetail(MOCK_MASTER); }

    try {
      const res = await fetch(`${API_BASE}/api/v1/subscriptions/plans/${masterId}`);
      if (res.ok) {
        const data: Plan[] = await res.json();
        setPlans(data.length ? data : [DEFAULT_PLAN]);
      } else setPlans([DEFAULT_PLAN]);
    } catch { setPlans([DEFAULT_PLAN]); }

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setAuthed(true);
      try {
        const res = await fetch(`${API_BASE}/api/v1/subscriptions/my`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const subs: { master_id: string; status: string }[] = await res.json();
          setIsSubscribed(subs.some((s) => s.master_id === masterId && s.status !== "CANCELLED"));
        }
      } catch { /* ignore */ }
    }
    setLoading(false);
  }, [masterId]);

  useEffect(() => { load(); }, [load]);

  const loadAiSummary = async () => {
    if (aiSummary || aiLoading) return;
    setAiLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/leaderboard/${masterId}/ai-summary?lang=${locale}`);
      if (!res.ok) throw new Error("AI service unavailable");
      const data = await res.json();
      setAiSummary(data.summary ?? "AI analysis temporarily unavailable.");
    } catch {
      setAiSummary("AI analysis temporarily unavailable.");
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{t("not_found")}</p>
        <Link href="/leaderboard" className="text-primary text-sm hover:underline">{t("back_lb")}</Link>
      </div>
    );
  }

  const { master, score, recent_signals } = detail;
  const name = master.display_name || master.username;
  const initials = name.slice(0, 2).toUpperCase();
  const grade = score?.risk_grade ?? "—";
  const gs = GRADE_STYLES[grade] ?? { bg: "bg-muted", text: "text-muted-foreground", border: "border-border" };
  const primaryPlan = plans[0] ?? DEFAULT_PLAN;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Link href="/leaderboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> {t("back")}
        </Link>

        {/* Hero */}
        <div className="flex items-start gap-5 mb-8">
          <Avatar className="h-16 w-16 shrink-0">
            <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{name}</h1>
              {master.is_certified && (
                <Badge variant="outline" className="gap-1 border-sky-500/40 bg-sky-500/10 text-sky-400">
                  <BadgeCheck className="h-3.5 w-3.5" />{tc("certified")}
                </Badge>
              )}
              <Badge variant="outline" className={cn("text-base font-bold px-3 py-0.5", gs.bg, gs.text, gs.border)}>
                {grade}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              {detail.followers_count > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {t("followers", { n: detail.followers_count.toLocaleString() })}
                </span>
              )}
              {score?.trading_days != null && score.trading_days > 0 && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> {t("trading_days", { n: score.trading_days })}
                </span>
              )}
              <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5 text-emerald-400" /> {t("verified")}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xs text-muted-foreground mb-1">{t("from")}</div>
            <div className="text-2xl font-bold text-primary">
              ${primaryPlan.price_usd}<span className="text-sm font-normal text-muted-foreground">{t("per_month")}</span>
            </div>
            {isSubscribed ? (
              <Link href="/dashboard/subscriptions" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2 text-emerald-400 border-emerald-500/40 inline-flex items-center gap-1")}>
                <CheckCircle2 className="h-3.5 w-3.5" />{t("subscribed")}
              </Link>
            ) : authed ? (
              <Button size="sm" className="mt-2" onClick={() => setShowSubscribe(true)}>
                <Star className="h-3.5 w-3.5 mr-1.5" />{t("subscribe_now")}
              </Button>
            ) : (
              <Button size="sm" className="mt-2" onClick={() => router.push(`/login?next=/masters/${masterId}`)}>
                {t("login_to_subscribe")}
              </Button>
            )}
          </div>
        </div>

        {/* Strategy description */}
        {master.apply_strategy && (
          <div className="mb-6 rounded-xl border border-border/60 bg-muted/20 px-5 py-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("strategy")}</p>
            <p className="text-sm text-foreground/80 leading-relaxed">{master.apply_strategy}</p>
          </div>
        )}

        {/* Stats */}
        {score ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <StatCard label={t("total_return")} value={`${(score.total_return_pct ?? 0) >= 0 ? "+" : ""}${(score.total_return_pct ?? 0).toFixed(1)}%`} color={(score.total_return_pct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"} />
            <StatCard label={t("max_drawdown")} value={`-${(score.max_drawdown_pct ?? 0).toFixed(1)}%`} color="text-red-400" />
            <StatCard label={t("sharpe")} value={(score.sharpe_ratio ?? 0).toFixed(2)} />
            <StatCard label={t("win_rate")} value={`${(score.win_rate_pct ?? 0).toFixed(1)}%`} color={(score.win_rate_pct ?? 0) >= 60 ? "text-emerald-400" : "text-yellow-400"} />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground mb-8">
            {t("no_perf_data")}
          </div>
        )}

        {/* Main layout: analytics tabs + right sidebar */}
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-6">
            <AnalyticsTabs
              masterId={masterId}
              signals={recent_signals}
              aiSummary={aiSummary}
              aiLoading={aiLoading}
              onLoadAi={loadAiSummary}
            />
            <AnnouncementsSection masterId={masterId} />
            <ReviewsSection masterId={masterId} />
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4" />{t("plans_title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {plans.map((p) => (
                  <div key={p.id} className="rounded-lg border border-border/60 p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-sm">{p.name}</span>
                      <span className="font-mono font-bold text-primary">${p.price_usd}<span className="text-xs text-muted-foreground font-normal">{t("per_month")}</span></span>
                    </div>
                    {p.performance_fee_pct > 0 && (
                      <p className="text-xs text-muted-foreground">+{p.performance_fee_pct}% {t("perf_fee")}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{t("auto_cancel")}</p>
                  </div>
                ))}

                {isSubscribed ? (
                  <Link href="/dashboard/subscriptions" className={cn(buttonVariants({ variant: "outline" }), "w-full text-emerald-400 border-emerald-500/40 inline-flex items-center justify-center gap-2")}>
                    <CheckCircle2 className="h-4 w-4" />{t("manage_subs")}
                  </Link>
                ) : authed ? (
                  <>
                    <Button className="w-full" onClick={() => setShowSubscribe(true)}>
                      <Star className="h-4 w-4 mr-2" />{t("subscribe_now")}
                    </Button>
                    <Button variant="outline" className="w-full border-amber-500/40 text-amber-400 hover:bg-amber-500/10" onClick={() => setShowSubscribe(true)}>
                      <FlaskConical className="h-4 w-4 mr-2" />{t("free_paper")}
                    </Button>
                  </>
                ) : (
                  <Button className="w-full" onClick={() => router.push(`/login?next=/masters/${masterId}`)}>
                    {t("login_to_subscribe")}
                  </Button>
                )}

                <div className="rounded-lg bg-muted/30 p-3 space-y-1.5 text-xs text-muted-foreground">
                  {[t("trust_1"), t("trust_2"), t("trust_3"), t("trust_4")].map((item) => (
                    <div key={item} className="flex items-start gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" />{item}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {score && (
              <Card className={cn("border", gs.border, gs.bg)}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className={cn("h-4 w-4", gs.text)} />
                    <span className={cn("font-semibold text-sm", gs.text)}>{t("risk_grade", { grade })}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {(grade === "A+" || grade === "A") ? t("grade_desc_high") : (grade === "B+" || grade === "B") ? t("grade_desc_mid") : t("grade_desc_low")}
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs space-y-1">
              <div className="font-medium text-primary">💡 {t("tip_title")}</div>
              <p className="text-muted-foreground">{t("tip_desc")}</p>
            </div>
          </div>
        </div>
      </div>

      {showSubscribe && (
        <SubscribeDrawer
          masterId={masterId}
          masterName={name}
          plans={plans}
          onClose={() => setShowSubscribe(false)}
          onSuccess={() => {
            setShowSubscribe(false);
            setIsSubscribed(true);
            router.push("/dashboard/subscriptions?success=1");
          }}
        />
      )}
    </div>
  );
}

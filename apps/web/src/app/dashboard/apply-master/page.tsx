"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Star, CheckCircle, Clock, XCircle, AlertTriangle,
  TrendingUp, Shield, DollarSign, Loader2, ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type TradingStyle = "SCALPING" | "SWING" | "POSITION" | "MIXED";
type KycStatus = "NONE" | "PENDING" | "VERIFIED" | "REJECTED";

interface ApplicationStatus {
  kyc_status: KycStatus;
  apply_strategy: string | null;
  apply_trading_style: string | null;
  apply_price_usd: number | null;
  apply_perf_fee_pct: number | null;
  applied_at: string | null;
  roles: string[];
}

const TRADING_STYLE_VALUES: TradingStyle[] = ["SCALPING", "SWING", "POSITION", "MIXED"];

function StatusBanner({ status, t }: { status: ApplicationStatus; t: ReturnType<typeof useTranslations> }) {
  if ((status.roles ?? []).includes("MASTER")) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 mb-6">
        <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold text-emerald-400">{t("status_approved_title")}</div>
          <div className="text-sm text-muted-foreground mt-0.5">
            {t("status_approved_desc")}
          </div>
        </div>
      </div>
    );
  }
  if (status.kyc_status === "PENDING") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 mb-6">
        <Clock className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold text-amber-400">{t("status_pending_title")}</div>
          <div className="text-sm text-muted-foreground mt-1 space-y-1">
            <p>{t("status_pending_strategy")} <span className="text-foreground">{status.apply_strategy}</span></p>
            {status.apply_price_usd != null && (
              <p>{t("status_pending_price")} <span className="text-foreground">${status.apply_price_usd}/month</span></p>
            )}
            {status.applied_at && (
              <p>{t("status_pending_submitted")} <span className="text-foreground">{new Date(status.applied_at).toLocaleDateString()}</span></p>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">{t("status_pending_email")}</p>
        </div>
      </div>
    );
  }
  if (status.kyc_status === "REJECTED") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 mb-6">
        <XCircle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold text-red-400">{t("status_rejected_title")}</div>
          <div className="text-sm text-muted-foreground mt-0.5">
            {t("status_rejected_desc")}
          </div>
        </div>
      </div>
    );
  }
  return null;
}

export default function ApplyMasterPage() {
  const router = useRouter();
  const t = useTranslations("apply_master");
  const [appStatus, setAppStatus] = useState<ApplicationStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [strategyName, setStrategyName] = useState("");
  const [tradingStyle, setTradingStyle] = useState<TradingStyle>("SWING");
  const [description, setDescription] = useState("");
  const [monthlyReturn, setMonthlyReturn] = useState("");
  const [maxDrawdown, setMaxDrawdown] = useState("");
  const [priceUsd, setPriceUsd] = useState("29");
  const [perfFeePct, setPerfFeePct] = useState("0");

  const getToken = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? "";
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (!token) { setLoadingStatus(false); return; }
        const res = await fetch(`${API_BASE}/api/v1/users/me/application`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setAppStatus(await res.json());
      } catch {
        // ignore — show form
      } finally {
        setLoadingStatus(false);
      }
    })();
  }, [getToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (description.length < 20) { setError(t("description_min")); return; }

    setSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/v1/users/me/apply-master`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          strategy_name: strategyName,
          trading_style: tradingStyle,
          description,
          monthly_return_pct: parseFloat(monthlyReturn) || 0,
          max_drawdown_pct: parseFloat(maxDrawdown) || 0,
          price_usd: parseFloat(priceUsd) || 0,
          perf_fee_pct: parseFloat(perfFeePct) || 0,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Submission failed");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingStatus) {
    return (
      <div className="px-6 py-6 flex items-center justify-center min-h-64 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  if (submitted || appStatus?.kyc_status === "PENDING") {
    return (
      <div className="px-6 py-6 max-w-lg mx-auto">
        <div className="flex flex-col items-center text-center py-12">
          <div className="h-16 w-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4">
            <Clock className="h-8 w-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{t("submitted_title")}</h1>
          <p className="text-muted-foreground text-sm mb-6 max-w-sm">
            {t("submitted_desc")}
          </p>
          <button onClick={() => router.push("/dashboard")} className={cn(buttonVariants({ variant: "outline" }))}>
            {t("back_dashboard")}
          </button>
        </div>
      </div>
    );
  }

  if ((appStatus?.roles ?? []).includes("MASTER")) {
    return (
      <div className="px-6 py-6 max-w-lg mx-auto">
        <StatusBanner status={appStatus!} t={t} />
        <button onClick={() => router.push("/dashboard/earnings")} className={cn(buttonVariants())}>
          {t("view_earnings")}
        </button>
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Star className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t("title")}</h1>
              <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
            </div>
          </div>

          {/* Perks */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { icon: DollarSign, titleKey: "perk_revenue" as const, descKey: "perk_revenue_desc" as const },
              { icon: TrendingUp, titleKey: "perk_auto" as const, descKey: "perk_auto_desc" as const },
              { icon: Shield, titleKey: "perk_control" as const, descKey: "perk_control_desc" as const },
            ].map(({ icon: Icon, titleKey, descKey }) => (
              <div key={titleKey} className="rounded-lg border border-border/60 p-3 text-center">
                <Icon className="h-5 w-5 mx-auto mb-1.5 text-primary" />
                <div className="text-xs font-semibold">{t(titleKey)}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{t(descKey)}</div>
              </div>
            ))}
          </div>
        </div>

        {appStatus && <StatusBanner status={appStatus} t={t} />}

        {/* Application form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Strategy name */}
          <Card className="border-border/60">
            <CardContent className="p-5 space-y-4">
              <h2 className="text-sm font-semibold">{t("strategy_details")}</h2>

              <div>
                <label className="block text-sm font-medium mb-1.5">{t("strategy_name")} <span className="text-destructive">*</span></label>
                <input
                  required
                  value={strategyName}
                  onChange={e => setStrategyName(e.target.value)}
                  maxLength={100}
                  placeholder={t("strategy_name_ph")}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t("trading_style")} <span className="text-destructive">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {TRADING_STYLE_VALUES.map((value) => (
                    <label
                      key={value}
                      className={cn(
                        "flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors",
                        tradingStyle === value
                          ? "border-primary/60 bg-primary/5"
                          : "border-border/60 hover:border-border"
                      )}
                    >
                      <input
                        type="radio"
                        name="style"
                        value={value}
                        checked={tradingStyle === value}
                        onChange={() => setTradingStyle(value)}
                        className="mt-0.5 accent-primary"
                      />
                      <div>
                        <div className="text-sm font-medium">{t(`style_${value.toLowerCase()}` as Parameters<typeof t>[0])}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{t(`style_${value.toLowerCase()}_desc` as Parameters<typeof t>[0])}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  {t("description_label")} <span className="text-destructive">*</span>
                  <span className="text-muted-foreground font-normal ml-1">{t("description_chars", { count: description.length })}</span>
                </label>
                <textarea
                  required
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder={t("description_ph")}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
                />
                {description.length > 0 && description.length < 20 && (
                  <p className="text-xs text-destructive mt-1">{t("description_min")}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Performance targets */}
          <Card className="border-border/60">
            <CardContent className="p-5 space-y-4">
              <h2 className="text-sm font-semibold">{t("perf_targets")}</h2>
              <p className="text-xs text-muted-foreground">{t("perf_targets_subtitle")}</p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">{t("monthly_return")}</label>
                  <input
                    type="number"
                    value={monthlyReturn}
                    onChange={e => setMonthlyReturn(e.target.value)}
                    min={0} max={500} step={0.1}
                    placeholder="e.g. 8.5"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">{t("max_drawdown_label")}</label>
                  <input
                    type="number"
                    value={maxDrawdown}
                    onChange={e => setMaxDrawdown(e.target.value)}
                    min={0} max={100} step={0.1}
                    placeholder="e.g. 15"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card className="border-border/60">
            <CardContent className="p-5 space-y-4">
              <h2 className="text-sm font-semibold">{t("pricing")}</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">{t("monthly_price")}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <input
                      type="number"
                      value={priceUsd}
                      onChange={e => setPriceUsd(e.target.value)}
                      min={0} max={500} step={1}
                      className="w-full pl-7 pr-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{t("free_tier")}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">{t("perf_fee")}</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={perfFeePct}
                      onChange={e => setPerfFeePct(e.target.value)}
                      min={0} max={50} step={1}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{t("hwm_basis")}</p>
                </div>
              </div>

              {/* Revenue preview */}
              <div className="rounded-lg bg-muted/30 border border-border/50 p-3 text-sm">
                <div className="flex justify-between text-muted-foreground mb-1.5">
                  <span>{t("preview_10")}</span>
                  <span className="text-foreground font-medium">
                    ${((parseFloat(priceUsd) || 0) * 10 * 0.8).toFixed(0)}/month
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("preview_100")}</span>
                  <span className="text-foreground font-medium">
                    ${((parseFloat(priceUsd) || 0) * 100 * 0.8).toFixed(0)}/month
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground/70 mt-2">{t("platform_takes")}</p>
              </div>
            </CardContent>
          </Card>

          {/* Terms */}
          <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/20 p-4 text-xs text-muted-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
            <div>
              {t("terms")}
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting || !strategyName || description.length < 20}
              className={cn(buttonVariants(), "gap-2", (submitting || !strategyName || description.length < 20) && "opacity-60 cursor-not-allowed")}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
              {submitting ? t("submitting") : t("submit")}
            </button>
            <button type="button" onClick={() => router.back()} className={cn(buttonVariants({ variant: "ghost" }))}>
              {t("cancel")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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

const TRADING_STYLES: { value: TradingStyle; label: string; desc: string }[] = [
  { value: "SCALPING", label: "Scalping", desc: "Frequent trades, minutes to hours" },
  { value: "SWING", label: "Swing", desc: "Days to weeks, trend-based" },
  { value: "POSITION", label: "Position", desc: "Weeks to months, macro view" },
  { value: "MIXED", label: "Mixed", desc: "Combines multiple styles" },
];

function StatusBanner({ status }: { status: ApplicationStatus }) {
  if ((status.roles ?? []).includes("MASTER")) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 mb-6">
        <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold text-emerald-400">You are a Master</div>
          <div className="text-sm text-muted-foreground mt-0.5">
            Your account is verified. Go to <a href="/dashboard/earnings" className="underline">Earnings</a> to track your income.
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
          <div className="font-semibold text-amber-400">Application Under Review</div>
          <div className="text-sm text-muted-foreground mt-1 space-y-1">
            <p>Strategy: <span className="text-foreground">{status.apply_strategy}</span></p>
            {status.apply_price_usd != null && (
              <p>Subscription price: <span className="text-foreground">${status.apply_price_usd}/month</span></p>
            )}
            {status.applied_at && (
              <p>Submitted: <span className="text-foreground">{new Date(status.applied_at).toLocaleDateString()}</span></p>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">You will be notified by email within 1–3 business days.</p>
        </div>
      </div>
    );
  }
  if (status.kyc_status === "REJECTED") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 mb-6">
        <XCircle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold text-red-400">Previous Application Rejected</div>
          <div className="text-sm text-muted-foreground mt-0.5">
            You can submit a new application below with updated information.
          </div>
        </div>
      </div>
    );
  }
  return null;
}

export default function ApplyMasterPage() {
  const router = useRouter();
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
    if (description.length < 20) { setError("Description must be at least 20 characters."); return; }

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
          <h1 className="text-2xl font-bold mb-2">Application Submitted</h1>
          <p className="text-muted-foreground text-sm mb-6 max-w-sm">
            Our team will review your application within 1–3 business days. You&apos;ll receive an email with the decision.
          </p>
          <button onClick={() => router.push("/dashboard")} className={cn(buttonVariants({ variant: "outline" }))}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if ((appStatus?.roles ?? []).includes("MASTER")) {
    return (
      <div className="px-6 py-6 max-w-lg mx-auto">
        <StatusBanner status={appStatus!} />
        <button onClick={() => router.push("/dashboard/earnings")} className={cn(buttonVariants())}>
          View Earnings
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
              <h1 className="text-2xl font-bold">Become a Master Trader</h1>
              <p className="text-sm text-muted-foreground">Share your strategy and earn 80% of subscription revenue</p>
            </div>
          </div>

          {/* Perks */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { icon: DollarSign, title: "80% Revenue", desc: "Keep 80% of all subscription fees" },
              { icon: TrendingUp, title: "Auto Copy", desc: "Followers copy your trades automatically" },
              { icon: Shield, title: "Full Control", desc: "Set your own price and trading rules" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-lg border border-border/60 p-3 text-center">
                <Icon className="h-5 w-5 mx-auto mb-1.5 text-primary" />
                <div className="text-xs font-semibold">{title}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{desc}</div>
              </div>
            ))}
          </div>
        </div>

        {appStatus && <StatusBanner status={appStatus} />}

        {/* Application form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Strategy name */}
          <Card className="border-border/60">
            <CardContent className="p-5 space-y-4">
              <h2 className="text-sm font-semibold">Strategy Details</h2>

              <div>
                <label className="block text-sm font-medium mb-1.5">Strategy Name <span className="text-destructive">*</span></label>
                <input
                  required
                  value={strategyName}
                  onChange={e => setStrategyName(e.target.value)}
                  maxLength={100}
                  placeholder="e.g. AlphaWave FX Momentum"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Trading Style <span className="text-destructive">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {TRADING_STYLES.map(({ value, label, desc }) => (
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
                        <div className="text-sm font-medium">{label}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Strategy Description <span className="text-destructive">*</span>
                  <span className="text-muted-foreground font-normal ml-1">({description.length}/1000)</span>
                </label>
                <textarea
                  required
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder="Describe your trading approach, instruments traded, risk management, and why followers should trust your signals..."
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
                />
                {description.length > 0 && description.length < 20 && (
                  <p className="text-xs text-destructive mt-1">At least 20 characters required.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Performance targets */}
          <Card className="border-border/60">
            <CardContent className="p-5 space-y-4">
              <h2 className="text-sm font-semibold">Historical Performance Targets</h2>
              <p className="text-xs text-muted-foreground">Based on your actual track record. This will be displayed on your public profile.</p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Target Monthly Return (%)</label>
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
                  <label className="block text-sm font-medium mb-1.5">Max Drawdown (%)</label>
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
              <h2 className="text-sm font-semibold">Your Pricing</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Monthly Subscription ($)</label>
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
                  <p className="text-[10px] text-muted-foreground mt-1">Set $0 for a free tier</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Performance Fee (%)</label>
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
                  <p className="text-[10px] text-muted-foreground mt-1">High-water mark basis</p>
                </div>
              </div>

              {/* Revenue preview */}
              <div className="rounded-lg bg-muted/30 border border-border/50 p-3 text-sm">
                <div className="flex justify-between text-muted-foreground mb-1.5">
                  <span>At 10 followers:</span>
                  <span className="text-foreground font-medium">
                    ${((parseFloat(priceUsd) || 0) * 10 * 0.8).toFixed(0)}/month
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>At 100 followers:</span>
                  <span className="text-foreground font-medium">
                    ${((parseFloat(priceUsd) || 0) * 100 * 0.8).toFixed(0)}/month
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground/70 mt-2">Platform takes 20% — you keep 80%</p>
              </div>
            </CardContent>
          </Card>

          {/* Terms */}
          <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/20 p-4 text-xs text-muted-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
            <div>
              By applying you confirm your trading history is genuine, you will not manipulate trades to deceive followers, and you agree to the Master Terms of Service.
              Accounts found to violate these terms will be permanently suspended.
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
              {submitting ? "Submitting…" : "Submit Application"}
            </button>
            <button type="button" onClick={() => router.back()} className={cn(buttonVariants({ variant: "ghost" }))}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

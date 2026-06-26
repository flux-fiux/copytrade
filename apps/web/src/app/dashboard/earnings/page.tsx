"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, Loader2, Pencil, Check, X } from "lucide-react";
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
  mrr: number;
  followers_count: number;
  monthly_history: EarningRow[];
}

interface Plan {
  id: string;
  name: string;
  price_usd: number;
  performance_fee_pct: number;
  stripe_price_id: string | null;
  features: string[];
}

const MOCK: EarningsSummary = {
  total_earned: 0,
  pending: 0,
  mrr: 0,
  followers_count: 0,
  monthly_history: [],
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function EarningsPage() {
  const t = useTranslations("earnings");
  const [data, setData]         = useState<EarningsSummary>(MOCK);
  const [plan, setPlan]         = useState<Plan | null>(null);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [perfInput, setPerfInput]   = useState("");

  const getToken = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) { setLoading(false); return; }
    const headers = { Authorization: `Bearer ${token}` };

    const [earningsRes, plansRes] = await Promise.allSettled([
      fetch(`${API_BASE}/api/v1/users/me/earnings`, { headers }),
      fetch(`${API_BASE}/api/v1/subscriptions/plans/mine`, { headers }),
    ]);

    if (earningsRes.status === "fulfilled" && earningsRes.value.ok) {
      setData(await earningsRes.value.json());
    }
    if (plansRes.status === "fulfilled" && plansRes.value.ok) {
      const plans: Plan[] = await plansRes.value.json();
      if (plans.length > 0) {
        setPlan(plans[0]);
        setPriceInput(String(plans[0].price_usd));
        setPerfInput(String(plans[0].performance_fee_pct));
      }
    }
    setLoading(false);
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  const savePlan = async () => {
    if (!plan) return;
    const token = await getToken();
    if (!token) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/subscriptions/plans/${plan.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          price_usd: parseFloat(priceInput) || plan.price_usd,
          performance_fee_pct: parseFloat(perfInput) || plan.performance_fee_pct,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated: Plan = await res.json();
      setPlan(updated);
      setPriceInput(String(updated.price_usd));
      setPerfInput(String(updated.performance_fee_pct));
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-6 py-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("subtitle")}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> {t("loading")}
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">{t("total_earned")}</div>
                  <div className="text-xl font-bold mt-1 text-emerald-400">
                    ${data.total_earned.toLocaleString("en", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">{t("lifetime")}</div>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">{t("mrr")}</div>
                  <div className="text-xl font-bold mt-1 text-blue-400">
                    ${data.mrr.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">{t("mrr_cut")}</div>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">{t("pending")}</div>
                  <div className="text-xl font-bold mt-1 text-yellow-400">${data.pending.toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{t("this_month")}</div>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">{t("active_followers")}</div>
                  <div className="text-xl font-bold mt-1">{data.followers_count.toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-emerald-400" /> {t("copying_now")}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Plan management */}
            {plan && (
              <Card className="border-border/60 mb-6">
                <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">{t("sub_plan")}</h2>
                  {!editing ? (
                    <button
                      onClick={() => setEditing(true)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" /> {t("edit")}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={savePlan}
                        disabled={saving}
                        className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        {t("save")}
                      </button>
                      <button
                        onClick={() => { setEditing(false); setSaveError(null); setPriceInput(String(plan.price_usd)); setPerfInput(String(plan.performance_fee_pct)); }}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" /> {t("cancel")}
                      </button>
                    </div>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1.5">{t("monthly_price_label")}</label>
                      {editing ? (
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={priceInput}
                            onChange={e => setPriceInput(e.target.value)}
                            className="w-full pl-7 pr-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                          />
                        </div>
                      ) : (
                        <div className="text-2xl font-bold">${Number(plan.price_usd).toFixed(2)}</div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1.5">{t("perf_fee_label")}</label>
                      {editing ? (
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="50"
                            step="0.5"
                            value={perfInput}
                            onChange={e => setPerfInput(e.target.value)}
                            className="w-full pl-3 pr-7 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                        </div>
                      ) : (
                        <div className="text-2xl font-bold">{Number(plan.performance_fee_pct).toFixed(1)}%</div>
                      )}
                    </div>
                  </div>
                  {saveError && (
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{saveError}</p>
                  )}
                  {!editing && plan.stripe_price_id && (
                    <p className="text-[10px] text-muted-foreground">
                      {t("price_note")}
                    </p>
                  )}
                </div>
              </Card>
            )}

            {/* Revenue breakdown */}
            <Card className="border-border/60 mb-6">
              <div className="px-4 py-3 border-b border-border/50">
                <h2 className="text-sm font-semibold">{t("rev_split")}</h2>
              </div>
              <div className="p-4 grid grid-cols-3 gap-4 text-sm">
                <div className="rounded-lg bg-muted/40 p-4">
                  <div className="text-xs text-muted-foreground mb-1">{t("your_sub_cut")}</div>
                  <div className="text-lg font-bold text-emerald-400">80%</div>
                  <div className="text-xs text-muted-foreground mt-1">{t("after_platform")}</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-4">
                  <div className="text-xs text-muted-foreground mb-1">{t("your_perf_cut")}</div>
                  <div className="text-lg font-bold text-blue-400">80%</div>
                  <div className="text-xs text-muted-foreground mt-1">{t("hwm_basis")}</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-4">
                  <div className="text-xs text-muted-foreground mb-1">{t("platform_fee")}</div>
                  <div className="text-lg font-bold text-muted-foreground">20%</div>
                  <div className="text-xs text-muted-foreground mt-1">{t("deducted")}</div>
                </div>
              </div>
            </Card>

            {/* Monthly history */}
            <Card className="border-border/60">
              <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{t("monthly_history")}</h2>
                <span className="text-xs text-muted-foreground">{t("paid_via")}</span>
              </div>
              {data.monthly_history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Wallet className="h-8 w-8 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">{t("no_payouts")}</p>
                </div>
              ) : (
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
              )}
            </Card>

            <div className="mt-4 flex items-start gap-3 text-xs text-muted-foreground bg-muted/30 border border-border/50 rounded-lg p-4">
              <Wallet className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                {t("payout_info")}{" "}
                <Link href="/dashboard/settings" className="text-foreground hover:underline inline-flex items-center gap-1">
                  {t("manage_wallet")} <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

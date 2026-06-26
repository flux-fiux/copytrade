"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen, ArrowUpRight, X, CheckCircle2, AlertTriangle, Play, ShieldAlert, FlaskConical,
  Pencil, Check, RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const gradeStyles: Record<string, string> = {
  "A+": "border-emerald-500/50 text-emerald-400",
  "A":  "border-green-500/50 text-green-400",
  "B+": "border-blue-500/50 text-blue-400",
  "B":  "border-yellow-500/50 text-yellow-400",
};

const statusStyles: Record<string, string> = {
  ACTIVE:           "border-emerald-500/30 text-emerald-400",
  PENDING:          "border-yellow-500/30 text-yellow-400",
  PAUSED:           "border-orange-500/30 text-orange-400",
  PAUSED_DRAWDOWN:  "border-red-500/30 text-red-400",
  CANCELLED:        "border-red-500/30 text-red-400",
  EXPIRED:          "border-zinc-500/30 text-zinc-400",
};

// statusLabel is now built from t() inside the component

interface Subscription {
  id: string;
  master_id: string;
  master_username?: string;
  master_grade?: string;
  price_usd?: number;
  status: string;
  mode?: string;
  lot_multiplier?: number;
  max_drawdown_pct?: number;
  next_billing_date?: string;
  pnl?: number;
  return_pct?: number;
  created_at: string;
  pause_reason?: string;
}

interface RiskStatus {
  breached: boolean;
  current_drawdown: number;
  limit: number | null;
  action: string;
}

function DrawdownBar({ current, limit, label }: { current: number; limit: number; label?: string }) {
  const ratio = limit > 0 ? current / limit : 0;
  const pct = Math.min(ratio * 100, 100);
  const color = ratio < 0.5 ? "bg-emerald-500" : ratio < 0.8 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="mt-1">
      <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
        <span>{label ?? "Drawdown"}</span>
        {current > 0 && (
          <span className={ratio >= 0.8 ? "text-red-400 font-semibold" : ""}>
            {current.toFixed(1)}% / {limit}%
          </span>
        )}
      </div>
      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RiskIndicator({ subscriptionId, token }: { subscriptionId: string; token: string }) {
  const [risk, setRisk] = useState<RiskStatus | null>(null);

  useEffect(() => {
    fetch(`${API}/api/v1/subscriptions/${subscriptionId}/risk`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setRisk(data); })
      .catch(() => {});
  }, [subscriptionId, token]);

  if (!risk || risk.limit == null) return null;
  return <DrawdownBar current={risk.current_drawdown} limit={risk.limit} />;
}

function SubscriptionsContent() {
  const t = useTranslations("subscriptions_page");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [subs, setSubs]           = useState<Subscription[]>([]);
  const [loading, setLoading]     = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [resumingId, setResumingId]     = useState<string | null>(null);
  const [renewingId, setRenewingId]     = useState<string | null>(null);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [editLot, setEditLot]           = useState("");
  const [editDd, setEditDd]             = useState("");
  const [savingId, setSavingId]         = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);
  const [successVisible, setSuccessVisible] = useState(searchParams.get("success") === "1");

  // Clean up success param from URL so it doesn't persist on refresh
  useEffect(() => {
    if (searchParams.get("success") === "1") {
      router.replace("/dashboard/subscriptions", { scroll: false });
      const t = setTimeout(() => setSuccessVisible(false), 5000);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line

  const fetchSubs = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    setSessionToken(session.access_token);
    try {
      const res = await fetch(`${API}/api/v1/subscriptions/my`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setSubs(await res.json());
    } catch {
      // API unavailable — show empty list
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  async function handleCancel(subId: string, name: string) {
    if (!confirm(t("cancel_confirm", { name }))) return;
    setCancellingId(subId);
    setErrorMsg(null);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setCancellingId(null); return; }
    try {
      const res = await fetch(`${API}/api/v1/subscriptions/cancel/${subId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error("Cancel failed");
      await fetchSubs();
    } catch {
      setErrorMsg("Failed to cancel subscription. Please try again.");
    } finally {
      setCancellingId(null);
    }
  }

  async function handleResume(subId: string) {
    setResumingId(subId);
    setErrorMsg(null);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setResumingId(null); return; }
    try {
      const res = await fetch(`${API}/api/v1/subscriptions/${subId}/resume`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error("Resume failed");
      await fetchSubs();
    } catch {
      setErrorMsg("Failed to resume subscription. Please try again.");
    } finally {
      setResumingId(null);
    }
  }

  async function handleRenew(subId: string) {
    setRenewingId(subId);
    setErrorMsg(null);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setRenewingId(null); return; }
    try {
      const res = await fetch(`${API}/api/v1/payments/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ subscription_id: subId, currency: "USDT", network: "TRON" }),
      });
      if (!res.ok) throw new Error("payment failed");
      const payment = await res.json();
      window.location.href = payment.payment_url || "/dashboard/subscriptions";
    } catch {
      setErrorMsg("Failed to start payment. Please try again.");
      setRenewingId(null);
    }
  }

  function startEdit(s: Subscription) {
    setEditingId(s.id);
    setEditLot(s.lot_multiplier?.toFixed(2) ?? "1.00");
    setEditDd(s.max_drawdown_pct?.toFixed(0) ?? "");
  }

  async function handleSaveSettings(subId: string) {
    setSavingId(subId);
    setErrorMsg(null);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSavingId(null); return; }
    try {
      const body: Record<string, number> = {};
      const lot = parseFloat(editLot);
      const dd  = parseFloat(editDd);
      if (!isNaN(lot) && lot > 0) body.lot_multiplier = lot;
      if (!isNaN(dd)  && dd  > 0) body.max_drawdown_pct = dd;
      const res = await fetch(`${API}/api/v1/subscriptions/${subId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Save failed");
      setEditingId(null);
      await fetchSubs();
    } catch {
      setErrorMsg("Failed to update settings.");
    } finally {
      setSavingId(null);
    }
  }

  const activeSubs = subs.filter((s) => s.status === "ACTIVE");

  return (
    <div className="px-6 py-6">
      <div className="max-w-3xl mx-auto">
        {successVisible && (
          <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 mb-6">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <p className="text-sm text-emerald-400 font-medium">
              {t("success_msg")}
            </p>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-6">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{errorMsg}</p>
            <button onClick={() => setErrorMsg(null)} className="ml-auto text-red-400 hover:text-red-300">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? t("loading_short") : t("active_count", { count: activeSubs.length })}
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 rounded-lg border border-border/50 bg-muted/20 animate-pulse" />
            ))}
          </div>
        ) : subs.length === 0 ? (
          <div className="text-center py-16 border border-border/50 rounded-lg">
            <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-4" />
            <p className="font-medium mb-2">{t("empty_title")}</p>
            <p className="text-sm text-muted-foreground mb-6">
              {t("empty_desc")}
            </p>
            <Link href="/leaderboard" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
              <ArrowUpRight className="h-4 w-4" /> {t("browse_leaderboard")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {subs.map((s) => (
              <Card
                key={s.id}
                className={cn(
                  "border-border/60",
                  s.status === "PAUSED" && "border-orange-500/40 bg-orange-500/5"
                )}
              >
                <CardContent className="p-5">
                  {(s.status === "PAUSED" || s.status === "PAUSED_DRAWDOWN") && (
                    <div className={cn(
                      "flex items-start gap-2 rounded-md px-3 py-2 mb-4 text-sm border",
                      s.status === "PAUSED_DRAWDOWN"
                        ? "bg-red-500/10 border-red-500/30"
                        : "bg-orange-500/10 border-orange-500/30"
                    )}>
                      <ShieldAlert className={cn("h-4 w-4 shrink-0 mt-0.5", s.status === "PAUSED_DRAWDOWN" ? "text-red-400" : "text-orange-400")} />
                      <div className="flex-1 min-w-0">
                        <span className={cn("font-medium", s.status === "PAUSED_DRAWDOWN" ? "text-red-400" : "text-orange-400")}>
                          {s.status === "PAUSED_DRAWDOWN" ? t("paused_drawdown_msg") : t("paused_msg")}
                        </span>
                        {s.pause_reason && (
                          <p className="text-xs text-muted-foreground mt-0.5">{s.pause_reason}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleResume(s.id)}
                        disabled={resumingId === s.id}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "shrink-0 gap-1.5 disabled:opacity-50",
                          s.status === "PAUSED_DRAWDOWN"
                            ? "border-red-500/40 text-red-400 hover:bg-red-500/10"
                            : "border-orange-500/40 text-orange-400 hover:bg-orange-500/10"
                        )}
                      >
                        <Play className="h-3 w-3" />
                        {resumingId === s.id ? t("resuming") : t("resume_btn")}
                      </button>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                          {(s.master_username ?? "??").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">
                            {s.master_username ?? s.master_id.slice(0, 8)}
                          </span>
                          {s.master_grade && (
                            <Badge className={cn("text-[10px] border px-1.5 py-0", gradeStyles[s.master_grade] ?? "")}>
                              {s.master_grade}
                            </Badge>
                          )}
                          {s.mode === "paper" && (
                            <Badge variant="outline" className="text-[10px] border border-amber-500/40 text-amber-400 px-1.5 py-0 gap-1">
                              <FlaskConical className="h-2.5 w-2.5" />{t("paper_mode")}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {t("since")} {new Date(s.created_at).toLocaleDateString()}
                          {s.next_billing_date && ` · ${t("next_billing")} ${new Date(s.next_billing_date).toLocaleDateString()}`}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] border shrink-0", statusStyles[s.status] ?? "border-border text-muted-foreground")}
                    >
                      {(s.status === "PAUSED" || s.status === "PAUSED_DRAWDOWN") && <AlertTriangle className="h-2.5 w-2.5 mr-1" />}
                      {s.status === "ACTIVE" ? t("status_active") : s.status === "PENDING" ? t("status_pending") : s.status === "PAUSED" ? t("status_paused") : s.status === "PAUSED_DRAWDOWN" ? t("status_paused_drawdown") : s.status === "CANCELLED" ? t("status_cancelled") : s.status === "EXPIRED" ? t("status_expired") : s.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-border/50">
                    <div>
                      <div className="text-xs text-muted-foreground">{t("monthly_fee")}</div>
                      <div className="font-semibold text-sm mt-0.5">
                        {s.mode === "paper" ? (
                          <span className="text-amber-400">{t("free")}</span>
                        ) : s.price_usd != null ? (
                          `$${s.price_usd}/月`
                        ) : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">{t("lot_multiplier")}</div>
                      <div className="font-semibold text-sm mt-0.5 font-mono">
                        {s.lot_multiplier != null ? `${s.lot_multiplier.toFixed(1)}×` : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">{t("total_pnl")}</div>
                      <div className={cn("font-semibold text-sm mt-0.5", (s.pnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {s.pnl != null ? `${s.pnl >= 0 ? "+" : ""}$${s.pnl.toFixed(2)}` : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">{t("return_pct")}</div>
                      <div className={cn("font-semibold text-sm mt-0.5", (s.return_pct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {s.return_pct != null ? `${s.return_pct >= 0 ? "+" : ""}${s.return_pct.toFixed(1)}%` : "—"}
                      </div>
                    </div>
                  </div>

                  {s.max_drawdown_pct != null && s.status !== "CANCELLED" && (
                    <div className="mt-2">
                      <DrawdownBar current={0} limit={s.max_drawdown_pct} label={t("drawdown_limit", { pct: s.max_drawdown_pct })} />
                    </div>
                  )}

                  {sessionToken && s.status === "ACTIVE" && s.max_drawdown_pct == null && (
                    <div className="mt-2">
                      <RiskIndicator subscriptionId={s.id} token={sessionToken} />
                    </div>
                  )}

                  {/* Inline settings editor */}
                  {editingId === s.id && (
                    <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap gap-3 items-end">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">{t("lot_label")}</label>
                        <input
                          type="number" step="0.01" min="0.01" max="10"
                          value={editLot} onChange={e => setEditLot(e.target.value)}
                          className="w-24 px-2 py-1.5 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">{t("dd_label")}</label>
                        <input
                          type="number" step="1" min="1" max="100"
                          value={editDd} onChange={e => setEditDd(e.target.value)}
                          placeholder={t("dd_placeholder")}
                          className="w-24 px-2 py-1.5 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <button
                        onClick={() => handleSaveSettings(s.id)}
                        disabled={savingId === s.id}
                        className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
                      >
                        <Check className="h-3.5 w-3.5" />
                        {savingId === s.id ? t("saving") : t("save")}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}
                      >
                        <X className="h-3.5 w-3.5" /> {t("cancel_btn")}
                      </button>
                    </div>
                  )}

                  <div className="flex gap-2 mt-4">
                    {(s.status === "EXPIRED" || s.status === "PENDING") && (
                      <button
                        onClick={() => handleRenew(s.id)}
                        disabled={renewingId === s.id}
                        className={cn(buttonVariants({ size: "sm" }), "gap-1.5 disabled:opacity-50")}
                      >
                        <RefreshCw className={cn("h-3.5 w-3.5", renewingId === s.id && "animate-spin")} />
                        {renewingId === s.id ? t("renewing") : s.status === "PENDING" ? t("pay_now") : t("renew_btn")}
                      </button>
                    )}
                    <Link
                      href={`/masters/${s.master_id}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" /> {t("view_master")}
                    </Link>
                    {(s.status === "ACTIVE" || s.status === "PAUSED" || s.status === "PAUSED_DRAWDOWN") && editingId !== s.id && (
                      <button
                        onClick={() => startEdit(s)}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
                      >
                        <Pencil className="h-3.5 w-3.5" /> {t("edit_settings")}
                      </button>
                    )}
                    {(s.status === "ACTIVE" || s.status === "PAUSED" || s.status === "PAUSED_DRAWDOWN") && (
                      <button
                        onClick={() => handleCancel(s.id, s.master_username ?? "this master")}
                        disabled={cancellingId === s.id}
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" }),
                          "gap-1.5 text-destructive hover:text-destructive disabled:opacity-50"
                        )}
                      >
                        <X className="h-3.5 w-3.5" />
                        {cancellingId === s.id ? t("cancelling") : t("cancel_sub")}
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && subs.length > 0 && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-3">{t("more_providers")}</p>
            <Link href="/leaderboard" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
              <ArrowUpRight className="h-4 w-4" /> {t("browse_leaderboard")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading…</div>}>
      <SubscriptionsContent />
    </Suspense>
  );
}

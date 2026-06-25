"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle, XCircle, RefreshCw, Clock, UserCheck, ChevronDown, ChevronUp, TrendingDown, TrendingUp, DollarSign } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PendingMaster {
  id: string;
  email: string;
  username: string | null;
  display_name: string | null;
  roles: string[];
  kyc_status: string;
  is_active: boolean;
  created_at: string;
  mt4_account_count: number;
  apply_strategy: string | null;
  apply_description: string | null;
  apply_trading_style: string | null;
  apply_monthly_return_pct: number | null;
  apply_max_drawdown_pct: number | null;
  apply_price_usd: number | null;
  apply_perf_fee_pct: number | null;
  applied_at: string | null;
}

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

export default function MasterApprovalsPage() {
  const [masters, setMasters] = useState<PendingMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (type: "success" | "error", message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const loadMasters = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const res = await fetch(`${API_BASE}/api/v1/admin/masters/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load");
      setMasters(await res.json());
    } catch {
      addToast("error", "Failed to load pending masters — showing mock data");
      setMasters(MOCK_PENDING);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMasters(); }, [loadMasters]);

  const handleApprove = async (userId: string, name: string) => {
    setActionLoading(userId);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const res = await fetch(`${API_BASE}/api/v1/admin/masters/${userId}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Approve failed");
      addToast("success", `${name || userId} approved as Master`);
      setMasters((prev) => prev.filter((m) => m.id !== userId));
    } catch {
      addToast("error", "Failed to approve — try again");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (userId: string, name: string) => {
    if (!confirm(`Reject master application for ${name || userId}?`)) return;
    setActionLoading(userId);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const res = await fetch(`${API_BASE}/api/v1/admin/masters/${userId}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Reject failed");
      addToast("success", `Application for ${name || userId} rejected`);
      setMasters((prev) => prev.filter((m) => m.id !== userId));
    } catch {
      addToast("error", "Failed to reject — try again");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
              t.type === "success"
                ? "bg-emerald-500/90 text-white"
                : "bg-red-500/90 text-white"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Master Approval Queue</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {masters.length} application{masters.length !== 1 ? "s" : ""} pending review
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadMasters} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : masters.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <UserCheck className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="font-medium">All caught up!</p>
          <p className="text-sm text-muted-foreground mt-1">No pending master applications.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-4 py-3 bg-muted/40 text-xs text-muted-foreground font-medium uppercase tracking-wide border-b border-border">
            <div>User</div>
            <div />
            <div>KYC</div>
            <div>MT4 Accts</div>
            <div>Applied</div>
            <div>Actions</div>
          </div>
          {masters.map((m) => {
            const name = m.display_name || m.username || m.email;
            const initials = name.slice(0, 2).toUpperCase();
            const isBusy = actionLoading === m.id;
            const isExpanded = expandedId === m.id;
            const hasApplication = !!m.apply_strategy;
            return (
              <div key={m.id} className="border-b border-border/50 last:border-0">
                <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-4 items-center">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{name}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    {m.apply_strategy && (
                      <p className="text-xs text-primary mt-0.5 truncate">{m.apply_strategy}</p>
                    )}
                  </div>
                  <Badge className="text-xs border-amber-500/40 text-amber-400 bg-amber-500/10">
                    <Clock className="h-3 w-3 mr-1" />
                    {m.kyc_status}
                  </Badge>
                  <span className="text-sm text-center">{m.mt4_account_count}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {m.applied_at
                      ? new Date(m.applied_at).toLocaleDateString()
                      : new Date(m.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1"
                      onClick={() => handleApprove(m.id, name)}
                      disabled={isBusy}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1"
                      onClick={() => handleReject(m.id, name)}
                      disabled={isBusy}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                  </div>
                  {hasApplication && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedId(isExpanded ? null : m.id)}
                      className="px-2"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  )}
                </div>

                {/* Expanded application details */}
                {isExpanded && hasApplication && (
                  <div className="px-4 pb-4 bg-muted/20 border-t border-border/40">
                    <div className="pt-3 space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { icon: TrendingUp, label: "Style", value: m.apply_trading_style ?? "—" },
                          { icon: TrendingDown, label: "Max Drawdown", value: m.apply_max_drawdown_pct != null ? `${m.apply_max_drawdown_pct}%` : "—" },
                          { icon: TrendingUp, label: "Target Return", value: m.apply_monthly_return_pct != null ? `${m.apply_monthly_return_pct}%/mo` : "—" },
                          { icon: DollarSign, label: "Sub Price", value: m.apply_price_usd != null ? `$${m.apply_price_usd}/mo` : "—" },
                          { icon: DollarSign, label: "Perf Fee", value: m.apply_perf_fee_pct != null ? `${m.apply_perf_fee_pct}%` : "—" },
                        ].map(({ icon: Icon, label, value }) => (
                          <div key={label} className="rounded-lg border border-border/50 bg-background p-3">
                            <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
                            <div className="text-sm font-semibold">{value}</div>
                          </div>
                        ))}
                      </div>
                      {m.apply_description && (
                        <div className="rounded-lg border border-border/50 bg-background p-3">
                          <div className="text-[10px] text-muted-foreground mb-1">Application Description</div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{m.apply_description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const MOCK_PENDING: PendingMaster[] = [
  { id: "m1", email: "trader1@example.com", username: "AlphaWave", display_name: "AlphaWave FX", roles: ["FOLLOWER"], kyc_status: "PENDING", is_active: true, created_at: "2026-06-20T10:00:00Z", mt4_account_count: 2, apply_strategy: "AlphaWave Momentum", apply_description: "I trade EURUSD and GBPUSD with a momentum-based system that captures intraday trends with tight stops.", apply_trading_style: "SWING", apply_monthly_return_pct: 8.5, apply_max_drawdown_pct: 12, apply_price_usd: 29, apply_perf_fee_pct: 10, applied_at: "2026-06-20T10:00:00Z" },
  { id: "m2", email: "goldtrader@example.com", username: "GoldPro", display_name: "Gold Trader Pro", roles: ["FOLLOWER"], kyc_status: "PENDING", is_active: true, created_at: "2026-06-21T14:30:00Z", mt4_account_count: 1, apply_strategy: "Gold Scalping Pro", apply_description: "Scalping XAUUSD on H1 timeframe using custom RSI divergence signals.", apply_trading_style: "SCALPING", apply_monthly_return_pct: 15, apply_max_drawdown_pct: 8, apply_price_usd: 49, apply_perf_fee_pct: 20, applied_at: "2026-06-21T14:30:00Z" },
  { id: "m3", email: "scalper99@example.com", username: null, display_name: null, roles: ["FOLLOWER"], kyc_status: "PENDING", is_active: true, created_at: "2026-06-22T08:15:00Z", mt4_account_count: 3, apply_strategy: null, apply_description: null, apply_trading_style: null, apply_monthly_return_pct: null, apply_max_drawdown_pct: null, apply_price_usd: null, apply_perf_fee_pct: null, applied_at: null },
];

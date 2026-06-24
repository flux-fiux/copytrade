"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle, XCircle, RefreshCw, Clock, UserCheck } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
            return (
              <div
                key={m.id}
                className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-4 py-4 items-center border-b border-border/50 last:border-0"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium truncate">{name}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                </div>
                <Badge className="text-xs border-amber-500/40 text-amber-400 bg-amber-500/10">
                  <Clock className="h-3 w-3 mr-1" />
                  {m.kyc_status}
                </Badge>
                <span className="text-sm text-center">{m.mt4_account_count}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(m.created_at).toLocaleDateString()}
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const MOCK_PENDING: PendingMaster[] = [
  { id: "m1", email: "trader1@example.com", username: "AlphaWave", display_name: "AlphaWave FX", roles: ["FOLLOWER"], kyc_status: "PENDING", is_active: true, created_at: "2026-06-20T10:00:00Z", mt4_account_count: 2 },
  { id: "m2", email: "goldtrader@example.com", username: "GoldPro", display_name: "Gold Trader Pro", roles: ["FOLLOWER"], kyc_status: "PENDING", is_active: true, created_at: "2026-06-21T14:30:00Z", mt4_account_count: 1 },
  { id: "m3", email: "scalper99@example.com", username: null, display_name: null, roles: ["FOLLOWER"], kyc_status: "PENDING", is_active: true, created_at: "2026-06-22T08:15:00Z", mt4_account_count: 3 },
];

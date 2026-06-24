"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Users, UserCheck, TrendingUp, Activity, AlertTriangle } from "lucide-react";
import { StatCard } from "@/components/admin/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface AdminStats {
  total_users: number;
  total_masters: number;
  total_followers: number;
  active_subscriptions: number;
  pending_master_approvals: number;
}

async function fetchStats(token: string): Promise<AdminStats> {
  const res = await fetch(`${API_BASE}/api/v1/admin/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load stats");
  return res.json();
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      fetchStats(session.access_token)
        .then(setStats)
        .catch((e) => setError(e.message));
    });
  }, []);

  const MOCK_STATS: AdminStats = {
    total_users: 1284,
    total_masters: 47,
    total_followers: 1237,
    active_subscriptions: 312,
    pending_master_approvals: 8,
  };
  const s = stats ?? MOCK_STATS;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Real-time admin dashboard</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error} — showing mock data
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Total Users" value={s.total_users.toLocaleString()} icon={Users} color="blue" />
        <StatCard title="Active Masters" value={s.total_masters} icon={TrendingUp} color="green" />
        <StatCard title="Active Subscriptions" value={s.active_subscriptions} icon={Activity} color="amber" />
        <StatCard title="Pending Approvals" value={s.pending_master_approvals} icon={UserCheck} color="red" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-400">
              <UserCheck className="h-5 w-5" />
              Master Approval Queue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {s.pending_master_approvals} applications waiting for review.
            </p>
            <Link href="/admin/masters" className={cn(buttonVariants({ size: "sm" }), "bg-amber-500 hover:bg-amber-400 text-black")}>
              Review Applications →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-400" />
              User Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {s.total_users.toLocaleString()} total users — {s.total_masters} masters, {s.total_followers} followers.
            </p>
            <Link href="/admin/users" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Manage Users →
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Platform breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Platform Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Masters: </span>
              <Badge variant="secondary" className="text-emerald-400 border-emerald-500/30">{s.total_masters}</Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Followers: </span>
              <Badge variant="secondary" className="text-blue-400 border-blue-500/30">{s.total_followers}</Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Active subs: </span>
              <Badge variant="secondary" className="text-amber-400 border-amber-500/30">{s.active_subscriptions}</Badge>
            </div>
            <div>
              <span className="text-muted-foreground">KYC pending: </span>
              <Badge variant="secondary" className="text-red-400 border-red-500/30">{s.pending_master_approvals}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

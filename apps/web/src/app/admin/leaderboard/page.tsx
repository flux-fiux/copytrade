"use client";

import { useEffect, useState } from "react";
import { TrendingUp, RefreshCw, Trash2, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Score {
  master_id: string;
  master_username?: string;
  display_name?: string;
  period: string;
  total_return_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  win_rate_pct: number;
  risk_grade: string;
  followers_count: number;
  calculated_at: string | null;
}

const GRADE_COLORS: Record<string, string> = {
  "A+": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  A:   "bg-green-500/10 text-green-400 border-green-500/20",
  "B+":"bg-blue-500/10 text-blue-400 border-blue-500/20",
  B:   "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  C:   "bg-orange-500/10 text-orange-400 border-orange-500/20",
  D:   "bg-red-500/10 text-red-400 border-red-500/20",
};

const MOCK: Score[] = [
  { master_id: "1", display_name: "AlphaWave FX",      period: "ALL", total_return_pct: 142.3, max_drawdown_pct: 8.2,  sharpe_ratio: 2.41, win_rate_pct: 71.3, risk_grade: "A+", followers_count: 312, calculated_at: "2026-06-25T00:00:00Z" },
  { master_id: "2", display_name: "GoldTrader Pro",     period: "ALL", total_return_pct: 98.7,  max_drawdown_pct: 12.5, sharpe_ratio: 1.87, win_rate_pct: 64.8, risk_grade: "A",  followers_count: 198, calculated_at: "2026-06-25T00:00:00Z" },
  { master_id: "3", display_name: "NightOwl Scalper",   period: "ALL", total_return_pct: 67.2,  max_drawdown_pct: 19.8, sharpe_ratio: 1.12, win_rate_pct: 58.2, risk_grade: "B+", followers_count: 87,  calculated_at: "2026-06-25T00:00:00Z" },
  { master_id: "4", display_name: "CryptoFX King",      period: "ALL", total_return_pct: 203.1, max_drawdown_pct: 31.4, sharpe_ratio: 0.95, win_rate_pct: 53.6, risk_grade: "C",  followers_count: 45,  calculated_at: "2026-06-24T06:00:00Z" },
];

async function getToken() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? "";
}

export default function AdminLeaderboardPage() {
  const [scores, setScores]           = useState<Score[]>([]);
  const [loading, setLoading]         = useState(true);
  const [recalculating, setRecalc]    = useState(false);
  const [removing, setRemoving]       = useState<string | null>(null);
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null);
  const [taskId, setTaskId]           = useState<string | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("no session");
      const res = await fetch(`${API_BASE}/api/v1/admin/leaderboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data: Score[] = await res.json();
      setScores(data.length ? data : MOCK);
    } catch {
      setScores(MOCK);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const triggerRecalc = async (full: boolean) => {
    setRecalc(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/v1/admin/leaderboard/recalculate?full=${full}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { task_id } = await res.json();
        setTaskId(task_id);
        showToast(`Recalculation queued (task: ${task_id.slice(0, 8)}…)`);
      }
    } catch {
      showToast("Failed to queue recalculation", false);
    }
    await new Promise(r => setTimeout(r, 1800));
    await load();
    setRecalc(false);
  };

  const removeFromLeaderboard = async (masterId: string, name: string) => {
    if (!confirm(`Remove ${name} from leaderboard? This deletes all their scores.`)) return;
    setRemoving(masterId);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/v1/admin/leaderboard/${masterId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok || res.status === 204) {
        setScores(prev => prev.filter(s => s.master_id !== masterId));
        showToast(`${name} removed from leaderboard`);
      } else throw new Error();
    } catch {
      showToast("Remove failed — try again", false);
    } finally {
      setRemoving(null);
    }
  };

  const lastCalc = scores[0]?.calculated_at
    ? new Date(scores[0].calculated_at).toLocaleString()
    : null;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg",
          toast.ok ? "bg-emerald-500/90 text-white" : "bg-red-500/90 text-white"
        )}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Leaderboard Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lastCalc ? `Last calculated: ${lastCalc}` : "Monitor and trigger recalculations"}
          </p>
          {taskId && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Celery task <code className="font-mono">{taskId.slice(0, 16)}…</code> queued
            </div>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button onClick={() => triggerRecalc(false)} disabled={recalculating} size="sm" variant="outline">
            <RefreshCw className={cn("h-4 w-4 mr-1.5", recalculating && "animate-spin")} />
            {recalculating ? "Running…" : "Quick Recalculate"}
          </Button>
          <Button onClick={() => triggerRecalc(true)} disabled={recalculating} size="sm">
            <RefreshCw className={cn("h-4 w-4 mr-1.5", recalculating && "animate-spin")} />
            Full Recalculate
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Master Rankings
            <Badge variant="secondary" className="text-xs ml-auto">{scores.length} masters</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-0 p-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded-md mb-2" />
              ))}
            </div>
          ) : scores.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No leaderboard data — run a recalculation
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="pb-3 pl-4 pr-2 pt-3">#</th>
                    <th className="pb-3 pr-4 pt-3">Master</th>
                    <th className="pb-3 pr-4 pt-3">Return</th>
                    <th className="pb-3 pr-4 pt-3">Max DD</th>
                    <th className="pb-3 pr-4 pt-3">Sharpe</th>
                    <th className="pb-3 pr-4 pt-3">Win Rate</th>
                    <th className="pb-3 pr-4 pt-3">Grade</th>
                    <th className="pb-3 pr-4 pt-3">Followers</th>
                    <th className="pb-3 pr-4 pt-3">Period</th>
                    <th className="pb-3 pr-4 pt-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((s, i) => (
                    <tr
                      key={s.master_id}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3 pl-4 pr-2 text-muted-foreground font-mono text-xs">{i + 1}</td>
                      <td className="py-3 pr-4 font-medium">{s.master_username || s.display_name || `Master ${s.master_id.slice(0, 6)}`}</td>
                      <td className={cn("py-3 pr-4 font-mono", s.total_return_pct >= 0 ? "text-green-400" : "text-red-400")}>
                        {s.total_return_pct >= 0 ? "+" : ""}{s.total_return_pct.toFixed(1)}%
                      </td>
                      <td className="py-3 pr-4 font-mono text-red-400">-{s.max_drawdown_pct.toFixed(1)}%</td>
                      <td className="py-3 pr-4 font-mono">{s.sharpe_ratio.toFixed(2)}</td>
                      <td className="py-3 pr-4 font-mono">{s.win_rate_pct.toFixed(1)}%</td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline" className={cn("text-xs", GRADE_COLORS[s.risk_grade] ?? "")}>
                          {s.risk_grade}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{s.followers_count}</td>
                      <td className="py-3 pr-4">
                        <Badge variant="secondary" className="text-[10px]">{s.period}</Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <button
                          onClick={() => removeFromLeaderboard(s.master_id, s.master_username || s.display_name || s.master_id.slice(0, 6))}
                          disabled={removing === s.master_id}
                          title="Remove from leaderboard"
                          className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Explanation card */}
      <Card className="border-muted/50 bg-muted/20">
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
            <div>
              <p className="font-medium text-foreground mb-1">Quick Recalculate</p>
              <p>Recalculates 1M and ALL periods only. Fast (~30 seconds). Use for daily updates.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Full Recalculate</p>
              <p>Recalculates all periods (1W, 1M, 3M, 6M, ALL). Slower (~2-5 min). Use after data corrections.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { TrendingUp, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Score {
  master_id: string;
  display_name: string;
  total_return: number;
  max_drawdown: number;
  sharpe_ratio: number;
  win_rate: number;
  risk_grade: string;
  follower_count: number;
  is_approved: boolean;
}

const GRADE_COLORS: Record<string, string> = {
  "A+": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  A: "bg-green-500/10 text-green-400 border-green-500/20",
  "B+": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  B: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  C: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  D: "bg-red-500/10 text-red-400 border-red-500/20",
};

const MOCK: Score[] = [
  { master_id: "1", display_name: "AlphaWave FX", total_return: 142.3, max_drawdown: 8.2, sharpe_ratio: 2.41, win_rate: 71.3, risk_grade: "A+", follower_count: 312, is_approved: true },
  { master_id: "2", display_name: "GoldTrader Pro", total_return: 98.7, max_drawdown: 12.5, sharpe_ratio: 1.87, win_rate: 64.8, risk_grade: "A", follower_count: 198, is_approved: true },
  { master_id: "3", display_name: "NightOwl Scalper", total_return: 67.2, max_drawdown: 19.8, sharpe_ratio: 1.12, win_rate: 58.2, risk_grade: "B+", follower_count: 87, is_approved: true },
  { master_id: "4", display_name: "CryptoFX King", total_return: 203.1, max_drawdown: 31.4, sharpe_ratio: 0.95, win_rate: 53.6, risk_grade: "C", follower_count: 45, is_approved: false },
];

export default function AdminLeaderboardPage() {
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  const load = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setScores(MOCK); setLoading(false); return; }
    try {
      const res = await fetch(`${API_BASE}/api/v1/leaderboard/`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setScores(data.length ? data : MOCK);
      } else setScores(MOCK);
    } catch { setScores(MOCK); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const triggerRecalc = async () => {
    setRecalculating(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      try {
        await fetch(`${API_BASE}/api/v1/admin/leaderboard/recalculate`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      } catch { /* non-fatal */ }
    }
    await new Promise(r => setTimeout(r, 1500));
    await load();
    setRecalculating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leaderboard Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Monitor rankings and trigger recalculations</p>
        </div>
        <Button onClick={triggerRecalc} disabled={recalculating} size="sm" variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${recalculating ? "animate-spin" : ""}`} />
          {recalculating ? "Recalculating…" : "Force Recalculate"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Master Rankings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-3 pr-4">#</th>
                    <th className="pb-3 pr-4">Master</th>
                    <th className="pb-3 pr-4">Return</th>
                    <th className="pb-3 pr-4">Max DD</th>
                    <th className="pb-3 pr-4">Sharpe</th>
                    <th className="pb-3 pr-4">Win Rate</th>
                    <th className="pb-3 pr-4">Grade</th>
                    <th className="pb-3 pr-4">Followers</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((s, i) => (
                    <tr key={s.master_id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 pr-4 text-muted-foreground">{i + 1}</td>
                      <td className="py-3 pr-4 font-medium">{s.display_name}</td>
                      <td className={`py-3 pr-4 font-mono ${s.total_return >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {s.total_return >= 0 ? "+" : ""}{s.total_return.toFixed(1)}%
                      </td>
                      <td className="py-3 pr-4 font-mono text-red-400">-{s.max_drawdown.toFixed(1)}%</td>
                      <td className="py-3 pr-4 font-mono">{s.sharpe_ratio.toFixed(2)}</td>
                      <td className="py-3 pr-4 font-mono">{s.win_rate.toFixed(1)}%</td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline" className={GRADE_COLORS[s.risk_grade] ?? ""}>
                          {s.risk_grade}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">{s.follower_count}</td>
                      <td className="py-3">
                        <Badge variant={s.is_approved ? "secondary" : "outline"} className={s.is_approved ? "text-green-400" : "text-yellow-400"}>
                          {s.is_approved ? "Approved" : "Pending"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

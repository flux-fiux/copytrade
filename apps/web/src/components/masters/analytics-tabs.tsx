"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, CartesianGrid,
} from "recharts";
import { Loader2, TrendingUp, TrendingDown, Zap, ChevronDown, ChevronUp, Play, RotateCcw } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

interface BacktestResult {
  total_trades: number;
  equity_curve: { date: string; equity: number }[];
  final_equity: number;
  total_return_pct: number;
  max_drawdown_pct: number;
  win_rate: number;
  avg_profit_per_trade: number;
}

interface SessionSlot {
  hour: number;
  trades: number;
  avg_profit: number;
  win_rate: number;
}

interface AttributionRow {
  symbol: string;
  trades: number;
  total_profit: number;
  avg_profit: number;
  win_rate: number;
}

interface EdgeData {
  total_trades: number;
  win_rate: number;
  avg_win: number;
  avg_loss: number;
  expectancy: number;
  profit_factor: number | null;
  avg_rr: number;
  max_consec_wins: number;
  max_consec_losses: number;
}

// ── Custom tooltip for equity curve ────────────────────────────────────────────

function EquityTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-muted-foreground mb-0.5">{label}</div>
      <div className="font-mono font-bold text-emerald-400">${payload[0].value.toLocaleString()}</div>
    </div>
  );
}

function SessionTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-muted-foreground mb-0.5">{`${label}:00`}</div>
      <div className={cn("font-mono font-bold", v >= 0 ? "text-emerald-400" : "text-red-400")}>
        {v >= 0 ? "+" : ""}{v.toFixed(2)}
      </div>
    </div>
  );
}

// ── Backtest Tab ──────────────────────────────────────────────────────────────

function BacktestTab({ masterId }: { masterId: string }) {
  const t = useTranslations("analytics_tabs");
  const [capital, setCapital] = useState(10000);
  const [lotMult, setLotMult] = useState(1.0);
  const [days, setDays] = useState(90);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    setRan(true);
    try {
      const start = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
      const res = await fetch(
        `${API_BASE}/api/v1/analytics/masters/${masterId}/backtest?capital=${capital}&lot_multiplier=${lotMult}&start=${start}`
      );
      if (res.ok) setResult(await res.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [masterId, capital, lotMult, days]);

  const returnColor = (result?.total_return_pct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400";

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("starting_capital")} <span className="font-mono text-foreground">${capital.toLocaleString()}</span>
              </label>
              <input type="range" min={1000} max={100000} step={1000} value={capital}
                onChange={(e) => setCapital(Number(e.target.value))} className="w-full accent-primary" />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5"><span>$1K</span><span>$100K</span></div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("lot_multiplier")} <span className="font-mono text-foreground">{lotMult.toFixed(1)}×</span>
              </label>
              <input type="range" min={0.1} max={3} step={0.1} value={lotMult}
                onChange={(e) => setLotMult(Number(e.target.value))} className="w-full accent-primary" />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5"><span>0.1×</span><span>3.0×</span></div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("period")} <span className="font-mono text-foreground">{t("period_days", { days })}</span>
              </label>
              <input type="range" min={30} max={365} step={30} value={days}
                onChange={(e) => setDays(Number(e.target.value))} className="w-full accent-primary" />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5"><span>{t("period_30d")}</span><span>{t("period_365d")}</span></div>
            </div>
          </div>
          <Button onClick={run} disabled={loading} size="sm" className="gap-2">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : ran ? <RotateCcw className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {loading ? t("backtesting") : ran ? t("re_run") : t("run_backtest")}
          </Button>
          {!ran && (
            <p className="text-xs text-muted-foreground mt-2">
              {t("run_hint", { capital: capital.toLocaleString(), days })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm">
          <Loader2 className="h-5 w-5 animate-spin" />{t("calculating")}
        </div>
      )}
      {!loading && result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: t("total_return"), value: `${result.total_return_pct >= 0 ? "+" : ""}${result.total_return_pct.toFixed(2)}%`, color: returnColor },
              { label: t("final_equity"), value: `$${result.final_equity.toLocaleString()}`, color: returnColor },
              { label: t("max_drawdown"), value: `-${result.max_drawdown_pct.toFixed(2)}%`, color: "text-red-400" },
              { label: t("win_rate"), value: `${result.win_rate.toFixed(1)}%`, color: result.win_rate >= 60 ? "text-emerald-400" : "text-yellow-400" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border/50 bg-card p-3">
                <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                <p className={cn("text-xl font-bold font-mono", s.color)}>{s.value}</p>
              </div>
            ))}
          </div>

          {result.equity_curve.length > 1 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>{t("equity_curve")}</span>
                  <span className="text-xs text-muted-foreground font-normal">{t("trades_summary", { trades: result.total_trades, avg: result.avg_profit_per_trade.toFixed(2) })}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={result.equity_curve} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      tickFormatter={(v: string) => v.slice(5)}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`}
                      width={44}
                    />
                    <Tooltip content={<EquityTooltip />} />
                    <ReferenceLine y={capital} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" opacity={0.5} />
                    <Line
                      type="monotone"
                      dataKey="equity"
                      stroke={result.total_return_pct >= 0 ? "hsl(var(--chart-1, #10b981))" : "#ef4444"}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-[10px] text-muted-foreground text-center mt-1">{t("baseline_note", { capital: capital.toLocaleString() })}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {result.total_trades === 0 ? t("no_trades_in_period") : t("insufficient_trades")}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Session Tab ───────────────────────────────────────────────────────────────

function SessionTab({ masterId }: { masterId: string }) {
  const t = useTranslations("analytics_tabs");
  const [data, setData] = useState<SessionSlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/analytics/masters/${masterId}/session-stats`)
      .then((r) => r.ok ? r.json() : [])
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [masterId]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const hasTrades = data.some((d) => d.trades > 0);
  const bestHour = data.reduce((b, d) => d.avg_profit > b.avg_profit ? d : b, data[0]);
  const worstHour = data.reduce((w, d) => d.avg_profit < w.avg_profit ? d : w, data[0]);

  return (
    <div className="space-y-4">
      {hasTrades && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="text-xs text-muted-foreground mb-1">{t("best_session")}</p>
            <p className="text-xl font-bold font-mono text-emerald-400">{bestHour?.hour}:00</p>
            <p className="text-xs text-muted-foreground">{t("session_win_avg", { avg: bestHour?.avg_profit.toFixed(2), n: bestHour?.trades })}</p>
          </div>
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3">
            <p className="text-xs text-muted-foreground mb-1">{t("worst_session")}</p>
            <p className="text-xl font-bold font-mono text-red-400">{worstHour?.hour}:00</p>
            <p className="text-xs text-muted-foreground">{t("session_win_avg", { avg: worstHour?.avg_profit.toFixed(2), n: worstHour?.trades })}</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t("session_title")}</CardTitle>
          <p className="text-xs text-muted-foreground">{t("session_subtitle")}</p>
        </CardHeader>
        <CardContent className="pt-0 pb-4">
          {!hasTrades ? (
            <div className="py-12 text-center text-sm text-muted-foreground">{t("no_session_data")}</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v}h`}
                  interval={2}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip content={<SessionTooltip />} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} />
                <Bar dataKey="avg_profit" radius={[3, 3, 0, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={index} fill={entry.avg_profit >= 0 ? "#10b981" : "#ef4444"} opacity={entry.trades === 0 ? 0.15 : 0.75} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {hasTrades && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          {data.filter(d => d.trades > 0).sort((a, b) => b.avg_profit - a.avg_profit).slice(0, 6).map((s) => (
            <div key={s.hour} className="rounded-lg bg-muted/30 p-2">
              <div className="font-mono font-bold text-sm">{s.hour}:00</div>
              <div className={cn("font-mono", s.avg_profit >= 0 ? "text-emerald-400" : "text-red-400")}>
                {s.avg_profit >= 0 ? "+" : ""}{s.avg_profit.toFixed(2)}
              </div>
              <div className="text-muted-foreground">{t("trades_winrate", { n: s.trades, pct: s.win_rate })}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Attribution Tab ───────────────────────────────────────────────────────────

function AttributionTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="font-mono font-bold mb-0.5">{label}</div>
      <div className={cn("font-mono font-bold", v >= 0 ? "text-emerald-400" : "text-red-400")}>
        {v >= 0 ? "+" : ""}${v.toFixed(2)}
      </div>
    </div>
  );
}

function AttributionTab({ masterId }: { masterId: string }) {
  const t = useTranslations("analytics_tabs");
  const [data, setData] = useState<AttributionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/analytics/masters/${masterId}/attribution`)
      .then((r) => r.ok ? r.json() : [])
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [masterId]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const top10 = data.slice(0, 10);
  const totalProfit = data.reduce((s, d) => s + d.total_profit, 0);

  if (data.length === 0) {
    return <div className="py-16 text-center text-sm text-muted-foreground">{t("no_attribution")}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/50 bg-card p-3">
          <p className="text-xs text-muted-foreground mb-1">{t("total_pnl")}</p>
          <p className={cn("text-xl font-bold font-mono", totalProfit >= 0 ? "text-emerald-400" : "text-red-400")}>
            {totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-3">
          <p className="text-xs text-muted-foreground mb-1">{t("symbols_count")}</p>
          <p className="text-xl font-bold font-mono">{data.length}</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-3">
          <p className="text-xs text-muted-foreground mb-1">{t("best_symbol")}</p>
          <p className="text-xl font-bold font-mono text-emerald-400">{data[0]?.symbol ?? "—"}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t("attribution_title")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-4">
          <ResponsiveContainer width="100%" height={Math.max(160, top10.length * 34)}>
            <BarChart data={top10} layout="vertical" margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
              <YAxis type="category" dataKey="symbol" tick={{ fontSize: 11, fill: "hsl(var(--foreground))", fontFamily: "monospace" }} tickLine={false} axisLine={false} width={56} />
              <Tooltip content={<AttributionTooltip />} />
              <ReferenceLine x={0} stroke="hsl(var(--border))" />
              <Bar dataKey="total_profit" radius={[0, 3, 3, 0]}>
                {top10.map((entry, i) => (
                  <Cell key={i} fill={entry.total_profit >= 0 ? "#10b981" : "#ef4444"} opacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="space-y-1">
        {data.map((row) => (
          <div key={row.symbol} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors text-sm">
            <span className="font-mono font-medium w-16 shrink-0">{row.symbol}</span>
            <div className="flex-1 bg-border/30 rounded-full h-1.5 overflow-hidden">
              <div
                className={cn("h-full rounded-full", row.total_profit >= 0 ? "bg-emerald-500" : "bg-red-500")}
                style={{ width: `${Math.min(Math.abs(row.total_profit) / (Math.abs(totalProfit) || 1) * 100, 100)}%` }}
              />
            </div>
            <span className={cn("font-mono text-xs w-20 text-right shrink-0", row.total_profit >= 0 ? "text-emerald-400" : "text-red-400")}>
              {row.total_profit >= 0 ? "+" : ""}${row.total_profit.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground w-16 text-right shrink-0">{t("trades_winrate", { n: row.trades, pct: row.win_rate })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Edge Tab ─────────────────────────────────────────────────────────────────

function EdgeTab({ masterId }: { masterId: string }) {
  const t = useTranslations("analytics_tabs");
  const [data, setData] = useState<EdgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/analytics/masters/${masterId}/edge`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [masterId]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (error || !data) return <div className="py-16 text-center text-sm text-muted-foreground">{t("no_edge_data")}</div>;

  const expectancyColor = data.expectancy > 0 ? "text-emerald-400" : data.expectancy < 0 ? "text-red-400" : "text-muted-foreground";
  const pfColor = (data.profit_factor ?? 0) > 1.5 ? "text-emerald-400" : (data.profit_factor ?? 0) > 1 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="space-y-4">
      {/* Expectancy highlight */}
      <Card className={cn("border", data.expectancy > 0 ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5")}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t("expectancy")}</p>
              <p className={cn("text-3xl font-bold font-mono", expectancyColor)}>
                {data.expectancy > 0 ? "+" : ""}{data.expectancy.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{t("expectancy_formula")}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">{t("profit_factor")}</p>
              <p className={cn("text-2xl font-bold font-mono", pfColor)}>
                {data.profit_factor != null ? data.profit_factor.toFixed(2) : "∞"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{t("pf_excellent")}</p>
            </div>
          </div>

          {/* Visual formula */}
          <div className="mt-3 pt-3 border-t border-border/30 grid grid-cols-3 gap-1 text-center text-xs">
            <div>
              <div className="font-mono font-bold text-emerald-400">{data.win_rate.toFixed(1)}%</div>
              <div className="text-muted-foreground">{t("win_rate_label")}</div>
            </div>
            <div className="text-muted-foreground flex items-center justify-center">×</div>
            <div>
              <div className="font-mono font-bold text-emerald-400">+${data.avg_win.toFixed(2)}</div>
              <div className="text-muted-foreground">{t("avg_rr")}</div>
            </div>
          </div>
          <div className="text-center text-xs text-muted-foreground my-1">−</div>
          <div className="grid grid-cols-3 gap-1 text-center text-xs">
            <div>
              <div className="font-mono font-bold text-red-400">{(100 - data.win_rate).toFixed(1)}%</div>
              <div className="text-muted-foreground">{t("win_rate_label")}</div>
            </div>
            <div className="text-muted-foreground flex items-center justify-center">×</div>
            <div>
              <div className="font-mono font-bold text-red-400">-${data.avg_loss.toFixed(2)}</div>
              <div className="text-muted-foreground">{t("avg_win_loss")}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t("total_trades"), value: String(data.total_trades), color: "" },
          { label: t("avg_rr"), value: `1:${data.avg_rr.toFixed(2)}`, color: data.avg_rr >= 1.5 ? "text-emerald-400" : data.avg_rr >= 1 ? "text-yellow-400" : "text-red-400" },
          { label: t("max_consec_wins"), value: t("streak", { n: data.max_consec_wins }), color: "text-emerald-400" },
          { label: t("max_consec_losses"), value: t("streak", { n: data.max_consec_losses }), color: "text-red-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border/50 bg-card p-3">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className={cn("text-xl font-bold font-mono", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Win/Loss bars */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">{t("win_rate_label")}</span>
                <span className="font-mono text-emerald-400">{data.win_rate.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-border/30 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${data.win_rate}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">{t("avg_win_loss")}</span>
                <span className="font-mono">
                  <span className="text-emerald-400">+${data.avg_win.toFixed(2)}</span>
                  <span className="text-muted-foreground"> / </span>
                  <span className="text-red-400">-${data.avg_loss.toFixed(2)}</span>
                </span>
              </div>
              <div className="flex gap-1 h-2">
                <div className="bg-emerald-500 rounded-l-full" style={{ width: `${data.avg_win / (data.avg_win + data.avg_loss) * 100}%` }} />
                <div className="bg-red-500 rounded-r-full flex-1" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({
  masterId, signals, aiSummary, aiLoading, onLoadAi,
}: {
  masterId: string;
  signals: Signal[];
  aiSummary: string | null;
  aiLoading: boolean;
  onLoadAi: () => void;
}) {
  const t = useTranslations("analytics_tabs");
  const [showSignals, setShowSignals] = useState(true);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              {t("ai_title")}
            </div>
            <button onClick={onLoadAi} className="text-xs text-primary hover:text-primary/80 transition-colors">
              {aiLoading ? t("ai_analyzing") : aiSummary ? t("ai_refresh") : t("ai_generate")}
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {aiLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />{t("ai_loading")}
            </div>
          )}
          {aiSummary && !aiLoading && (
            <p className="text-sm text-muted-foreground leading-relaxed">{aiSummary}</p>
          )}
          {!aiSummary && !aiLoading && (
            <p className="text-sm text-muted-foreground">
              {t("ai_hint")}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>{t("recent_signals")}</span>
            <button onClick={() => setShowSignals((v) => !v)} className="text-muted-foreground hover:text-foreground">
              {showSignals ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </CardTitle>
        </CardHeader>
        {showSignals ? (
          <CardContent className="p-0">
            {signals.length === 0
              ? <p className="text-sm text-muted-foreground p-4">{t("no_signals")}</p>
              : signals.slice(0, 10).map((s) => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0">
                    <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0",
                      s.direction === "BUY" ? "bg-emerald-500/10" : "bg-red-500/10"
                    )}>
                      {s.direction === "BUY"
                        ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                        : <TrendingDown className="h-3.5 w-3.5 text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{s.symbol}</span>
                        <Badge variant="secondary" className="text-[10px] px-1">{s.signal_type}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {s.direction} · {s.volume} lot{s.open_price ? ` @ ${s.open_price}` : ""}
                      </div>
                    </div>
                    {s.profit !== undefined && (
                      <span className={cn("text-sm font-mono shrink-0", s.profit >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {s.profit >= 0 ? "+" : ""}{s.profit.toFixed(2)}
                      </span>
                    )}
                  </div>
                ))
            }
          </CardContent>
        ) : (
          <CardContent className="pt-0">
            <button onClick={() => setShowSignals(true)} className="text-sm text-primary hover:text-primary/80 transition-colors">
              {t("view_signals", { n: signals.length })}
            </button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

// ── Main Analytics Tabs Component ─────────────────────────────────────────────

export function AnalyticsTabs({
  masterId,
  signals,
  aiSummary,
  aiLoading,
  onLoadAi,
}: {
  masterId: string;
  signals: Signal[];
  aiSummary: string | null;
  aiLoading: boolean;
  onLoadAi: () => void;
}) {
  const t = useTranslations("analytics_tabs");
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="w-full h-9 mb-4">
        <TabsTrigger value="overview" className="flex-1 text-xs">{t("tab_overview")}</TabsTrigger>
        <TabsTrigger value="backtest" className="flex-1 text-xs">{t("tab_backtest")}</TabsTrigger>
        <TabsTrigger value="sessions" className="flex-1 text-xs">{t("tab_sessions")}</TabsTrigger>
        <TabsTrigger value="attribution" className="flex-1 text-xs">{t("tab_attribution")}</TabsTrigger>
        <TabsTrigger value="edge" className="flex-1 text-xs">{t("tab_edge")}</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="mt-0">
        <OverviewTab masterId={masterId} signals={signals} aiSummary={aiSummary} aiLoading={aiLoading} onLoadAi={onLoadAi} />
      </TabsContent>
      <TabsContent value="backtest" className="mt-0">
        <BacktestTab masterId={masterId} />
      </TabsContent>
      <TabsContent value="sessions" className="mt-0">
        <SessionTab masterId={masterId} />
      </TabsContent>
      <TabsContent value="attribution" className="mt-0">
        <AttributionTab masterId={masterId} />
      </TabsContent>
      <TabsContent value="edge" className="mt-0">
        <EdgeTab masterId={masterId} />
      </TabsContent>
    </Tabs>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Loader2, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { api, type CopyTradeData } from "@/lib/api-client";

const STATUS_STYLE: Record<string, string> = {
  OPEN: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  CLOSED: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  FAILED: "text-red-400 bg-red-500/10 border-red-500/30",
};

function fmt(n: number | null, digits = 2) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function TradesPage() {
  const t = useTranslations("trades_page");
  const [trades, setTrades] = useState<CopyTradeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getToken = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const data = await api.copyTrades.list(token, { limit: 200 });
        setTrades(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load trades");
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken]);

  const closedTrades = trades.filter(t => t.status === "CLOSED" && t.profit != null);
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.profit ?? 0), 0);
  const winCount = closedTrades.filter(t => (t.profit ?? 0) > 0).length;
  const winRate = closedTrades.length > 0 ? (winCount / closedTrades.length) * 100 : 0;
  const openCount = trades.filter(t => t.status === "OPEN").length;

  return (
    <div className="px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> {t("loading")}
        </div>
      ) : error ? (
        <div className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-lg">{error}</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              {
                label: t("total_pnl"),
                value: `${totalPnl >= 0 ? "+" : ""}$${fmt(totalPnl)}`,
                color: totalPnl >= 0 ? "text-emerald-400" : "text-red-400",
                icon: totalPnl >= 0 ? TrendingUp : TrendingDown,
              },
              {
                label: t("closed_trades"),
                value: String(closedTrades.length),
                color: "text-foreground",
                icon: Activity,
              },
              {
                label: t("win_rate"),
                value: closedTrades.length > 0 ? `${winRate.toFixed(1)}%` : "—",
                color: winRate >= 50 ? "text-emerald-400" : "text-amber-400",
                icon: TrendingUp,
              },
              {
                label: t("open_trades"),
                value: String(openCount),
                color: openCount > 0 ? "text-blue-400" : "text-muted-foreground",
                icon: Activity,
              },
            ].map(({ label, value, color, icon: Icon }) => (
              <Card key={label} className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={cn("h-4 w-4", color)} />
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                  <div className={cn("text-xl font-bold tabular-nums", color)}>{value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {trades.length === 0 ? (
            <Card className="border-border/60">
              <CardContent className="py-16 text-center text-muted-foreground text-sm">
                {t("empty")}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/60">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-xs text-muted-foreground">
                      <th className="text-left px-4 py-3 font-medium">{t("col_date")}</th>
                      <th className="text-left px-4 py-3 font-medium">{t("col_master")}</th>
                      <th className="text-left px-4 py-3 font-medium">{t("col_symbol")}</th>
                      <th className="text-left px-4 py-3 font-medium">{t("col_side")}</th>
                      <th className="text-right px-4 py-3 font-medium">{t("col_lots")}</th>
                      <th className="text-right px-4 py-3 font-medium">{t("col_open")}</th>
                      <th className="text-right px-4 py-3 font-medium">{t("col_close")}</th>
                      <th className="text-right px-4 py-3 font-medium">{t("col_pnl")}</th>
                      <th className="text-center px-4 py-3 font-medium">{t("col_status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((row) => {
                      const pnl = row.profit ?? null;
                      const pnlColor = pnl == null ? "" : pnl >= 0 ? "text-emerald-400" : "text-red-400";
                      return (
                        <tr key={row.id} className="border-b border-border/30 hover:bg-accent/20 transition-colors">
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {fmtDate(row.opened_at)}
                          </td>
                          <td className="px-4 py-3 font-medium truncate max-w-[120px]">
                            {row.master_name ?? "—"}
                          </td>
                          <td className="px-4 py-3 font-mono font-medium">{row.symbol}</td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "text-xs font-semibold px-2 py-0.5 rounded",
                              row.direction === "BUY"
                                ? "text-emerald-400 bg-emerald-500/10"
                                : "text-red-400 bg-red-500/10"
                            )}>
                              {row.direction}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">{fmt(row.volume, 2)}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{fmt(row.open_price, 5)}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                            {row.status === "OPEN" ? <span className="text-blue-400 text-xs">{t("trade_open")}</span> : fmt(row.close_price, 5)}
                          </td>
                          <td className={cn("px-4 py-3 text-right tabular-nums font-medium", pnlColor)}>
                            {pnl == null ? "—" : `${pnl >= 0 ? "+" : ""}$${fmt(pnl)}`}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full border font-semibold",
                              STATUS_STYLE[row.status] ?? "text-muted-foreground border-border"
                            )}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Activity, ArrowUpRight } from "lucide-react";
import { api } from "@/lib/api";

const SYMBOLS = [
  { s: "EURUSD", label: "EUR/USD" },
  { s: "GBPUSD", label: "GBP/USD" },
  { s: "XAUUSD", label: "Gold" },
  { s: "BTCUSD", label: "BTC/USD" },
  { s: "USDJPY", label: "USD/JPY" },
];

export function MarketOverview() {
  const t = useTranslations("dashboard");
  const { data, isLoading } = useQuery({
    queryKey: ["market-overview"],
    queryFn: async () =>
      Promise.all(
        SYMBOLS.map(async ({ s, label }) => {
          try {
            const q = await api.market.quote(s);
            const chg = q.pc ? ((q.c - q.pc) / q.pc) * 100 : 0;
            return { s, label, price: q.c, chg };
          } catch {
            return { s, label, price: null as number | null, chg: 0 };
          }
        }),
      ),
    refetchInterval: 30_000,
  });

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <Activity className="h-4 w-4 text-primary" /> {t("market_overview")}
        </h2>
        <Link href="/terminal" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          {t("open_terminal")} <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="space-y-0.5">
        {(data ?? SYMBOLS.map((x) => ({ ...x, price: null as number | null, chg: 0 }))).map((row) => (
          <Link
            key={row.s}
            href={`/terminal`}
            className="flex items-center justify-between rounded-md px-2 py-2 transition hover:bg-accent/30"
          >
            <span className="text-sm text-muted-foreground">{row.label}</span>
            <span className="flex items-center gap-3">
              <span className="font-mono text-sm font-medium">
                {row.price == null ? (isLoading ? "…" : "—") : row.price.toLocaleString(undefined, { maximumFractionDigits: row.price < 10 ? 4 : 2 })}
              </span>
              <span className={`w-16 text-right font-mono text-xs ${row.chg >= 0 ? "text-up" : "text-down"}`}>
                {row.chg >= 0 ? "+" : ""}{row.chg.toFixed(2)}%
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Sparkles, TrendingUp, TrendingDown, Minus, ArrowUpRight, Loader2 } from "lucide-react";
import { useAnalyses } from "@/lib/queries";

function Verdict({ d }: { d: string | null }) {
  const v = (d ?? "").toUpperCase();
  const buy = /BUY|OVERWEIGHT|ACCUMULATE|LONG/.test(v);
  const sell = /SELL|UNDERWEIGHT|REDUCE|SHORT/.test(v);
  const cls = buy ? "text-up border-up/30 bg-up/10" : sell ? "text-down border-down/30 bg-down/10" : "text-amber-400 border-amber-500/30 bg-amber-500/10";
  const Icon = buy ? TrendingUp : sell ? TrendingDown : Minus;
  return <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${cls}`}><Icon className="h-3 w-3" />{v || "—"}</span>;
}

export function RecentAnalyses() {
  const t = useTranslations("analyst");
  const { data, isLoading } = useAnalyses(6);
  const items = data ?? [];

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> {t("recent_title")}
        </h2>
        <Link href="/dashboard/analyst" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          {t("open_full")} <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <Link href="/dashboard/analyst" className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 py-10 text-center transition hover:border-primary/40 hover:bg-primary/5">
          <Sparkles className="h-7 w-7 text-primary/40" />
          <span className="text-sm font-medium">{t("empty_cta_title")}</span>
          <span className="text-xs text-muted-foreground">{t("empty_cta_desc")}</span>
        </Link>
      ) : (
        <div className="space-y-1.5">
          {items.map((a) => (
            <Link
              key={a.id}
              href={`/dashboard/analyst?symbol=${a.symbol}`}
              className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2 transition hover:border-border hover:bg-accent/30"
            >
              <span className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold">{a.symbol}</span>
                <span className="text-xs text-muted-foreground">{a.trade_date}</span>
              </span>
              {a.status === "DONE" ? <Verdict d={a.decision} />
                : a.status === "FAILED" ? <span className="text-xs text-down">{t("failed")}</span>
                : <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />{a.status}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

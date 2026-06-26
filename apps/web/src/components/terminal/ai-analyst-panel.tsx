"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Sparkles, Loader2, TrendingUp, TrendingDown, Minus, X, ArrowUpRight, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Analysis {
  id: string; symbol: string; status: string; decision: string | null;
  reports: Record<string, string>; error: string | null;
}

const REPORTS = [
  { key: "final_decision", label: "Final Decision" },
  { key: "market", label: "Market / Technical" },
  { key: "news", label: "News" },
  { key: "fundamentals", label: "Fundamentals" },
  { key: "research_debate", label: "Bull vs Bear" },
  { key: "risk_debate", label: "Risk Team" },
];

/** Asset class guess from a terminal symbol (EURUSD→forex, BTCUSD→crypto, else stock). */
function guessAsset(sym: string): string {
  const s = sym.toUpperCase();
  if (/^(BTC|ETH|XRP|SOL|DOGE|ADA|BNB|LTC)/.test(s) || s.endsWith("USDT")) return "crypto";
  if (/^[A-Z]{6}$/.test(s)) return "forex";
  return "stock";
}

function Badge({ d }: { d: string | null }) {
  const v = (d ?? "").toUpperCase();
  const buy = v.includes("BUY") || v.includes("OVERWEIGHT");
  const sell = v.includes("SELL") || v.includes("UNDERWEIGHT");
  const cls = buy ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
    : sell ? "text-red-400 bg-red-500/10 border-red-500/30"
    : "text-amber-400 bg-amber-500/10 border-amber-500/30";
  const Icon = buy ? TrendingUp : sell ? TrendingDown : Minus;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${cls}`}>
      <Icon className="h-3 w-3" />{v || "—"}
    </span>
  );
}

export function AiAnalystPanel({ open, onClose, symbol }: { open: boolean; onClose: () => void; symbol: string }) {
  const t = useTranslations("analyst");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [openReport, setOpenReport] = useState<string | null>("final_decision");
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const run = useCallback(async () => {
    const { data: { session } } = await createClient().auth.getSession();
    if (!session?.access_token) { setAuthed(false); return; }
    setAuthed(true);
    setSubmitting(true);
    setAnalysis(null);
    try {
      const res = await fetch(`${API}/api/v1/agents/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ symbol, asset_type: guessAsset(symbol), depth: "fast" }),
      });
      if (!res.ok) { setSubmitting(false); return; }
      const row: Analysis = await res.json();
      setAnalysis(row);
      if (poll.current) clearInterval(poll.current);
      poll.current = setInterval(async () => {
        const r = await fetch(`${API}/api/v1/agents/analyses/${row.id}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (!r.ok) return;
        const a: Analysis = await r.json();
        setAnalysis(a);
        if (a.status === "DONE" || a.status === "FAILED") { if (poll.current) clearInterval(poll.current); }
      }, 5000);
    } finally {
      setSubmitting(false);
    }
  }, [symbol]);

  if (!open) return null;
  const running = analysis && (analysis.status === "PENDING" || analysis.status === "RUNNING");

  return (
    <div className="fixed right-0 top-16 bottom-0 z-40 w-full max-w-md border-l border-border bg-card/95 backdrop-blur shadow-2xl flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> {t("title")}
          <span className="font-mono text-sm text-muted-foreground">· {symbol}</span>
        </div>
        <button onClick={onClose} className="rounded-md p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <button
          onClick={run}
          disabled={submitting || !!running}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {submitting || running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {running ? t("agents_working") : `${t("analyze")} ${symbol}`}
        </button>

        {authed === false && (
          <Link href="/auth/login" className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm">
            <LogIn className="h-4 w-4" /> {t("signin_to_use")}
          </Link>
        )}

        <p className="text-center text-xs text-muted-foreground">{t("fast_note")}</p>

        {analysis?.status === "DONE" && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("decision")}</span>
              <Badge d={analysis.decision} />
            </div>
            {REPORTS.filter(r => analysis.reports?.[r.key]).map(({ key, label }) => (
              <div key={key} className="rounded-md border border-border/60">
                <button onClick={() => setOpenReport(openReport === key ? null : key)}
                  className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium hover:bg-accent/40">
                  {label}<span className="text-muted-foreground">{openReport === key ? "−" : "+"}</span>
                </button>
                {openReport === key && (
                  <div className="px-3 pb-3 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                    {analysis.reports[key]}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {analysis?.status === "FAILED" && (
          <p className="text-xs text-red-400">{t("failed")}</p>
        )}
      </div>

      <div className="border-t border-border px-4 py-2.5">
        <Link href={`/dashboard/analyst?symbol=${symbol}`} className="flex items-center justify-center gap-1.5 text-xs text-primary hover:underline">
          {t("open_full")} <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

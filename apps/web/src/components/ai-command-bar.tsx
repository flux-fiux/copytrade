"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { Sparkles, Loader2, TrendingUp, TrendingDown, Minus, X, ArrowUp, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { api, type AgentAnalysis } from "@/lib/api";

function guessAsset(sym: string): string {
  const s = sym.toUpperCase();
  if (/^(BTC|ETH|XRP|SOL|DOGE|ADA|BNB|LTC)/.test(s) || s.endsWith("USDT")) return "crypto";
  if (/^[A-Z]{6}$/.test(s)) return "forex";
  return "stock";
}

function Verdict({ d }: { d: string | null }) {
  const v = (d ?? "").toUpperCase();
  const buy = /BUY|OVERWEIGHT|ACCUMULATE|LONG/.test(v);
  const sell = /SELL|UNDERWEIGHT|REDUCE|SHORT/.test(v);
  const cls = buy ? "text-up border-up/30 bg-up/10" : sell ? "text-down border-down/30 bg-down/10" : "text-amber-400 border-amber-500/30 bg-amber-500/10";
  const Icon = buy ? TrendingUp : sell ? TrendingDown : Minus;
  return <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${cls}`}><Icon className="h-3 w-3" />{v || "—"}</span>;
}

export function AiCommandBar() {
  const t = useTranslations("analyst");
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [analysis, setAnalysis] = useState<AgentAnalysis | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ⌘K / ⌘J focuses the bar from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "j")) {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); if (poll.current) clearInterval(poll.current); };
  }, []);

  const run = useCallback(async () => {
    const symbol = value.trim().toUpperCase().split(/\s+/)[0];
    if (!symbol) return;
    const { data: { session } } = await createClient().auth.getSession();
    if (!session?.access_token) { setAuthed(false); setOpen(true); return; }
    setAuthed(true);
    setSubmitting(true);
    setOpen(true);
    setAnalysis(null);
    try {
      const row = await api.agents.analyze({ symbol, asset_type: guessAsset(symbol), depth: "fast" });
      setAnalysis(row);
      if (poll.current) clearInterval(poll.current);
      poll.current = setInterval(async () => {
        try {
          const a = await api.agents.get(row.id);
          setAnalysis(a);
          if (a.status === "DONE" || a.status === "FAILED") { if (poll.current) clearInterval(poll.current); }
        } catch { /* keep polling */ }
      }, 5000);
    } catch {
      setAnalysis({ id: "", symbol, asset_type: "", trade_date: "", status: "FAILED", decision: null, reports: {}, error: "failed", created_at: null, completed_at: null });
    } finally {
      setSubmitting(false);
    }
  }, [value]);

  // Hidden on auth pages.
  if (pathname?.startsWith("/auth")) return null;
  const running = analysis && (analysis.status === "PENDING" || analysis.status === "RUNNING");

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 hidden justify-center px-4 md:flex">
      <div className="pointer-events-auto w-full max-w-2xl">
        <AnimatePresence>
          {open && (authed === false || analysis) && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="mb-2 max-h-[60vh] overflow-y-auto rounded-2xl border border-border/70 bg-card/95 p-4 shadow-2xl backdrop-blur"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" /> {t("title")}
                  {analysis && <span className="font-mono text-muted-foreground">· {analysis.symbol}</span>}
                </span>
                <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
              </div>

              {authed === false && (
                <Link href="/auth/login" className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm">
                  <LogIn className="h-4 w-4" /> {t("signin_to_use")}
                </Link>
              )}

              {running && (
                <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" /> {t("agents_working")}
                </div>
              )}

              {analysis?.status === "DONE" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t("decision")}</span>
                    <Verdict d={analysis.decision} />
                  </div>
                  {(analysis.reports?.final_decision || analysis.reports?.trader_plan) && (
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                      {(analysis.reports.final_decision || analysis.reports.trader_plan).slice(0, 600)}…
                    </p>
                  )}
                  <Link href={`/dashboard/analyst?symbol=${analysis.symbol}`} className="inline-block text-xs text-primary hover:underline">
                    {t("open_full")} →
                  </Link>
                </div>
              )}

              {analysis?.status === "FAILED" && <p className="py-3 text-xs text-down">{t("failed")}</p>}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-card/90 px-4 py-2.5 shadow-xl shadow-primary/10 backdrop-blur ring-1 ring-primary/10 focus-within:border-primary/60 focus-within:ring-primary/30">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => { if (e.key === "Enter") run(); }}
            placeholder={t("command_placeholder")}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">⌘K</kbd>
          <button
            onClick={run}
            disabled={submitting || !!running || !value.trim()}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
          >
            {submitting || running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

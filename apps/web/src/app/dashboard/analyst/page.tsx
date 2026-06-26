"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Analysis {
  id: string;
  symbol: string;
  asset_type: string;
  trade_date: string;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED";
  decision: string | null;
  reports: Record<string, string>;
  error: string | null;
  created_at: string | null;
}

const REPORT_ORDER: { key: string; label: string }[] = [
  { key: "market", label: "Market / Technical" },
  { key: "sentiment", label: "Social Sentiment" },
  { key: "news", label: "News" },
  { key: "fundamentals", label: "Fundamentals" },
  { key: "research_debate", label: "Bull vs Bear Debate" },
  { key: "research_plan", label: "Research Plan" },
  { key: "trader_plan", label: "Trader Plan" },
  { key: "risk_debate", label: "Risk Team Debate" },
  { key: "final_decision", label: "Final Decision" },
];

async function token(): Promise<string | null> {
  const { data: { session } } = await createClient().auth.getSession();
  return session?.access_token ?? null;
}

function DecisionBadge({ d }: { d: string | null }) {
  const v = (d ?? "").toUpperCase();
  const map: Record<string, { cls: string; icon: React.ReactNode }> = {
    BUY: { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", icon: <TrendingUp className="h-4 w-4" /> },
    SELL: { cls: "text-red-400 bg-red-500/10 border-red-500/30", icon: <TrendingDown className="h-4 w-4" /> },
    HOLD: { cls: "text-amber-400 bg-amber-500/10 border-amber-500/30", icon: <Minus className="h-4 w-4" /> },
  };
  const s = map[v] ?? { cls: "text-muted-foreground bg-muted/30 border-border", icon: null };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-semibold ${s.cls}`}>
      {s.icon}{v || "—"}
    </span>
  );
}

export default function AnalystPage() {
  const t = useTranslations("analyst");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const [symbol, setSymbol] = useState("");
  const [assetType, setAssetType] = useState("stock");
  const [depth, setDepth] = useState("full");
  const [current, setCurrent] = useState<Analysis | null>(null);
  const [history, setHistory] = useState<Analysis[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState<string | null>("final_decision");
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  // Deep-link support: /dashboard/analyst?symbol=AAPL (e.g. from the terminal).
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("symbol");
    if (s) setSymbol(s.toUpperCase());
  }, []);

  const loadHistory = useCallback(async () => {
    const tk = await token(); if (!tk) return;
    const res = await fetch(`${API}/api/v1/agents/analyses?limit=15`, { headers: { Authorization: `Bearer ${tk}` } });
    if (res.ok) setHistory(await res.json());
  }, []);

  useEffect(() => {
    (async () => {
      const tk = await token(); if (!tk) { setAvailable(false); setReason("not signed in"); return; }
      const res = await fetch(`${API}/api/v1/agents/status`, { headers: { Authorization: `Bearer ${tk}` } });
      if (res.ok) { const d = await res.json(); setAvailable(d.available); setReason(d.reason || ""); }
      else setAvailable(false);
      loadHistory();
    })();
    return () => { if (poll.current) clearInterval(poll.current); };
  }, [loadHistory]);

  const pollOne = useCallback((id: string) => {
    if (poll.current) clearInterval(poll.current);
    poll.current = setInterval(async () => {
      const tk = await token(); if (!tk) return;
      const res = await fetch(`${API}/api/v1/agents/analyses/${id}`, { headers: { Authorization: `Bearer ${tk}` } });
      if (!res.ok) return;
      const a: Analysis = await res.json();
      setCurrent(a);
      if (a.status === "DONE" || a.status === "FAILED") {
        if (poll.current) clearInterval(poll.current);
        loadHistory();
      }
    }, 5000);
  }, [loadHistory]);

  const analyze = async () => {
    const sym = symbol.trim().toUpperCase();
    if (!sym) return;
    setSubmitting(true);
    try {
      const tk = await token(); if (!tk) return;
      const res = await fetch(`${API}/api/v1/agents/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ symbol: sym, asset_type: assetType, depth }),
      });
      if (res.status === 429) { alert(t("rate_limited")); return; }
      if (res.status === 503) { const e = await res.json(); alert(e.detail); return; }
      if (!res.ok) { alert(t("failed")); return; }
      const a: Analysis = await res.json();
      setCurrent(a);
      pollOne(a.id);
    } finally {
      setSubmitting(false);
    }
  };

  const running = current && (current.status === "PENDING" || current.status === "RUNNING");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" /> {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {available === false && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
          <div>
            <p className="font-medium text-amber-300">{t("unavailable_title")}</p>
            <p className="text-muted-foreground mt-0.5">{t("unavailable_desc")} {reason && <code className="text-xs">({reason})</code>}</p>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && analyze()}
            placeholder={t("symbol_placeholder")}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm uppercase"
          />
          <select
            value={assetType}
            onChange={(e) => setAssetType(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="stock">{t("stock")}</option>
            <option value="crypto">{t("crypto")}</option>
            <option value="forex">{t("forex")}</option>
          </select>
          <select
            value={depth}
            onChange={(e) => setDepth(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            title={t("depth_hint")}
          >
            <option value="fast">{t("depth_fast")}</option>
            <option value="balanced">{t("depth_balanced")}</option>
            <option value="full">{t("depth_deep")}</option>
          </select>
          <button
            onClick={analyze}
            disabled={submitting || !!running || available === false || !symbol.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {submitting || running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {t("analyze")}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </div>

      {/* Current run */}
      {current && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg">{current.symbol}</span>
              <span className="text-xs text-muted-foreground">{current.asset_type} · {current.trade_date}</span>
            </div>
            {current.status === "DONE" ? <DecisionBadge d={current.decision} />
              : current.status === "FAILED" ? <span className="text-sm text-red-400">{t("failed")}</span>
              : <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t("agents_working")}</span>}
          </div>

          {current.status === "FAILED" && current.error && (
            <pre className="text-xs text-red-400/80 whitespace-pre-wrap bg-red-500/5 rounded p-2">{current.error}</pre>
          )}

          {current.status === "DONE" && (
            <div className="space-y-2">
              {REPORT_ORDER.filter(r => current.reports?.[r.key]).map(({ key, label }) => (
                <div key={key} className="rounded-md border border-border/60">
                  <button onClick={() => setOpen(open === key ? null : key)}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-accent/40">
                    {label}
                    <ChevronDown className={`h-4 w-4 transition-transform ${open === key ? "rotate-180" : ""}`} />
                  </button>
                  {open === key && (
                    <div className="px-3 pb-3 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {current.reports[key]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">{t("history")}</h2>
          <div className="space-y-1">
            {history.map((a) => (
              <button key={a.id} onClick={() => { setCurrent(a); if (a.status !== "DONE" && a.status !== "FAILED") pollOne(a.id); }}
                className="flex w-full items-center justify-between rounded-md border border-border/50 px-3 py-2 text-sm hover:bg-accent/40">
                <span className="flex items-center gap-2">
                  <span className="font-medium">{a.symbol}</span>
                  <span className="text-xs text-muted-foreground">{a.trade_date}</span>
                </span>
                {a.status === "DONE" ? <DecisionBadge d={a.decision} />
                  : <span className="text-xs text-muted-foreground">{a.status}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

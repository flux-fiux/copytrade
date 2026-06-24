"use client";

import { useState } from "react";
import { Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Props {
  masterId: string;
  lang?: string;
}

export function AiSummary({ masterId, lang = "en" }: Props) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    if (summary) { setExpanded(e => !e); return; }
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/leaderboard/${masterId}/ai-summary?lang=${lang}`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSummary(data.summary);
      setExpanded(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">AI Strategy Analysis</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            DeepSeek
          </span>
        </div>
        {summary && (
          <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </div>

      {!summary && !loading && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-xs text-muted-foreground">
            Get an AI-powered analysis of this trader&apos;s style, risk management, and suitability for your account.
          </p>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <Sparkles className="h-3.5 w-3.5 mr-2" />
            Analyze with AI
          </Button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyzing trading patterns…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">Analysis unavailable. </p>
          <button onClick={load} className="text-xs text-primary hover:underline">Retry</button>
        </div>
      )}

      {summary && expanded && (
        <p className={cn("text-sm text-muted-foreground leading-relaxed", "animate-in fade-in duration-300")}>
          {summary}
        </p>
      )}
    </div>
  );
}

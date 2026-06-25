"use client";

import { useEffect, useState, useCallback } from "react";
import { TrendingUp, TrendingDown, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useSocket } from "@/hooks/useSocket";
import { incrementNotif } from "@/store/notifications";

interface Signal {
  id: string;
  master_id: string;
  master_username?: string;
  symbol: string;
  direction: "BUY" | "SELL";
  signal_type: "OPEN" | "CLOSE" | "MODIFY";
  volume: number;
  profit?: number;
  opened_at: string;
}

export function TerminalSignalFeed() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [masterIds, setMasterIds] = useState<string[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      try {
        const res = await fetch(`${apiUrl}/api/v1/subscriptions/my`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const subs = await res.json();
          if (Array.isArray(subs)) setMasterIds(subs.map((s: { master_id: string }) => s.master_id));
        }
      } catch {
        // silent
      }
    })();
  }, []);

  const handleSignal = useCallback((data: Record<string, unknown>) => {
    const signal = data as unknown as Signal;
    if (!signal.id) return;
    setSignals(prev => [signal, ...prev.filter(s => s.id !== signal.id)].slice(0, 30));
    setNewIds(prev => new Set(prev).add(signal.id));
    incrementNotif();
    setTimeout(() => setNewIds(prev => { const s = new Set(prev); s.delete(signal.id); return s; }), 3000);
  }, []);

  useSocket({ masterIds, onSignal: handleSignal });

  if (signals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground px-4">
        <Radio className="h-6 w-6 mb-2 opacity-30" />
        <p className="text-xs">
          {masterIds.length > 0
            ? "Waiting for signals from your Masters…"
            : "Subscribe to a Master to see live signals here."}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/40">
      {signals.map(signal => {
        const pnl = signal.profit ?? 0;
        const isNew = newIds.has(signal.id);
        const isOpen = signal.signal_type === "OPEN";
        return (
          <div
            key={signal.id}
            className={cn(
              "flex items-center gap-2 px-3 py-2.5 transition-colors duration-500",
              isNew && "bg-primary/5 animate-in fade-in slide-in-from-top-1 duration-200"
            )}
          >
            {signal.direction === "BUY"
              ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              : <TrendingDown className="h-3.5 w-3.5 text-red-400 shrink-0" />
            }
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-semibold">{signal.symbol}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[9px] px-1 py-0 h-3.5",
                    signal.direction === "BUY" ? "text-emerald-400 border-emerald-500/30" : "text-red-400 border-red-500/30"
                  )}
                >
                  {signal.direction}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn("text-[9px] px-1 py-0 h-3.5", isOpen ? "text-blue-400 border-blue-500/30" : "text-muted-foreground")}
                >
                  {isOpen ? "OPEN" : "CLOSE"}
                </Badge>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {signal.master_username ?? "Master"} · {signal.volume}L
              </div>
            </div>
            {pnl !== 0 && (
              <div className={cn("text-xs font-bold shrink-0", pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

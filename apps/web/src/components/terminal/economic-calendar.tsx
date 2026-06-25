"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface CalendarEvent {
  country: string;
  event: string;
  impact: "high" | "medium" | "low";
  estimate?: string | null;
  actual?: string | null;
  previous?: string | null;
  time: string;
}

const FLAG: Record<string, string> = {
  US: "🇺🇸", EU: "🇪🇺", UK: "🇬🇧", JP: "🇯🇵", CA: "🇨🇦", AU: "🇦🇺",
  NZ: "🇳🇿", CH: "🇨🇭", DE: "🇩🇪", CN: "🇨🇳",
};

const IMPACT_COLOR: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500/60",
};

function formatTime(isoStr: string) {
  try {
    return new Date(isoStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return isoStr; }
}

function formatDate(isoStr: string) {
  try {
    return new Date(isoStr).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  } catch { return isoStr.slice(0, 10); }
}

export function EconomicCalendar() {
  const t = useTranslations("terminal");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/api/v1/market/calendar`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setEvents(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(err => { if (err.name !== "AbortError") setLoading(false); });
    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="p-4 text-center">
        <p className="text-xs text-muted-foreground">{t("cal_empty")}</p>
      </div>
    );
  }

  // Group by date
  const groups = events.reduce<Record<string, CalendarEvent[]>>((acc, e) => {
    const day = e.time.slice(0, 10);
    if (!acc[day]) acc[day] = [];
    acc[day].push(e);
    return acc;
  }, {});

  return (
    <div className="divide-y divide-border/50">
      {Object.entries(groups).map(([date, dayEvents]) => (
        <div key={date}>
          <div className="px-3 py-1.5 bg-muted/30 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            {formatDate(date)}
          </div>
          {dayEvents.map((ev, i) => (
            <div key={i} className="px-3 py-2 hover:bg-muted/20 transition-colors">
              <div className="flex items-start gap-2">
                <span className={cn("mt-1 h-1.5 w-1.5 rounded-full shrink-0", IMPACT_COLOR[ev.impact] ?? "bg-gray-500")} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs">{FLAG[ev.country] ?? ev.country}</span>
                    <span className="text-xs font-medium truncate">{ev.event}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{formatTime(ev.time)}</span>
                    {ev.actual != null && (
                      <span className={cn("font-mono", ev.actual > (ev.estimate ?? "") ? "text-green-400" : "text-red-400")}>
                        A: {ev.actual}
                      </span>
                    )}
                    {ev.estimate && <span className="font-mono">E: {ev.estimate}</span>}
                    {ev.previous && <span className="font-mono">P: {ev.previous}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

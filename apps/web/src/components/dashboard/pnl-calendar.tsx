"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface DayData {
  date: string;
  profit: number;
  trades: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function PnlCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DayData | null>(null);

  const fetchData = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setData([]); return; }
      const res = await fetch(
        `${API_BASE}/api/v1/analytics/copy-trades/calendar?year=${y}&month=${m}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (res.ok) setData(await res.json());
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(year, month); }, [year, month, fetchData]);

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); };

  const dataMap = Object.fromEntries(data.map((d) => [d.date, d]));
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const totalProfit = data.reduce((s, d) => s + d.profit, 0);
  const winDays = data.filter((d) => d.profit > 0).length;
  const tradeDays = data.filter((d) => d.trades > 0).length;

  const cells: (DayData | null | "empty")[] = [
    ...Array(firstDay).fill("empty"),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
      return dataMap[dateStr] ?? { date: dateStr, profit: 0, trades: 0 };
    }),
  ];

  const maxAbs = Math.max(...data.map((d) => Math.abs(d.profit)), 1);

  function cellColor(profit: number, trades: number): string {
    if (trades === 0) return "bg-zinc-900 text-zinc-700";
    const intensity = Math.min(Math.abs(profit) / maxAbs, 1);
    if (profit > 0) {
      if (intensity > 0.6) return "bg-emerald-500/70 text-white";
      if (intensity > 0.3) return "bg-emerald-500/40 text-emerald-300";
      return "bg-emerald-500/20 text-emerald-400";
    }
    if (intensity > 0.6) return "bg-red-500/70 text-white";
    if (intensity > 0.3) return "bg-red-500/40 text-red-300";
    return "bg-red-500/20 text-red-400";
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="p-1 rounded hover:bg-muted/50 text-muted-foreground">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="font-semibold text-sm flex-1 text-center">
          {MONTHS[month - 1]} {year}
        </span>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-muted/50 text-muted-foreground">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Total P&L", value: `${totalProfit >= 0 ? "+" : ""}$${totalProfit.toFixed(2)}`, color: totalProfit >= 0 ? "text-emerald-400" : "text-red-400" },
          { label: "Win Days", value: `${winDays}/${tradeDays}`, color: "text-zinc-300" },
          { label: "Win Rate", value: tradeDays > 0 ? `${Math.round(winDays / tradeDays * 100)}%` : "—", color: "text-zinc-300" },
        ].map((stat) => (
          <div key={stat.label} className="bg-muted/30 rounded-lg p-2 text-center">
            <div className={cn("text-sm font-bold font-mono", stat.color)}>{loading ? "…" : stat.value}</div>
            <div className="text-[10px] text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div>
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-[10px] text-zinc-600 py-1">{d}</div>
          ))}
        </div>
        {loading ? (
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-10 bg-zinc-800/40 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, i) => {
              if (cell === "empty") return <div key={`e${i}`} />;
              const dayNum = i - firstDay + 1;
              const day = cell as DayData;
              return (
                <button
                  key={day.date}
                  onClick={() => setSelected(selected?.date === day.date ? null : day)}
                  className={cn(
                    "h-10 rounded flex flex-col items-center justify-center transition-all text-[10px]",
                    cellColor(day.profit, day.trades),
                    selected?.date === day.date && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                    day.trades === 0 && "cursor-default"
                  )}
                >
                  <span className="font-medium leading-none">{dayNum}</span>
                  {day.trades > 0 && (
                    <span className="font-mono leading-tight text-[8px] opacity-90">
                      {day.profit >= 0 ? "+" : ""}{day.profit.toFixed(0)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Day detail */}
      {selected && selected.trades > 0 && (
        <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-1">
          <div className="font-medium text-zinc-300">{selected.date}</div>
          <div className="flex justify-between text-xs">
            <span className="text-zinc-500">Trades</span>
            <span>{selected.trades}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-zinc-500">P&amp;L</span>
            <span className={selected.profit >= 0 ? "text-emerald-400" : "text-red-400"}>
              {selected.profit >= 0 ? "+" : ""}${selected.profit.toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

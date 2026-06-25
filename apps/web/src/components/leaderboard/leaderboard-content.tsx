"use client";

import { useState, useEffect, useCallback } from "react";
import { LeaderboardTable } from "./leaderboard-table";
import type { LeaderboardEntry } from "@/lib/api-client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const PERIODS = ["1M", "3M", "6M", "1Y", "ALL"] as const;
type Period = typeof PERIODS[number];

export function LeaderboardContent({ initial }: { initial: LeaderboardEntry[] | null }) {
  const [period, setPeriod] = useState<Period>("1M");
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(initial);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(initial?.length ?? 0);
  const [page, setPage] = useState(1);

  const fetchPage = useCallback(async (p: Period, pg: number) => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/leaderboard/?period=${p}&page=${pg}&per_page=20`
      );
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
        setTotal(data.total ?? data.entries.length);
      }
    } catch { /* keep existing data */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (period !== "1M" || page !== 1) fetchPage(period, page);
  }, [period, page, fetchPage]);

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    setPage(1);
  };

  return (
    <>
      {/* Period tabs */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                period === p
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {total > 0 ? `${total} providers` : ""}
        </span>
      </div>

      <div className="mt-4">
        <LeaderboardTable apiEntries={entries} loading={loading} />
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            disabled={page === 1 || loading}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 rounded-md border border-border text-xs disabled:opacity-40 hover:bg-muted/50"
          >
            Prev
          </button>
          <span className="px-3 py-1.5 text-xs text-muted-foreground">
            Page {page} / {Math.ceil(total / 20)}
          </span>
          <button
            disabled={page >= Math.ceil(total / 20) || loading}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 rounded-md border border-border text-xs disabled:opacity-40 hover:bg-muted/50"
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}

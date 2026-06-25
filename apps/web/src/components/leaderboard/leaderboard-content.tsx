"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { LeaderboardTable } from "./leaderboard-table";
import type { LeaderboardEntry } from "@/lib/api-client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const PERIODS = ["1M", "3M", "6M", "1Y", "ALL"] as const;
type Period = typeof PERIODS[number];

const SORT_VALUES = ["return", "sharpe", "drawdown", "winrate", "followers", "days"] as const;

const GRADES = ["A+", "A", "B+", "B", "C"] as const;
const MIN_DAYS = [
  { label: "Any",      value: 0 },
  { label: "30d+",     value: 30 },
  { label: "90d+",     value: 90 },
  { label: "180d+",    value: 180 },
  { label: "1yr+",     value: 365 },
];

export function LeaderboardContent({ initial }: { initial: LeaderboardEntry[] | null }) {
  const t = useTranslations("leaderboard");

  const SORT_OPTIONS: { value: string; label: string }[] = [
    { value: "return",    label: t("col_return") },
    { value: "sharpe",   label: t("col_sharpe") },
    { value: "drawdown", label: t("col_drawdown") },
    { value: "winrate",  label: t("win_rate_label") },
    { value: "followers",label: t("col_followers") },
    { value: "days",     label: t("track_record") },
  ];

  const PERIOD_LABELS: Record<Period, string> = {
    "1M": t("period_1M"),
    "3M": t("period_3M"),
    "6M": t("period_6M"),
    "1Y": t("period_1Y"),
    "ALL": t("period_ALL"),
  };

  const [period, setPeriod] = useState<Period>("1M");
  const [sortBy, setSortBy] = useState("return");
  const [grade, setGrade] = useState<string | null>(null);
  const [minDays, setMinDays] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(initial);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(initial?.length ?? 0);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPage = useCallback(async (
    p: Period, pg: number, sort: string, gr: string | null, days: number, q: string
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        period: p, page: String(pg), per_page: "20", sort_by: sort,
        min_days: String(days),
      });
      if (gr) params.set("grade", gr);
      if (q) params.set("search", q);
      const res = await fetch(`${API_BASE}/api/v1/leaderboard/?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
        setTotal(data.total ?? data.entries.length);
      }
    } catch { /* keep existing data */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (period !== "1M" || page !== 1 || sortBy !== "return" || grade || minDays || search) {
      fetchPage(period, page, sortBy, grade, minDays, search);
    }
  }, [period, page, sortBy, grade, minDays, search, fetchPage]);

  const resetToPage1 = () => setPage(1);

  const handleSearch = (val: string) => {
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(val);
      resetToPage1();
    }, 300);
  };

  const hasFilters = grade !== null || minDays > 0 || search.length > 0 || sortBy !== "return";

  const clearFilters = () => {
    setGrade(null); setMinDays(0); setSearch(""); setSearchInput(""); setSortBy("return"); resetToPage1();
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <>
      {/* Controls row */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Period tabs */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => { setPeriod(p); resetToPage1(); }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  period === p
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-xs">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={t("search_placeholder")}
                className="w-full h-8 bg-muted/30 border border-border/60 rounded-md text-xs pl-8 pr-3 focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground"
              />
            </div>
            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs transition-colors ${
                showFilters || hasFilters
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <SlidersHorizontal className="h-3 w-3" />
              {t("filters")}
              {hasFilters && (
                <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground font-bold">
                  {[grade !== null, minDays > 0, search.length > 0, sortBy !== "return"].filter(Boolean).length}
                </span>
              )}
            </button>
            {hasFilters && (
              <button onClick={clearFilters} className="h-8 w-8 flex items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <span className="text-xs text-muted-foreground ml-auto">
            {total > 0 ? t("providers_count", { n: total }) : ""}
          </span>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="flex flex-wrap gap-4 p-3 rounded-lg border border-border/60 bg-muted/20">
            {/* Sort by */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{t("sort_by")}</span>
              <div className="flex gap-1 flex-wrap">
                {SORT_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    onClick={() => { setSortBy(o.value); resetToPage1(); }}
                    className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                      sortBy === o.value
                        ? "bg-primary/15 text-primary border border-primary/30"
                        : "border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grade */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{t("min_grade")}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => { setGrade(null); resetToPage1(); }}
                  className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                    grade === null
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "border-border/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("all")}
                </button>
                {GRADES.map(g => (
                  <button
                    key={g}
                    onClick={() => { setGrade(g); resetToPage1(); }}
                    className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                      grade === g
                        ? "bg-primary/15 text-primary border-primary/30"
                        : "border-border/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Min trading days */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{t("track_record")}</span>
              <div className="flex gap-1">
                {MIN_DAYS.map(d => (
                  <button
                    key={d.value}
                    onClick={() => { setMinDays(d.value); resetToPage1(); }}
                    className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                      minDays === d.value
                        ? "bg-primary/15 text-primary border-primary/30"
                        : "border-border/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <LeaderboardTable apiEntries={entries} loading={loading} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            disabled={page === 1 || loading}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 rounded-md border border-border text-xs disabled:opacity-40 hover:bg-muted/50 transition-colors"
          >
            {t("prev")}
          </button>
          <span className="px-3 py-1.5 text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages || loading}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 rounded-md border border-border text-xs disabled:opacity-40 hover:bg-muted/50 transition-colors"
          >
            {t("next")}
          </button>
        </div>
      )}
    </>
  );
}

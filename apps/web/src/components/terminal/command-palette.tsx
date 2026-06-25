"use client";

import { useEffect, useRef, useState } from "react";
import { Search, TrendingUp, Calendar, Newspaper, BarChart2, Zap, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: "symbol" | "navigate";
  value: string;
}

const QUICK_COMMANDS: Command[] = [
  { id: "eurusd", label: "EURUSD", description: "Euro / US Dollar", icon: <TrendingUp className="h-4 w-4" />, action: "symbol", value: "EURUSD" },
  { id: "gbpusd", label: "GBPUSD", description: "British Pound / US Dollar", icon: <TrendingUp className="h-4 w-4" />, action: "symbol", value: "GBPUSD" },
  { id: "usdjpy", label: "USDJPY", description: "US Dollar / Japanese Yen", icon: <TrendingUp className="h-4 w-4" />, action: "symbol", value: "USDJPY" },
  { id: "xauusd", label: "XAUUSD", description: "Gold / US Dollar", icon: <TrendingUp className="h-4 w-4" />, action: "symbol", value: "XAUUSD" },
  { id: "btcusd", label: "BTCUSD", description: "Bitcoin / US Dollar", icon: <TrendingUp className="h-4 w-4" />, action: "symbol", value: "BTCUSD" },
  { id: "us30", label: "US30", description: "Dow Jones Industrial Average", icon: <BarChart2 className="h-4 w-4" />, action: "symbol", value: "US30" },
  { id: "leaderboard", label: "Leaderboard", description: "View top masters", icon: <Zap className="h-4 w-4" />, action: "navigate", value: "/leaderboard" },
  { id: "calendar", label: "Economic Calendar", description: "Upcoming market events", icon: <Calendar className="h-4 w-4" />, action: "navigate", value: "calendar" },
  { id: "news", label: "Market News", description: "Latest financial news", icon: <Newspaper className="h-4 w-4" />, action: "navigate", value: "news" },
];

const FOREX_SYMBOLS = [
  "AUDUSD", "AUDCAD", "AUDCHF", "AUDJPY", "AUDNZD",
  "CADCHF", "CADJPY", "CHFJPY", "EURAUD", "EURCAD",
  "EURCHF", "EURGBP", "EURJPY", "EURNZD", "GBPAUD",
  "GBPCAD", "GBPCHF", "GBPJPY", "GBPNZD", "NZDCAD",
  "NZDCHF", "NZDJPY", "NZDUSD", "USDCAD", "USDCHF",
  "NASDAQ", "SPX500", "GER40", "NAS100",
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSymbolSelect: (symbol: string) => void;
  onTabChange: (tab: string) => void;
}

export function CommandPalette({ open, onClose, onSymbolSelect, onTabChange }: Props) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? [
        ...FOREX_SYMBOLS.filter((s) => s.startsWith(query.toUpperCase())).map((s) => ({
          id: s,
          label: s,
          description: "Forex symbol",
          icon: <TrendingUp className="h-4 w-4" />,
          action: "symbol" as const,
          value: s,
        })),
        ...QUICK_COMMANDS.filter(
          (c) =>
            c.label.toLowerCase().includes(query.toLowerCase()) ||
            c.description.toLowerCase().includes(query.toLowerCase())
        ),
      ].slice(0, 10)
    : QUICK_COMMANDS;

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  const handleSelect = (cmd: Command) => {
    if (cmd.action === "symbol") {
      onSymbolSelect(cmd.value);
    } else if (cmd.value === "calendar" || cmd.value === "news") {
      onTabChange(cmd.value);
    } else if (cmd.value.startsWith("/")) {
      window.location.href = cmd.value;
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIdx]) {
      handleSelect(filtered[selectedIdx]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div
        className="w-full max-w-xl mx-4 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <Search className="h-4 w-4 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search symbols, go to news, calendar…"
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 outline-none"
          />
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-zinc-500">No results for "{query}"</div>
          )}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              onClick={() => handleSelect(cmd)}
              onMouseEnter={() => setSelectedIdx(i)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                i === selectedIdx ? "bg-zinc-800 text-zinc-100" : "text-zinc-300 hover:bg-zinc-800/50"
              )}
            >
              <span className={cn("shrink-0", i === selectedIdx ? "text-primary" : "text-zinc-500")}>
                {cmd.icon}
              </span>
              <div>
                <div className="text-sm font-medium leading-tight">{cmd.label}</div>
                <div className="text-xs text-zinc-500">{cmd.description}</div>
              </div>
              {cmd.action === "symbol" && (
                <span className="ml-auto text-[10px] text-zinc-600 border border-zinc-700 rounded px-1.5 py-0.5">
                  ↵ chart
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 px-4 py-2 border-t border-zinc-800 text-[11px] text-zinc-600">
          <span><kbd className="bg-zinc-800 px-1 rounded">↑↓</kbd> navigate</span>
          <span><kbd className="bg-zinc-800 px-1 rounded">↵</kbd> select</span>
          <span><kbd className="bg-zinc-800 px-1 rounded">esc</kbd> close</span>
          <span className="ml-auto">Ctrl+K to open</span>
        </div>
      </div>
    </div>
  );
}

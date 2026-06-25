"use client";

import { useState, useCallback } from "react";
import { Calculator, X, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const PIP_SIZES: Record<string, number> = {
  EURUSD: 0.0001, GBPUSD: 0.0001, AUDUSD: 0.0001, NZDUSD: 0.0001,
  USDCAD: 0.0001, USDCHF: 0.0001, EURGBP: 0.0001, EURJPY: 0.01,
  GBPJPY: 0.01, USDJPY: 0.01, CADJPY: 0.01, AUDJPY: 0.01,
  XAUUSD: 0.01, XAGUSD: 0.001, BTCUSD: 1, US30: 1, NASDAQ: 1, SPX500: 0.1,
};

const BASE_CURRENCIES: Record<string, string> = {
  EURUSD: "EUR", GBPUSD: "GBP", AUDUSD: "AUD", NZDUSD: "NZD",
  USDCAD: "USD", USDCHF: "USD", USDJPY: "USD", EURJPY: "EUR",
  GBPJPY: "GBP", XAUUSD: "XAU", BTCUSD: "BTC", US30: "USD",
};

function calcLotSize(balance: number, riskPct: number, stopPips: number, symbol: string): {
  lots: number; riskAmount: number; pipValue: number;
} {
  const riskAmount = balance * (riskPct / 100);
  const pipSize = PIP_SIZES[symbol] ?? 0.0001;
  // Standard lot = 100,000 units; pip value per lot for USD-quoted = pipSize * 100000
  // For JPY pairs pip value is different but we simplify here
  const pipValuePerLot = pipSize * 100000;
  const lots = stopPips > 0 ? riskAmount / (stopPips * pipValuePerLot) : 0;
  return { lots: Math.max(0, lots), riskAmount, pipValue: pipValuePerLot };
}

interface Props {
  open: boolean;
  onClose: () => void;
  symbol: string;
  currentPrice?: number;
}

export function PositionCalculator({ open, onClose, symbol, currentPrice }: Props) {
  const [balance, setBalance] = useState("10000");
  const [riskPct, setRiskPct] = useState("1");
  const [stopPips, setStopPips] = useState("20");
  const [direction, setDirection] = useState<"BUY" | "SELL">("BUY");

  const bal = parseFloat(balance) || 0;
  const risk = parseFloat(riskPct) || 1;
  const stop = parseFloat(stopPips) || 0;

  const { lots, riskAmount, pipValue } = calcLotSize(bal, risk, stop, symbol);

  const minLot = 0.01;
  const roundedLots = Math.max(minLot, Math.round(lots / minLot) * minLot);
  const rrArr = [1.5, 2, 3];

  const handleClose = useCallback(() => onClose(), [onClose]);

  if (!open) return null;

  return (
    <div className="fixed left-4 bottom-4 z-40 w-72 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
        <Calculator className="h-4 w-4 text-amber-400" />
        <span className="text-sm font-semibold text-zinc-100">Position Calculator</span>
        <span className="ml-1 text-xs text-zinc-500 border border-zinc-700 rounded px-1.5">{symbol}</span>
        <button onClick={handleClose} className="ml-auto text-zinc-500 hover:text-zinc-300">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Direction */}
        <div className="flex rounded-lg overflow-hidden border border-zinc-700">
          {(["BUY", "SELL"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              className={cn(
                "flex-1 py-1.5 text-xs font-semibold transition-colors",
                direction === d
                  ? d === "BUY" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Inputs */}
        <div className="space-y-2">
          <label className="block">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Account Balance (USD)</span>
            <input
              type="number"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className="mt-0.5 w-full bg-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-100 outline-none border border-zinc-700 focus:border-zinc-500"
            />
          </label>
          <div className="flex gap-2">
            <label className="flex-1 block">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Risk %</span>
              <input
                type="number"
                value={riskPct}
                step="0.5"
                min="0.1"
                max="10"
                onChange={(e) => setRiskPct(e.target.value)}
                className="mt-0.5 w-full bg-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-100 outline-none border border-zinc-700 focus:border-zinc-500"
              />
            </label>
            <label className="flex-1 block">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Stop Loss (pips)</span>
              <input
                type="number"
                value={stopPips}
                min="1"
                onChange={(e) => setStopPips(e.target.value)}
                className="mt-0.5 w-full bg-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-100 outline-none border border-zinc-700 focus:border-zinc-500"
              />
            </label>
          </div>
          {/* Quick risk buttons */}
          <div className="flex gap-1">
            {[0.5, 1, 1.5, 2].map((r) => (
              <button
                key={r}
                onClick={() => setRiskPct(String(r))}
                className={cn(
                  "flex-1 text-[10px] py-1 rounded transition-colors",
                  parseFloat(riskPct) === r ? "bg-primary/20 text-primary" : "text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800"
                )}
              >
                {r}%
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="bg-zinc-800/60 rounded-xl p-3 space-y-2 border border-zinc-700/50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">Lot Size</span>
            <span className="text-lg font-bold font-mono text-amber-400">
              {roundedLots.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">Max Risk</span>
            <span className="text-sm font-mono text-red-400">${riskAmount.toFixed(2)}</span>
          </div>
          <div className="h-px bg-zinc-700" />
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-600 uppercase tracking-wide">Take Profit Targets</span>
            {rrArr.map((rr) => {
              const tpPips = stop * rr;
              return (
                <div key={rr} className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500">{rr}R ({tpPips.toFixed(0)} pips)</span>
                  <span className="text-[11px] font-mono text-emerald-400">
                    +${(riskAmount * rr).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {currentPrice && (
          <div className="flex items-start gap-1.5 text-[10px] text-zinc-600">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            <span>Pip value estimate. Actual varies with broker leverage and account currency.</span>
          </div>
        )}
      </div>
    </div>
  );
}

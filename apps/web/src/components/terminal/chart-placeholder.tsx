"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { createChart, ColorType, CandlestickSeries, LineSeries, HistogramSeries } from "lightweight-charts";

interface Props { symbol: string; resolution?: number; timeframeLabel?: string }

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type IndicatorKey = "MA20" | "MA50" | "EMA200" | "BB" | "RSI" | "MACD";

const INDICATOR_COLORS: Record<IndicatorKey, string> = {
  MA20: "#60a5fa",
  MA50: "#f59e0b",
  EMA200: "#a78bfa",
  BB: "#6ee7b7",
  RSI: "#fb923c",
  MACD: "#34d399",
};

// ── Pure math — no external library needed for MA/EMA ──────────────────────
function sma(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) =>
    i < period - 1 ? null : closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
  );
}

function ema(closes: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const result: (number | null)[] = new Array(closes.length).fill(null);
  let prev: number | null = null;
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { result[i] = null; continue; }
    if (prev === null) {
      prev = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    } else {
      prev = closes[i] * k + prev * (1 - k);
    }
    result[i] = prev;
  }
  return result;
}

function bollingerBands(closes: number[], period = 20, stdMult = 2) {
  const mid = sma(closes, period);
  return closes.map((_, i) => {
    if (mid[i] === null) return { upper: null, mid: null, lower: null };
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = mid[i]!;
    const variance = slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    return { upper: mean + stdMult * std, mid: mean, lower: mean - stdMult * std };
  });
}

function rsi(closes: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return result;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

function macd(closes: number[]): { macd: (number|null)[]; signal: (number|null)[]; histogram: (number|null)[] } {
  const fast = ema(closes, 12);
  const slow = ema(closes, 26);
  const macdLine = closes.map((_, i) =>
    fast[i] !== null && slow[i] !== null ? fast[i]! - slow[i]! : null
  );
  const validMacd = macdLine.filter(v => v !== null) as number[];
  const signalInput = [...new Array(macdLine.findIndex(v => v !== null)).fill(null), ...ema(validMacd, 9)];
  const signal = macdLine.map((_, i) => {
    const signalIdx = macdLine.slice(0, i + 1).filter(v => v !== null).length - 1;
    return macdLine[i] !== null ? signalInput[signalIdx] ?? null : null;
  });
  const histogram = macdLine.map((v, i) =>
    v !== null && signal[i] !== null ? v - signal[i]! : null
  );
  return { macd: macdLine, signal, histogram };
}

export function ChartPlaceholder({ symbol, resolution = 3600, timeframeLabel = "H1" }: Props) {
  const t = useTranslations("terminal");
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndicators, setActiveIndicators] = useState<Set<IndicatorKey>>(new Set(["MA20", "MA50"]));
  const candleDataRef = useRef<{ time: number; open: number; high: number; low: number; close: number }[]>([]);

  const toggleIndicator = useCallback((key: IndicatorKey) => {
    setActiveIndicators(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const hasRSI = activeIndicators.has("RSI");
    const hasMACD = activeIndicators.has("MACD");
    const subPanes = (hasRSI ? 1 : 0) + (hasMACD ? 1 : 0);

    const mainH = subPanes === 0 ? el.clientHeight : subPanes === 1 ? Math.floor(el.clientHeight * 0.68) : Math.floor(el.clientHeight * 0.55);

    const chart = createChart(el, {
      layout: { background: { type: ColorType.Solid, color: "#09090b" }, textColor: "#71717a" },
      grid: { vertLines: { color: "#27272a" }, horzLines: { color: "#27272a" } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: "#27272a" },
      timeScale: { borderColor: "#27272a", timeVisible: true },
      width: el.clientWidth,
      height: el.clientHeight,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#34d399", downColor: "#f87171",
      borderUpColor: "#34d399", borderDownColor: "#f87171",
      wickUpColor: "#34d399", wickDownColor: "#f87171",
    }, 0);

    const loadAndRender = (rawCandles: { time: number; open: number; high: number; low: number; close: number }[]) => {
      candleDataRef.current = rawCandles;
      const lwCandles = rawCandles.map(c => ({
        time: c.time as unknown as import("lightweight-charts").Time,
        open: c.open, high: c.high, low: c.low, close: c.close,
      }));
      candleSeries.setData(lwCandles);

      const times = rawCandles.map(c => c.time);
      const closes = rawCandles.map(c => c.close);

      if (activeIndicators.has("MA20")) {
        const ma20 = chart.addSeries(LineSeries, { color: INDICATOR_COLORS.MA20, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, 0);
        ma20.setData(sma(closes, 20).map((v, i) => v !== null ? { time: times[i] as unknown as import("lightweight-charts").Time, value: v } : null).filter(Boolean) as { time: import("lightweight-charts").Time; value: number }[]);
      }
      if (activeIndicators.has("MA50")) {
        const ma50 = chart.addSeries(LineSeries, { color: INDICATOR_COLORS.MA50, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, 0);
        ma50.setData(sma(closes, 50).map((v, i) => v !== null ? { time: times[i] as unknown as import("lightweight-charts").Time, value: v } : null).filter(Boolean) as { time: import("lightweight-charts").Time; value: number }[]);
      }
      if (activeIndicators.has("EMA200")) {
        const ema200 = chart.addSeries(LineSeries, { color: INDICATOR_COLORS.EMA200, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, 0);
        ema200.setData(ema(closes, 200).map((v, i) => v !== null ? { time: times[i] as unknown as import("lightweight-charts").Time, value: v } : null).filter(Boolean) as { time: import("lightweight-charts").Time; value: number }[]);
      }
      if (activeIndicators.has("BB")) {
        const bands = bollingerBands(closes);
        const upper = chart.addSeries(LineSeries, { color: INDICATOR_COLORS.BB, lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false }, 0);
        const lower = chart.addSeries(LineSeries, { color: INDICATOR_COLORS.BB, lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false }, 0);
        upper.setData(bands.map((b, i) => b.upper !== null ? { time: times[i] as unknown as import("lightweight-charts").Time, value: b.upper } : null).filter(Boolean) as { time: import("lightweight-charts").Time; value: number }[]);
        lower.setData(bands.map((b, i) => b.lower !== null ? { time: times[i] as unknown as import("lightweight-charts").Time, value: b.lower } : null).filter(Boolean) as { time: import("lightweight-charts").Time; value: number }[]);
      }

      let nextPane = 1;
      if (hasRSI) {
        chart.addPane();
        const rsiValues = rsi(closes);
        const rsiSeries = chart.addSeries(LineSeries, { color: INDICATOR_COLORS.RSI, lineWidth: 1, priceLineVisible: false, lastValueVisible: true }, nextPane);
        rsiSeries.setData(rsiValues.map((v, i) => v !== null ? { time: times[i] as unknown as import("lightweight-charts").Time, value: v } : null).filter(Boolean) as { time: import("lightweight-charts").Time; value: number }[]);
        nextPane++;
      }
      if (hasMACD) {
        chart.addPane();
        const { macd: macdLine, signal: macdSignal, histogram: macdHist } = macd(closes);
        const macdSeries = chart.addSeries(LineSeries, { color: INDICATOR_COLORS.MACD, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, nextPane);
        const signalSeries = chart.addSeries(LineSeries, { color: "#f87171", lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, nextPane);
        const histSeries = chart.addSeries(HistogramSeries, { color: "#60a5fa44", priceLineVisible: false, lastValueVisible: false }, nextPane);
        macdSeries.setData(macdLine.map((v, i) => v !== null ? { time: times[i] as unknown as import("lightweight-charts").Time, value: v } : null).filter(Boolean) as { time: import("lightweight-charts").Time; value: number }[]);
        signalSeries.setData(macdSignal.map((v, i) => v !== null ? { time: times[i] as unknown as import("lightweight-charts").Time, value: v } : null).filter(Boolean) as { time: import("lightweight-charts").Time; value: number }[]);
        histSeries.setData(macdHist.map((v, i) => v !== null ? { time: times[i] as unknown as import("lightweight-charts").Time, value: v, color: v >= 0 ? "#34d39944" : "#f8717144" } : null).filter(Boolean) as { time: import("lightweight-charts").Time; value: number; color: string }[]);
      }

      chart.timeScale().fitContent();
    };

    const now = Math.floor(Date.now() / 1000);
    const lookback = resolution > 3600 ? 180 : resolution > 300 ? 7 * 24 : 200;
    const from = now - lookback * resolution;

    const makeMock = () => {
      const basePrices: Record<string, number> = { EURUSD: 1.084, GBPUSD: 1.268, USDJPY: 157.4, XAUUSD: 2341, BTCUSD: 67240, US30: 39148, USDCAD: 1.361, AUDUSD: 0.654 };
      let price = basePrices[symbol] ?? 1.0;
      const vol = price > 10000 ? 50 : price > 1000 ? 5 : price > 10 ? 0.5 : 0.002;
      return Array.from({ length: lookback + 1 }, (_, idx) => {
        const t = from + idx * resolution;
        const o = price;
        const c = o + (Math.random() - 0.48) * vol;
        const candle = { time: t, open: o, high: Math.max(o, c) + Math.random() * vol * 0.5, low: Math.min(o, c) - Math.random() * vol * 0.5, close: c };
        price = c;
        return candle;
      });
    };

    let cancelled = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const startLivePolling = () => {
      pollInterval = setInterval(async () => {
        if (cancelled) return;
        try {
          const res = await fetch(`${API_BASE}/api/v1/market/quote?symbol=${symbol}`);
          if (!res.ok || cancelled) return;
          const q = await res.json();
          const price = parseFloat(q.c ?? q.price ?? "0");
          if (!price) return;
          const candles = candleDataRef.current;
          if (!candles.length) return;

          const nowTs = Math.floor(Date.now() / 1000);
          const periodStart = Math.floor(nowTs / resolution) * resolution;
          const last = candles[candles.length - 1];

          let updated: typeof last;
          if (periodStart > last.time) {
            updated = { time: periodStart, open: last.close, high: price, low: price, close: price };
            candleDataRef.current.push(updated);
          } else {
            updated = { ...last, high: Math.max(last.high, price), low: Math.min(last.low, price), close: price };
            candleDataRef.current[candles.length - 1] = updated;
          }
          candleSeries.update({
            time: updated.time as unknown as import("lightweight-charts").Time,
            open: updated.open, high: updated.high, low: updated.low, close: updated.close,
          });
        } catch { /* ignore transient errors */ }
      }, 5000);
    };

    fetch(`${API_BASE}/api/v1/market/candles?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${now}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: { s: string; t: number[]; o: number[]; h: number[]; l: number[]; c: number[] }) => {
        if (cancelled) return;
        if (data.s === "ok" && data.t?.length > 10) {
          loadAndRender(data.t.map((t, i) => ({ time: t, open: data.o[i], high: data.h[i], low: data.l[i], close: data.c[i] })));
          startLivePolling();
        } else {
          loadAndRender(makeMock());
        }
      })
      .catch(() => { if (!cancelled) loadAndRender(makeMock()); });

    const ro = new ResizeObserver(() => {
      if (el) chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);

    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
      ro.disconnect();
      chart.remove();
    };
  }, [symbol, resolution, activeIndicators]);

  const ALL_INDICATORS: IndicatorKey[] = ["MA20", "MA50", "EMA200", "BB", "RSI", "MACD"];

  return (
    <div className="flex-1 relative overflow-hidden bg-zinc-950">
      <div ref={containerRef} className="w-full h-full" />

      {/* Indicator toolbar */}
      <div className="absolute top-2 left-3 flex items-center gap-1 z-10">
        {ALL_INDICATORS.map((ind) => {
          const active = activeIndicators.has(ind);
          return (
            <button
              key={ind}
              onClick={() => toggleIndicator(ind)}
              style={{ borderColor: active ? INDICATOR_COLORS[ind] : undefined, color: active ? INDICATOR_COLORS[ind] : undefined }}
              className={`text-[10px] px-1.5 py-0.5 rounded border transition-all ${
                active
                  ? "bg-zinc-800/80"
                  : "border-zinc-700 text-zinc-600 hover:text-zinc-400 hover:border-zinc-500"
              }`}
            >
              {ind}
            </button>
          );
        })}
      </div>

      {/* Symbol + live badge */}
      <div className="absolute top-2 right-3 flex items-center gap-1.5 text-xs text-muted-foreground pointer-events-none">
        <span className="font-semibold text-zinc-300">{symbol}</span>
        <span className="text-zinc-600">·</span>
        <span className="text-zinc-500 font-mono">{timeframeLabel}</span>
        <span className="text-emerald-400 font-mono ml-1">●</span>
        <span className="text-emerald-400 text-[10px]">{t("live")}</span>
      </div>
    </div>
  );
}

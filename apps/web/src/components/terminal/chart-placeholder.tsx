"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType, CandlestickSeries } from "lightweight-charts";

interface Props { symbol: string; resolution?: number; timeframeLabel?: string }

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function ChartPlaceholder({ symbol, resolution = 3600, timeframeLabel = "H1" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "#09090b" },
        textColor: "#71717a",
      },
      grid: {
        vertLines: { color: "#27272a" },
        horzLines: { color: "#27272a" },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: "#27272a" },
      timeScale: { borderColor: "#27272a", timeVisible: true },
      width: el.clientWidth,
      height: el.clientHeight,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#34d399",
      downColor: "#f87171",
      borderUpColor: "#34d399",
      borderDownColor: "#f87171",
      wickUpColor: "#34d399",
      wickDownColor: "#f87171",
    });

    const now = Math.floor(Date.now() / 1000);
    const lookback = resolution > 3600 ? 180 : resolution > 300 ? 7 * 24 : 200;
    const from = now - lookback * resolution;

    const loadMock = () => {
      const candles = [];
      const basePrices: Record<string, number> = { EURUSD: 1.084, GBPUSD: 1.268, USDJPY: 157.4, XAUUSD: 2341, BTCUSD: 67240, US30: 39148, USDCAD: 1.361, AUDUSD: 0.654 };
      let price = basePrices[symbol] ?? 1.0;
      const volatility = price > 10000 ? 50 : price > 1000 ? 5 : price > 10 ? 0.5 : 0.002;
      for (let i = lookback; i >= 0; i--) {
        const t = now - i * resolution;
        const o = price;
        const c = o + (Math.random() - 0.48) * volatility;
        candles.push({
          time: t as unknown as import("lightweight-charts").Time,
          open: o, high: Math.max(o, c) + Math.random() * volatility * 0.5,
          low: Math.min(o, c) - Math.random() * volatility * 0.5, close: c,
        });
        price = c;
      }
      candleSeries.setData(candles);
      chart.timeScale().fitContent();
    };

    fetch(`${API_BASE}/api/v1/market/candles?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${now}`)
      .then(r => r.json())
      .then((data: { s: string; t: number[]; o: number[]; h: number[]; l: number[]; c: number[] }) => {
        if (data.s === "ok" && data.t?.length) {
          const candles = data.t.map((time, i) => ({
            time: time as unknown as import("lightweight-charts").Time,
            open: data.o[i], high: data.h[i], low: data.l[i], close: data.c[i],
          }));
          candleSeries.setData(candles);
          chart.timeScale().fitContent();
        } else {
          loadMock();
        }
      })
      .catch(loadMock);

    const ro = new ResizeObserver(() => {
      if (el) chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [symbol, resolution]);

  return (
    <div className="flex-1 relative overflow-hidden bg-zinc-950">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute top-3 left-3 flex items-center gap-1.5 text-xs text-muted-foreground pointer-events-none">
        <span className="font-semibold">{symbol}</span>
        <span className="text-muted-foreground/60">· H1</span>
        <span className="ml-2 text-muted-foreground/70 font-mono">{timeframeLabel}</span>
        <span className="ml-1 text-emerald-400 font-mono">Live</span>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
      </div>
    </div>
  );
}

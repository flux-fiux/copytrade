"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType, CandlestickSeries } from "lightweight-charts";

interface Props { symbol: string }

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function ChartPlaceholder({ symbol }: Props) {
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
    const from = now - 7 * 24 * 3600;

    const loadMock = () => {
      const candles = [];
      let price = 1.084;
      for (let i = 200; i >= 0; i--) {
        const t = now - i * 3600;
        const o = price;
        const c = o + (Math.random() - 0.48) * 0.002;
        candles.push({
          time: t as unknown as import("lightweight-charts").Time,
          open: o, high: Math.max(o, c) + Math.random() * 0.001,
          low: Math.min(o, c) - Math.random() * 0.001, close: c,
        });
        price = c;
      }
      candleSeries.setData(candles);
      chart.timeScale().fitContent();
    };

    fetch(`${API_BASE}/api/v1/market/candles?symbol=${symbol}&resolution=60&from=${from}&to=${now}`)
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
  }, [symbol]);

  return (
    <div className="flex-1 relative overflow-hidden bg-zinc-950">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute top-3 left-3 flex items-center gap-1.5 text-xs text-muted-foreground pointer-events-none">
        <span className="font-semibold">{symbol}</span>
        <span className="text-muted-foreground/60">· H1</span>
        <span className="ml-2 text-emerald-400 font-mono">Live</span>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
      </div>
    </div>
  );
}

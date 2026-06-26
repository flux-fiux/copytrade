"use client";

import { motion } from "framer-motion";

const ITEMS = [
  { s: "EUR/USD", p: "1.0848", c: +0.08 },
  { s: "BTC/USD", p: "67,232", c: -0.01 },
  { s: "XAU/USD", p: "2,339.9", c: -0.07 },
  { s: "GBP/USD", p: "1.2690", c: +0.05 },
  { s: "US30", p: "39,157", c: +0.02 },
  { s: "USD/JPY", p: "157.44", c: -0.03 },
  { s: "NAS100", p: "18,402", c: +0.31 },
  { s: "ETH/USD", p: "3,512", c: +1.24 },
  { s: "USD/CAD", p: "1.3616", c: +0.03 },
  { s: "AUD/USD", p: "0.6546", c: -0.03 },
];

/** Infinite marquee of market quotes — gives the landing page a live, trading-floor feel. */
export function PriceTicker() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div className="relative overflow-hidden border-y border-border/40 bg-card/30 py-3 backdrop-blur">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />
      <motion.div
        className="flex w-max gap-8 whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 40, ease: "linear", repeat: Infinity }}
      >
        {row.map((it, i) => (
          <div key={i} className="flex items-center gap-2 text-sm font-mono">
            <span className="text-muted-foreground">{it.s}</span>
            <span className="font-semibold">{it.p}</span>
            <span className={it.c >= 0 ? "text-emerald-400" : "text-red-400"}>
              {it.c >= 0 ? "+" : ""}{it.c}%
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

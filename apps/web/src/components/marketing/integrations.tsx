"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link2, Bitcoin, LineChart } from "lucide-react";

// Brand-tinted wordmark chips (no external logo assets needed).
const FX = [
  { name: "MetaTrader 4", dot: "bg-red-400" },
  { name: "MetaTrader 5", dot: "bg-sky-400" },
  { name: "cTrader", dot: "bg-indigo-400" },
  { name: "Interactive Brokers", dot: "bg-red-500" },
];
const CRYPTO = [
  { name: "Binance", dot: "bg-amber-400" },
  { name: "OKX", dot: "bg-zinc-200" },
  { name: "Bybit", dot: "bg-yellow-400" },
  { name: "Coinbase", dot: "bg-blue-400" },
  { name: "Kraken", dot: "bg-violet-400" },
  { name: "Bitget", dot: "bg-teal-400" },
  { name: "KuCoin", dot: "bg-emerald-400" },
  { name: "Deribit", dot: "bg-cyan-400" },
];

function Chip({ name, dot }: { name: string; dot: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/50 px-4 py-3 backdrop-blur transition hover:border-primary/40 hover:bg-background/80">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span className="whitespace-nowrap text-sm font-medium">{name}</span>
    </div>
  );
}

export function Integrations() {
  const t = useTranslations("landing");
  const marquee = [...FX, ...CRYPTO, ...FX, ...CRYPTO];

  return (
    <section className="relative overflow-hidden py-28">
      {/* animated background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <motion.div
          className="absolute left-1/2 top-1/4 h-[34rem] w-[60rem] -translate-x-1/2 rounded-full bg-primary/15 blur-[140px]"
          animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.08, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
      </div>

      <div className="mx-auto max-w-3xl px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary"
        >
          <Link2 className="h-3.5 w-3.5" /> {t("int_eyebrow")}
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="mt-5 font-heading text-4xl font-bold tracking-tight md:text-5xl"
        >
          {t("int_title_a")}{" "}
          <span className="bg-gradient-to-r from-primary via-indigo-400 to-primary bg-clip-text text-transparent">
            {t("int_title_b")}
          </span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.12 }}
          className="mx-auto mt-5 max-w-2xl text-muted-foreground md:text-lg"
        >
          {t("int_subtitle")}
        </motion.p>
      </div>

      {/* full-width marquee of venues */}
      <div className="relative mt-14 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-background to-transparent" />
        <motion.div
          className="flex w-max gap-4"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 30, ease: "linear", repeat: Infinity }}
        >
          {marquee.map((v, i) => <Chip key={i} {...v} />)}
        </motion.div>
      </div>

      {/* two grouped panels */}
      <div className="mx-auto mt-16 grid max-w-6xl gap-6 px-4 lg:grid-cols-2">
        {[
          { icon: LineChart, key: "fx", items: FX, status: t("int_live"), statusCls: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
          { icon: Bitcoin, key: "crypto", items: CRYPTO, status: t("int_soon"), statusCls: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
        ].map(({ icon: Icon, key, items, status, statusCls }, gi) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, delay: gi * 0.1 }}
            className="rounded-2xl border border-border/60 bg-card/40 p-7 backdrop-blur"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{t(`int_${key}_title`)}</h3>
              </div>
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusCls}`}>{status}</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{t(`int_${key}_desc`)}</p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              {items.map((it, i) => (
                <motion.div
                  key={it.name}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.2 + i * 0.05 }}
                >
                  <Chip {...it} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* stat strip */}
      <div className="mx-auto mt-14 flex max-w-3xl flex-wrap items-center justify-center gap-x-12 gap-y-4 px-4 text-center">
        {[
          { v: "20+", k: "int_stat_venues" },
          { v: "< 5ms", k: "int_stat_latency" },
          { v: "AES-256", k: "int_stat_security" },
        ].map((s) => (
          <div key={s.k}>
            <div className="font-mono text-2xl font-bold text-primary">{s.v}</div>
            <div className="mt-1 text-xs text-muted-foreground">{t(s.k)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

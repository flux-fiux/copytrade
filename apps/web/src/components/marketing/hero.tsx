"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { ArrowRight, Sparkles, TrendingUp, Minus } from "lucide-react";

export function Hero() {
  const t = useTranslations("landing");

  return (
    <section className="relative overflow-hidden">
      {/* Animated gradient mesh background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <motion.div
          className="absolute -top-40 left-1/4 h-[36rem] w-[36rem] rounded-full bg-primary/25 blur-[120px]"
          animate={{ x: [0, 60, 0], y: [0, 40, 0], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -top-20 right-1/4 h-[30rem] w-[30rem] rounded-full bg-indigo-500/20 blur-[120px]"
          animate={{ x: [0, -50, 0], y: [0, 60, 0], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      </div>

      <div className="container mx-auto px-4 pt-20 pb-12 md:pt-28 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {t("eyebrow")}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="mx-auto mt-6 max-w-4xl font-heading text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl"
        >
          {t("title_a")}{" "}
          <span className="bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
            {t("title_b")}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.12 }}
          className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground md:text-lg"
        >
          {t("subtitle")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.18 }}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <Link
            href="/terminal"
            className="group inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:shadow-primary/40"
          >
            {t("cta_terminal")}
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/dashboard/analyst"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/50 px-6 py-3 text-sm font-semibold backdrop-blur transition hover:bg-card"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            {t("cta_analyst")}
          </Link>
        </motion.div>

        {/* Product mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.25, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="relative mx-auto mt-16 max-w-5xl"
        >
          {/* glow */}
          <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-tr from-primary/30 via-indigo-500/20 to-transparent blur-2xl" />
          <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl">
            {/* browser chrome */}
            <div className="flex items-center gap-1.5 border-b border-border/60 bg-background/80 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
              <span className="ml-3 rounded-md bg-card px-3 py-0.5 text-[10px] text-muted-foreground font-mono">
                gann.arbmind.me/terminal
              </span>
            </div>
            <Image
              src="/marketing/terminal.png"
              alt="ArbMind Terminal"
              width={1440}
              height={900}
              priority
              className="w-full"
            />
          </div>

          {/* floating AI decision card */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.7 }}
            className="absolute -right-4 top-1/3 hidden w-56 rounded-xl border border-border/60 bg-card/90 p-4 shadow-xl backdrop-blur md:block"
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> {t("card_title")}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-mono font-semibold">NVDA</span>
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">
                  <Minus className="h-3 w-3" /> HOLD
                </span>
              </div>
              <div className="mt-3 space-y-1.5">
                {["market", "news", "risk"].map((k, i) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className="h-full bg-primary/60"
                        initial={{ width: 0 }}
                        animate={{ width: `${70 - i * 12}%` }}
                        transition={{ duration: 1, delay: 1 + i * 0.2 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

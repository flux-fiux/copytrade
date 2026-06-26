"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { BarChart3, Sparkles, Copy, Cpu, ArrowUpRight } from "lucide-react";

export function Modules() {
  const t = useTranslations("landing");

  const mods = [
    { key: "terminal", icon: BarChart3, href: "/terminal", accent: "from-sky-500/20", live: true },
    { key: "analyst", icon: Sparkles, href: "/dashboard/analyst", accent: "from-primary/25", live: true },
    { key: "copy", icon: Copy, href: "/leaderboard", accent: "from-emerald-500/20", live: true },
    { key: "strategy", icon: Cpu, href: "#", accent: "from-indigo-500/20", live: false },
  ];

  return (
    <section className="container mx-auto px-4 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-heading text-3xl font-bold md:text-4xl">{t("modules_title")}</h2>
        <p className="mt-3 text-muted-foreground">{t("modules_subtitle")}</p>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {mods.map(({ key, icon: Icon, href, accent, live }, i) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: i * 0.08 }}
          >
            <Link
              href={href}
              className="group relative block h-full overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur transition hover:-translate-y-1 hover:border-primary/40"
            >
              <div className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${accent} to-transparent blur-2xl opacity-0 transition group-hover:opacity-100`} />
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                {live ? (
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
                ) : (
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                    {t("soon")}
                  </span>
                )}
              </div>
              <h3 className="mt-4 font-semibold">{t(`mod_${key}_title`)}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{t(`mod_${key}_desc`)}</p>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

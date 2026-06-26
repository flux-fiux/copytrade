"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { ArrowRight, LineChart, Newspaper, Scale, Gavel } from "lucide-react";

export function AiSpotlight() {
  const t = useTranslations("landing");

  const agents = [
    { icon: LineChart, key: "market" },
    { icon: Newspaper, key: "news" },
    { icon: Scale, key: "debate" },
    { icon: Gavel, key: "verdict" },
  ];

  return (
    <section className="relative overflow-hidden border-y border-border/40 bg-card/20 py-20">
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]" />
      <div className="container mx-auto grid items-center gap-12 px-4 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {t("ai_eyebrow")}
          </div>
          <h2 className="mt-4 font-heading text-3xl font-bold md:text-4xl">{t("ai_title")}</h2>
          <p className="mt-4 text-muted-foreground">{t("ai_desc")}</p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {agents.map(({ icon: Icon, key }, i) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-background/50 px-3 py-2.5"
              >
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-sm">{t(`ai_agent_${key}`)}</span>
              </motion.div>
            ))}
          </div>

          <Link
            href="/dashboard/analyst"
            className="group mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25"
          >
            {t("ai_cta")}
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 24 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8 }}
          className="relative"
        >
          <div className="absolute -inset-3 -z-10 rounded-3xl bg-gradient-to-tr from-primary/25 to-transparent blur-2xl" />
          <div className="overflow-hidden rounded-xl border border-border/60 shadow-2xl">
            <Image
              src="/marketing/analyst.png"
              alt="ArbMind AI Analyst"
              width={1280}
              height={1000}
              className="w-full"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

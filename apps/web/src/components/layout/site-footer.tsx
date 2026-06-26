"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export function SiteFooter() {
  const t = useTranslations("footer");
  return (
    <footer className="border-t border-border/40 mt-auto">
      <div className="container mx-auto px-4 py-6 space-y-3">
        {/* Risk disclaimer — also covers illustrative/sample data shown pre-launch */}
        <p className="text-[11px] leading-relaxed text-muted-foreground max-w-4xl">
          ⚠️ {t("disclaimer")}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>© 2024 CopyTrade · {t("rights")}</span>
          <Link href="/terms" className="hover:text-foreground transition-colors">{t("terms")}</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">{t("privacy")}</Link>
        </div>
      </div>
    </footer>
  );
}

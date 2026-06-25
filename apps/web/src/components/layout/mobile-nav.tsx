"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { TrendingUp, BarChart2, LayoutDashboard, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  const tabs = [
    { href: "/", label: t("home"), icon: Home, exact: true },
    { href: "/leaderboard", label: t("leaderboard_short"), icon: TrendingUp },
    { href: "/terminal", label: t("terminal"), icon: BarChart2 },
    { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {tabs.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "relative flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs transition-colors",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
            <span>{label}</span>
            {active && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-primary" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

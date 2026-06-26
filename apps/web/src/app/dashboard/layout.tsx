"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard, Cpu, BookOpen, Radio, DollarSign, Settings,
  Star, Clock, XCircle, Copy, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/lib/api-client";

interface SidebarLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  disabled?: boolean;
  badge?: string;
  badgeColor?: string;
}

function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [kyc, setKyc] = useState<string>("NONE");
  const [isMaster, setIsMaster] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const user = await api.users.me(session.access_token);
        setKyc(user.kyc_status ?? "NONE");
        setIsMaster((user.roles ?? []).includes("MASTER"));
      } catch {
        // silent — keep default state
      }
    })();
  }, []);

  const links: SidebarLink[] = [
    { href: "/dashboard", label: t("overview"), icon: LayoutDashboard, exact: true },
    { href: "/dashboard/accounts", label: t("accounts"), icon: Cpu },
    { href: "/dashboard/subscriptions", label: t("subscriptions"), icon: BookOpen },
    { href: "/dashboard/signals", label: t("signals"), icon: Radio },
    { href: "/dashboard/trades", label: t("trades"), icon: Copy },
    { href: "/dashboard/analyst", label: t("ai_analyst"), icon: Sparkles },
    ...(isMaster
      ? [{ href: "/dashboard/earnings", label: t("earnings"), icon: DollarSign }]
      : []),
    { href: "/dashboard/settings", label: t("settings"), icon: Settings },
  ];

  const masterCta: SidebarLink | null = isMaster
    ? null
    : kyc === "PENDING"
    ? { href: "/dashboard/apply-master", label: t("apply_pending"), icon: Clock, disabled: true, badge: "PENDING", badgeColor: "text-amber-400 bg-amber-500/10 border-amber-500/30" }
    : kyc === "REJECTED"
    ? { href: "/dashboard/apply-master", label: t("reapply_master"), icon: XCircle, badge: "REJECTED", badgeColor: "text-red-400 bg-red-500/10 border-red-500/30" }
    : { href: "/dashboard/apply-master", label: t("become_master"), icon: Star };

  return (
    <aside className="w-56 border-r border-border/50 shrink-0 flex flex-col">
      <div className="px-4 py-4 border-b border-border/50">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("dashboard")}</div>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {links.map(({ href, label, icon: Icon, exact }) => {
          const active = exact
            ? pathname === href
            : pathname.startsWith(href) && pathname !== "/dashboard";
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Master CTA pinned to bottom */}
      {masterCta && (
        <div className="px-2 pb-4">
          <div className="border-t border-border/50 pt-3">
            {masterCta.disabled ? (
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium opacity-60 cursor-not-allowed text-muted-foreground">
                <masterCta.icon className="h-4 w-4" />
                <span className="flex-1 truncate text-xs">{masterCta.label}</span>
                {masterCta.badge && (
                  <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full border font-semibold", masterCta.badgeColor)}>
                    {masterCta.badge}
                  </span>
                )}
              </div>
            ) : (
              <Link
                href={masterCta.href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  pathname.startsWith(masterCta.href)
                    ? "bg-accent text-accent-foreground"
                    : "text-primary hover:bg-primary/10"
                )}
              >
                <masterCta.icon className="h-4 w-4" />
                <span className="flex-1 truncate text-xs">{masterCta.label}</span>
                {masterCta.badge && (
                  <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full border font-semibold", masterCta.badgeColor)}>
                    {masterCta.badge}
                  </span>
                )}
              </Link>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[calc(100vh-64px)]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

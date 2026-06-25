"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Cpu, BookOpen, Radio, DollarSign, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const sidebarLinks = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/accounts", label: "My Accounts", icon: Cpu },
  { href: "/dashboard/subscriptions", label: "Subscriptions", icon: BookOpen },
  { href: "/dashboard/signals", label: "Signals", icon: Radio },
  { href: "/dashboard/earnings", label: "Earnings", icon: DollarSign },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 border-r border-border/50 shrink-0 flex flex-col">
      <div className="px-4 py-4 border-b border-border/50">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dashboard</div>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {sidebarLinks.map(({ href, label, icon: Icon, exact }) => {
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

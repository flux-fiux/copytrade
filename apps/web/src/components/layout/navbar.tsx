"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart2, TrendingUp, Users, Bell, ChevronDown } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";

const navLinks = [
  { href: "/leaderboard", label: "Leaderboard", icon: TrendingUp },
  { href: "/terminal", label: "Terminal", icon: BarChart2 },
  { href: "/community", label: "Community", icon: Users },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <TrendingUp className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight">CopyTrade</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">BETA</Badge>
        </Link>

        {/* Nav Links */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname.startsWith(href)
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost" }), "flex items-center gap-2 px-2")}>
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">U</AvatarFallback>
              </Avatar>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => router.push("/dashboard")}>
                Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/dashboard/accounts")}>
                My Accounts
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/dashboard/subscriptions")}>
                Subscriptions
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">Sign Out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Link href="/auth/login" className={buttonVariants({ size: "sm" })}>
            Sign In
          </Link>
        </div>
      </div>
    </header>
  );
}

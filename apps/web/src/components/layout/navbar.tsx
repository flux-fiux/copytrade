"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart2, TrendingUp, Bell, ChevronDown, Loader2 } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/lib/auth-actions";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { subscribeNotif, clearNotif } from "@/store/notifications";

const navLinks = [
  { href: "/leaderboard", label: "Leaderboard", icon: TrendingUp },
  { href: "/terminal", label: "Terminal", icon: BarChart2 },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null | undefined>(undefined);
  const [signingOut, setSigningOut] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => subscribeNotif(setNotifCount), []);

  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : "U";

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    router.push("/");
  };

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
          {userEmail === undefined ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : userEmail ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => { clearNotif(); router.push("/dashboard/signals"); }}
                title="Notifications"
              >
                <Bell className="h-4 w-4" />
                {notifCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground leading-none">
                    {notifCount > 99 ? "99" : notifCount}
                  </span>
                )}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost" }), "flex items-center gap-2 px-2")}>
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:block text-sm max-w-[120px] truncate">{userEmail}</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">{userEmail}</div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/dashboard")}>Dashboard</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/dashboard/accounts")}>My Accounts</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/dashboard/subscriptions")}>Subscriptions</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>Settings</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={handleSignOut}
                    disabled={signingOut}
                  >
                    {signingOut ? "Signing out…" : "Sign Out"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/auth/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>Sign In</Link>
              <Link href="/auth/register" className={cn(buttonVariants({ size: "sm" }))}>Get Started</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

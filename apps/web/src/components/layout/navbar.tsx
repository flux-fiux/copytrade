"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart2, TrendingUp, ChevronDown, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
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
import { NotificationCenter } from "@/components/layout/notification-center";

interface NavBranding {
  name: string;
  logoUrl: string | null;
}

export function Navbar({ branding }: { branding?: NavBranding | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");
  const [userEmail, setUserEmail] = useState<string | null | undefined>(undefined);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const navLinks = [
    { href: "/leaderboard", label: t("leaderboard"), icon: TrendingUp },
    { href: "/terminal", label: t("terminal"), icon: BarChart2 },
  ];

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user?.email ?? null;
      setUserEmail(email);
      const meta = data.session?.user?.user_metadata;
      setDisplayName(meta?.display_name || meta?.full_name || meta?.username || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
      const meta = session?.user?.user_metadata;
      setDisplayName(meta?.display_name || meta?.full_name || meta?.username || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const shortName = displayName || (userEmail ? userEmail.split("@")[0] : null);
  const initials = shortName ? shortName.slice(0, 2).toUpperCase() : "U";

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
          {branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt={branding.name} className="h-8 w-auto max-w-[160px] object-contain" />
          ) : (
            <>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <TrendingUp className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg tracking-tight">{branding?.name ?? "ArbMind"}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">BETA</Badge>
            </>
          )}
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
              <NotificationCenter />

              <DropdownMenu>
                <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost" }), "flex items-center gap-2 px-2")}>
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:block text-sm max-w-[120px] truncate">{shortName || userEmail}</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">{userEmail}</div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/dashboard")}>{t("dashboard")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/dashboard/accounts")}>{t("accounts")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/dashboard/subscriptions")}>{t("subscriptions")}</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>{t("settings")}</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={handleSignOut}
                    disabled={signingOut}
                  >
                    {signingOut ? t("signOut") + "…" : t("signOut")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/auth/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>{t("signIn")}</Link>
              <Link href="/auth/register" className={cn(buttonVariants({ size: "sm" }))}>Get Started</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

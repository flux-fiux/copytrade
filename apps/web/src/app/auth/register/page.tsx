"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { TrendingUp, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { signUpWithEmail } from "@/lib/auth-actions";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const [role, setRole] = useState<"FOLLOWER" | "MASTER">("FOLLOWER");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    startTransition(async () => {
      const result = await signUpWithEmail(email, password, username, role);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary mb-3">
            <TrendingUp className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold">{t("register_title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">Join 12,400+ traders worldwide</p>
        </div>

        {/* Role selector */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => setRole("FOLLOWER")}
            className={cn(
              "flex flex-col items-center gap-2 p-4 rounded-lg border transition-all text-center",
              role === "FOLLOWER"
                ? "border-primary bg-primary/5 text-foreground"
                : "border-border bg-background text-muted-foreground hover:border-foreground/20"
            )}
          >
            <Users className="h-5 w-5" />
            <div>
              <div className="text-xs font-semibold">{t("register_role_follower")}</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setRole("MASTER")}
            className={cn(
              "flex flex-col items-center gap-2 p-4 rounded-lg border transition-all text-center",
              role === "MASTER"
                ? "border-primary bg-primary/5 text-foreground"
                : "border-border bg-background text-muted-foreground hover:border-foreground/20"
            )}
          >
            <TrendingUp className="h-5 w-5" />
            <div>
              <div className="text-xs font-semibold">{t("register_role_master")}</div>
            </div>
          </button>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1.5">{t("register_username")}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="tradername"
              required
              minLength={3}
              maxLength={30}
              pattern="^[a-zA-Z0-9_\-]+$"
              title="3–30 characters: letters, numbers, _ or -"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Letters, numbers, _ or - only</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">{t("login_email")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">{t("login_password")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">{t("register_confirm_password")}</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors"
            />
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer mt-2">
            <input type="checkbox" required className="mt-0.5 rounded border-border" />
            <span className="text-xs text-muted-foreground leading-relaxed">
              I agree to the{" "}
              <Link href="/terms" className="text-foreground hover:underline">Terms of Service</Link>
              {" "}and{" "}
              <Link href="/privacy" className="text-foreground hover:underline">Privacy Policy</Link>
            </span>
          </label>

          <button
            type="submit"
            disabled={isPending}
            className={cn(buttonVariants(), "w-full disabled:opacity-60")}
          >
            {isPending ? `${t("register_submit")}…` : t("register_submit")}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-foreground font-medium hover:underline">
            {t("login_submit")}
          </Link>
        </p>
      </div>
    </div>
  );
}

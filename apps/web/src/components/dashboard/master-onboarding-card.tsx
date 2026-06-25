"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckCircle2, Circle, ChevronRight, X, Loader2, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Step {
  id: string;
  label: string;
  done: boolean;
  href: string | null;
  action: string | null;
}

interface OnboardingStatus {
  is_master: boolean;
  kyc_status?: string;
  completed: number;
  total: number;
  steps: Step[];
}

export function MasterOnboardingCard() {
  const t = useTranslations("dashboard");
  const [status, setStatus]     = useState<OnboardingStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/v1/users/me/onboarding-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setStatus(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStripeConnect = async () => {
    setConnecting(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/v1/subscriptions/connect/onboard`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      }
    } catch { /* silent */ }
    finally { setConnecting(false); }
  };

  if (
    !status ||
    !status.is_master ||
    status.kyc_status !== "VERIFIED" ||
    status.completed === status.total ||
    dismissed
  ) {
    return null;
  }

  const pct = Math.round((status.completed / status.total) * 100);

  return (
    <Card className="border-blue-500/30 bg-blue-500/5 mb-6">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold">{t("onboarding_title")}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("onboarding_steps", { completed: status.completed, total: status.total })}
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-muted-foreground hover:text-foreground transition-colors ml-4 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-muted/50 mb-4 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="space-y-2">
          {status.steps.map((step) => (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                step.done
                  ? "opacity-50"
                  : "bg-muted/30 hover:bg-muted/50 cursor-pointer"
              )}
            >
              {step.done ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}

              <span className={cn("text-sm flex-1", step.done && "line-through text-muted-foreground")}>
                {step.label}
              </span>

              {!step.done && (
                <>
                  {step.action === "connect_stripe" ? (
                    <button
                      onClick={handleStripeConnect}
                      disabled={connecting}
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 shrink-0"
                    >
                      {connecting
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <ExternalLink className="h-3.5 w-3.5" />
                      }
                      {t("onboarding_setup")}
                    </button>
                  ) : step.href ? (
                    <Link
                      href={step.href}
                      className="flex items-center gap-0.5 text-xs text-blue-400 hover:text-blue-300 shrink-0"
                    >
                      {t("onboarding_go")} <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

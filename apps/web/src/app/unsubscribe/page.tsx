"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { CheckCircle, Loader2, MailX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function UnsubscribeContent() {
  const t = useTranslations("unsubscribe");
  const params = useSearchParams();
  const token  = params.get("token");
  const email  = params.get("email");

  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  useEffect(() => {
    if (!token && !email) return;
    setStatus("loading");
    fetch(`${API_BASE}/api/v1/users/unsubscribe-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, email }),
    })
      .then(r => setStatus(r.ok ? "done" : "error"))
      .catch(() => setStatus("error"));
  }, [token, email]);

  return (
    <Card className="w-full max-w-md border-border/60">
      <CardContent className="p-8 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{t("processing")}</p>
          </>
        )}

        {status === "done" && (
          <>
            <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">{t("done_title")}</h1>
            <p className="text-sm text-muted-foreground mb-6">
              {t("done_desc")}
            </p>
            <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              {t("back_home")}
            </Link>
          </>
        )}

        {(status === "idle" || status === "error") && (
          <>
            <MailX className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">{t("title")}</h1>
            {status === "error" ? (
              <p className="text-sm text-red-400 mb-4">{t("error")}</p>
            ) : (
              <p className="text-sm text-muted-foreground mb-6">
                {email ? t("prompt", { email }) : t("invalid")}
              </p>
            )}
            {email && (
              <button
                onClick={() => setStatus("loading")}
                className={cn(buttonVariants({ variant: "destructive", size: "sm" }))}
              >
                {t("button", { email })}
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Suspense fallback={
        <Card className="w-full max-w-md border-border/60">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          </CardContent>
        </Card>
      }>
        <UnsubscribeContent />
      </Suspense>
    </div>
  );
}

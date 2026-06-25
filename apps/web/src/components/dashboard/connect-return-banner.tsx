"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

function ConnectReturnBannerInner() {
  const t = useTranslations("dashboard");
  const params = useSearchParams();
  const router = useRouter();
  const connect = params.get("connect");
  const [visible, setVisible] = useState(!!connect);

  useEffect(() => {
    if (!connect) return;
    // Strip query param from URL without re-render
    const url = new URL(window.location.href);
    url.searchParams.delete("connect");
    router.replace(url.pathname + (url.search || ""), { scroll: false });
  }, [connect, router]);

  if (!visible || !connect) return null;

  const isSuccess = connect === "success";

  return (
    <div
      className={`flex items-start gap-3 rounded-lg px-4 py-3 mb-6 border text-sm ${
        isSuccess
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
          : "bg-amber-500/10 border-amber-500/30 text-amber-300"
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
      )}
      <p className="flex-1">
        {isSuccess ? t("connect_success") : t("connect_expired")}
      </p>
      <button onClick={() => setVisible(false)} className="opacity-60 hover:opacity-100 transition-opacity">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ConnectReturnBanner() {
  return (
    <Suspense fallback={null}>
      <ConnectReturnBannerInner />
    </Suspense>
  );
}

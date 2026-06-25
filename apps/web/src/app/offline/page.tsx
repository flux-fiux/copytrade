"use client";

import { useTranslations } from "next-intl";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  const t = useTranslations("offline");

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
        <WifiOff className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t("desc")}</p>
      <Button onClick={() => window.location.reload()} variant="outline" size="sm">
        {t("retry")}
      </Button>
    </div>
  );
}

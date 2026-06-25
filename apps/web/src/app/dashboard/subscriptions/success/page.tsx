import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function SubscriptionSuccessPage() {
  const t = await getTranslations("subscriptions_page");
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-2">{t("success_activated")}</h1>
        <p className="text-muted-foreground mb-8">{t("success_desc")}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard/subscriptions"
            className={cn(buttonVariants(), "bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white")}
          >
            {t("success_view_subs")}
          </Link>
          <Link href="/leaderboard" className={cn(buttonVariants({ variant: "outline" }))}>
            {t("success_browse_masters")}
          </Link>
        </div>
      </div>
    </div>
  );
}

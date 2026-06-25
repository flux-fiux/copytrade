import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";

export default async function AuthErrorPage() {
  const t = await getTranslations("auth");
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold mb-2">{t("error_title")}</h1>
        <p className="text-sm text-muted-foreground mb-6">{t("error_desc")}</p>
        <Link href="/auth/login" className={buttonVariants()}>
          {t("error_back")}
        </Link>
      </div>
    </div>
  );
}

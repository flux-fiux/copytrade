import Link from "next/link";
import { TrendingUp, Home, ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6">
        <TrendingUp className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-6xl font-bold text-muted-foreground/30 mb-4">404</h1>
      <h2 className="text-xl font-semibold mb-2">Page not found</h2>
      <p className="text-muted-foreground mb-8 max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="flex items-center gap-3">
        <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
          <Home className="h-4 w-4" /> Home
        </Link>
        <Link href="/leaderboard" className={cn(buttonVariants(), "gap-2")}>
          <ArrowLeft className="h-4 w-4" /> Browse Traders
        </Link>
      </div>
    </div>
  );
}

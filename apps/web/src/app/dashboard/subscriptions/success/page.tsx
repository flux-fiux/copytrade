import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function SubscriptionSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-2">Subscription Activated!</h1>
        <p className="text-muted-foreground mb-8">
          You&apos;re now automatically copying trades from your selected signal provider.
          Trades will appear in your MT4/MT5 account within seconds.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard/subscriptions"
            className={cn(buttonVariants(), "bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white")}
          >
            View My Subscriptions
          </Link>
          <Link href="/leaderboard" className={cn(buttonVariants({ variant: "outline" }))}>
            Browse More Masters
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 mb-6">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
      <p className="text-muted-foreground mb-2 max-w-sm text-sm">
        An unexpected error occurred. If this persists, please contact support.
      </p>
      {error.digest && (
        <p className="text-[11px] text-muted-foreground/50 font-mono mb-8">Error ID: {error.digest}</p>
      )}
      <div className="flex items-center gap-3">
        <button onClick={reset} className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
          <RefreshCcw className="h-4 w-4" /> Try again
        </button>
        <Link href="/" className={cn(buttonVariants(), "gap-2")}>
          <Home className="h-4 w-4" /> Go home
        </Link>
      </div>
    </div>
  );
}

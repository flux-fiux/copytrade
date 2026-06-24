import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold mb-2">Authentication failed</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Something went wrong during sign in. Please try again.
        </p>
        <Link href="/auth/login" className={buttonVariants()}>
          Back to Login
        </Link>
      </div>
    </div>
  );
}

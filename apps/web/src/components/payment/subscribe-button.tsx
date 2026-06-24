"use client";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface Props {
  masterId: string;
  planId: string;
  priceUsd: number;
}

export function SubscribeButton({ masterId, planId, priceUsd }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      if (!token) throw new Error("Please sign in to subscribe");

      const subRes = await fetch(`${apiUrl}/api/v1/subscriptions/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ master_id: masterId, plan_id: planId }),
      });
      if (!subRes.ok) {
        const errBody = await subRes.json().catch(() => ({}));
        const detail = errBody?.detail ?? "Failed to create subscription";
        throw new Error(detail);
      }
      const sub = await subRes.json();

      const payRes = await fetch(`${apiUrl}/api/v1/payments/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ subscription_id: sub.id, currency: "USDT", network: "TRON" }),
      });
      if (!payRes.ok) throw new Error("Failed to create payment");
      const payment = await payRes.json();

      window.location.href = payment.payment_url || "/dashboard/subscriptions?success=1";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleSubscribe}
        disabled={loading}
        className={cn(buttonVariants({ size: "sm" }), "w-full")}
      >
        {loading ? "Processing..." : `Subscribe · $${priceUsd}/mo`}
      </button>
      {error && <p className="text-destructive text-xs mt-2">{error}</p>}
      <p className="text-xs text-muted-foreground mt-2 text-center">
        Pay with USDT (TRC20) · BTC · ETH
      </p>
    </div>
  );
}

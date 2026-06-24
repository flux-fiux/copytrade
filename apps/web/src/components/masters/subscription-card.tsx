"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Shield, Zap, BarChart2 } from "lucide-react";
import { SubscribeButton } from "@/components/payment/subscribe-button";

const features = [
  { icon: Zap, text: "Real-time trade signals" },
  { icon: Shield, text: "Auto risk guard (8.2% max DD)" },
  { icon: BarChart2, text: "Custom lot multiplier" },
  { icon: Check, text: "Instant MT4/MT5 copy" },
  { icon: Check, text: "Email & push notifications" },
  { icon: Check, text: "Monthly performance reports" },
];

interface Plan {
  id: string;
  price_usd: number;
  performance_fee_pct: number;
  features: string[];
}

interface Props {
  masterId: string;
}

export function SubscriptionCard({ masterId }: Props) {
  const [plan, setPlan] = useState<Plan | null>(null);

  useEffect(() => {
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/subscriptions/plans/${masterId}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setPlan(data[0]);
      })
      .catch(() => {});
  }, [masterId]);

  const priceUsd = plan?.price_usd ?? 49;
  const perfFee = plan?.performance_fee_pct ?? 20;
  const planId = plan?.id ?? "default";

  return (
    <Card className="border-border/60 sticky top-24">
      <CardContent className="p-5">
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-3xl font-bold">${priceUsd}</span>
          <span className="text-muted-foreground">/month</span>
        </div>
        <p className="text-xs text-muted-foreground mb-1">
          + {perfFee}% performance fee on profits
        </p>
        <Badge
          variant="outline"
          className="text-[10px] mb-4 border-emerald-500/40 text-emerald-400"
        >
          High Water Mark billing
        </Badge>

        <div className="mb-4">
          <SubscribeButton masterId={masterId} planId={planId} priceUsd={priceUsd} />
        </div>

        <p className="text-[11px] text-muted-foreground text-center mb-5">
          Cancel anytime · No lock-in · 7-day free trial
        </p>

        <div className="space-y-2.5">
          {features.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2.5 text-sm">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 shrink-0">
                <Icon className="h-3 w-3 text-emerald-400" />
              </div>
              <span className="text-muted-foreground">{text}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-border/50 text-[11px] text-muted-foreground text-center">
          Protected by MetaAPI · Trades verified independently
        </div>
      </CardContent>
    </Card>
  );
}

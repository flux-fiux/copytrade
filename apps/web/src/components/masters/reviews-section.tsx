"use client";

import { useCallback, useEffect, useState } from "react";
import { Star, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Review {
  id: string;
  reviewer: string;
  rating: number;
  comment: string | null;
  created_at: string | null;
}
interface ReviewData {
  average: number | null;
  count: number;
  reviews: Review[];
}

function Stars({ value, onChange, large = false }: { value: number; onChange?: (n: number) => void; large?: boolean }) {
  const sz = large ? "h-5 w-5" : "h-4 w-4";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={cn(onChange ? "cursor-pointer hover:scale-110 transition-transform" : "cursor-default")}
        >
          <Star className={cn(sz, n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
        </button>
      ))}
    </div>
  );
}

export function ReviewsSection({ masterId }: { masterId: string }) {
  const t = useTranslations("reviews");
  const [data, setData] = useState<ReviewData | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/masters/${masterId}/reviews`);
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
  }, [masterId]);

  useEffect(() => {
    load();
    createClient().auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null);
      setUid(data.session?.user?.id ?? null);
    });
  }, [load]);

  const submit = async () => {
    if (!token || rating < 1) return;
    setBusy(true);
    try {
      await fetch(`${API_BASE}/api/v1/masters/${masterId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating, comment: comment || null }),
      });
      setComment("");
      setRating(0);
      await load();
    } catch { /* ignore */ }
    finally { setBusy(false); }
  };

  const removeMine = async () => {
    if (!token) return;
    setBusy(true);
    try {
      await fetch(`${API_BASE}/api/v1/masters/${masterId}/reviews`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await load();
    } catch { /* ignore */ }
    finally { setBusy(false); }
  };

  const isSelf = uid != null && uid === masterId;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2"><Star className="h-4 w-4" />{t("title")}</span>
          {data && data.average != null && (
            <span className="flex items-center gap-2 text-muted-foreground font-normal">
              <Stars value={Math.round(data.average)} />
              <span className="font-mono text-foreground">{data.average.toFixed(1)}</span>
              <span className="text-xs">· {t("count", { count: data.count })}</span>
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Write form */}
        {!token ? (
          <p className="text-sm text-muted-foreground">{t("login_to_review")}</p>
        ) : isSelf ? (
          <p className="text-sm text-muted-foreground">{t("self_note")}</p>
        ) : (
          <div className="rounded-lg border border-border/60 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{t("your_rating")}</span>
              <Stars value={rating} onChange={setRating} large />
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("comment_placeholder")}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={submit} disabled={busy || rating < 1}>{t("submit")}</Button>
              <Button size="sm" variant="ghost" onClick={removeMine} disabled={busy} className="text-red-400 hover:text-red-300">
                <Trash2 className="h-3.5 w-3.5 mr-1" />{t("delete")}
              </Button>
            </div>
          </div>
        )}

        {/* List */}
        {!data || data.reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">{t("no_reviews")}</p>
        ) : (
          <div className="divide-y divide-border/40">
            {data.reviews.map((r) => (
              <div key={r.id} className="py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{r.reviewer}</span>
                  <Stars value={r.rating} />
                </div>
                {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

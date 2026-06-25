"use client";

import { useCallback, useEffect, useState } from "react";
import { Megaphone, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Announcement {
  id: string;
  title: string;
  body: string | null;
  created_at: string | null;
}

export function AnnouncementsSection({ masterId }: { masterId: string }) {
  const t = useTranslations("announcements");
  const [items, setItems] = useState<Announcement[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/masters/${masterId}/announcements`);
      if (res.ok) setItems(await res.json());
    } catch { /* ignore */ }
  }, [masterId]);

  useEffect(() => {
    load();
    createClient().auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null);
      setUid(data.session?.user?.id ?? null);
    });
  }, [load]);

  const isOwner = uid != null && uid === masterId;

  const post = async () => {
    if (!token || !title.trim()) return;
    setBusy(true);
    try {
      await fetch(`${API_BASE}/api/v1/masters/${masterId}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, body: body || null }),
      });
      setTitle(""); setBody("");
      await load();
    } catch { /* ignore */ }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!token) return;
    try {
      await fetch(`${API_BASE}/api/v1/masters/${masterId}/announcements/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await load();
    } catch { /* ignore */ }
  };

  // Hide the whole card when there's nothing to show and the viewer can't post.
  if (items.length === 0 && !isOwner) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Megaphone className="h-4 w-4" />{t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isOwner && (
          <div className="rounded-lg border border-border/60 p-3 space-y-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("new_title_ph")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("new_body_ph")}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            />
            <Button size="sm" onClick={post} disabled={busy || !title.trim()}>{t("post")}</Button>
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">{t("none")}</p>
        ) : (
          <div className="space-y-3">
            {items.map((a) => (
              <div key={a.id} className="rounded-lg border border-border/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-sm">{a.title}</span>
                  {isOwner && (
                    <button onClick={() => remove(a.id)} className="text-red-400 hover:text-red-300 shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {a.body && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.body}</p>}
                {a.created_at && (
                  <p className="text-[10px] text-muted-foreground mt-1.5">{new Date(a.created_at).toLocaleString()}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

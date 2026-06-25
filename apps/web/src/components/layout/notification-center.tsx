"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Bell, X, Check, TrendingDown, Zap, Award, Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { connectSocket } from "@/lib/socket";
import {
  AppNotification,
  setNotifications,
  pushLocalNotification,
  markAllRead,
  removeNotification,
  clearAllNotifications,
  subscribeNotif,
  subscribeNotifList,
} from "@/store/notifications";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const TYPE_ICON: Record<string, React.ElementType> = {
  COPYTRADE:    Zap,
  DRAWDOWN:     TrendingDown,
  SUBSCRIPTION: Info,
  MASTER_STATUS: Award,
  FOLLOWER:     Info,
  SYSTEM:       Info,
};

const TYPE_COLOR: Record<string, string> = {
  COPYTRADE:    "text-emerald-400 bg-emerald-400/10",
  DRAWDOWN:     "text-red-400 bg-red-400/10",
  SUBSCRIPTION: "text-blue-400 bg-blue-400/10",
  MASTER_STATUS: "text-yellow-400 bg-yellow-400/10",
  FOLLOWER:     "text-purple-400 bg-purple-400/10",
  SYSTEM:       "text-muted-foreground bg-muted/40",
};

function useTimeAgo() {
  const t = useTranslations("notifications");
  return (iso: string): string => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return t("just_now");
    if (diff < 3600) return t("minutes_ago", { n: Math.floor(diff / 60) });
    if (diff < 86400) return t("hours_ago", { n: Math.floor(diff / 3600) });
    return t("days_ago", { n: Math.floor(diff / 86400) });
  };
}

export function NotificationCenter() {
  const t = useTranslations("notifications");
  const timeAgo = useTimeAgo();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => subscribeNotif(setCount), []);
  useEffect(() => subscribeNotifList(setItems), []);

  // Fetch persisted notifications from API on mount
  const loadFromApi = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      setLoading(true);
      const res = await fetch(`${API_URL}/api/v1/notifications/`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const data: AppNotification[] = await res.json();
      setNotifications(data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFromApi(); }, [loadFromApi]);

  // Wire WebSocket copytrade + signal events → local notifications
  useEffect(() => {
    const sock = connectSocket();

    const onCopytrade = (data: Record<string, unknown>) => {
      const sym = String(data.symbol ?? "");
      const dir = String(data.direction ?? "");
      const pnl = typeof data.profit === "number" ? data.profit : null;
      pushLocalNotification(
        "COPYTRADE",
        `Trade copied${sym ? ` — ${dir} ${sym}` : ""}`,
        pnl !== null ? `P&L: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}` : undefined,
        data as Record<string, unknown>,
      );
    };

    const onSignal = (data: Record<string, unknown>) => {
      const sym = String(data.symbol ?? "");
      const dir = String(data.direction ?? "");
      pushLocalNotification(
        "COPYTRADE",
        `New signal: ${dir} ${sym}`,
        undefined,
        data as Record<string, unknown>,
      );
    };

    sock.on("copytrade", onCopytrade);
    sock.on("signal", onSignal);
    return () => {
      sock.off("copytrade", onCopytrade);
      sock.off("signal", onSignal);
    };
  }, []);

  const handleMarkAllRead = async () => {
    markAllRead();
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await fetch(`${API_URL}/api/v1/notifications/read-all`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      }
    } catch { /* ignore */ }
  };

  const handleClearAll = async () => {
    clearAllNotifications();
    setOpen(false);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await fetch(`${API_URL}/api/v1/notifications/`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      }
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string, isLocal: boolean) => {
    removeNotification(id);
    if (!isLocal) {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await fetch(`${API_URL}/api/v1/notifications/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
        }
      } catch { /* ignore */ }
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent transition-colors cursor-pointer" title={t("title")}>
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground leading-none">
              {count > 99 ? "99" : count}
            </span>
          )}
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 shadow-xl" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <span className="text-sm font-semibold">{t("title")}</span>
          {count > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Check className="h-3 w-3" /> {t("mark_all_read")}
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[420px] overflow-y-auto divide-y divide-border/40">
          {loading && items.length === 0 && (
            <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
              {t("loading")}
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <Bell className="h-8 w-8 opacity-20" />
              <span className="text-xs">{t("empty")}</span>
            </div>
          )}
          {items.map((n) => {
            const Icon = TYPE_ICON[n.type] ?? Info;
            const colorCls = TYPE_COLOR[n.type] ?? TYPE_COLOR.SYSTEM;
            return (
              <div
                key={n.id}
                className={cn(
                  "flex gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group",
                  !n.read && "bg-primary/5"
                )}
              >
                <div className={cn("flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center mt-0.5", colorCls)}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn("text-xs font-medium leading-snug", !n.read && "text-foreground")}>
                    {n.title}
                  </div>
                  {n.body && (
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                      {n.body}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground/60 mt-1">
                    {timeAgo(n.created_at)}
                    {n.local && <span className="ml-1 opacity-50">· {t("session")}</span>}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(n.id, n.local ?? false)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>

        {items.length > 0 && (
          <div className="border-t border-border/50 px-4 py-2">
            <button
              onClick={handleClearAll}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center"
            >
              {t("clear_all")}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

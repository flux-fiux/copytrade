"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw, X, ServerCrash, Wifi, WifiOff, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/lib/api";
import type { MT4AccountData } from "@/lib/api-client";
import { toast } from "sonner";
import { ConnectAccountForm } from "@/components/dashboard/connect-account-form";


const STATUS_COLORS: Record<string, { color: string; Icon: typeof Wifi }> = {
  CONNECTED: { color: "text-emerald-400 border-emerald-500/30", Icon: Wifi },
  DISCONNECTED: { color: "text-red-400 border-red-500/30", Icon: WifiOff },
  CONNECTING: { color: "text-yellow-400 border-yellow-500/30", Icon: Loader2 },
};

export default function AccountsPage() {
  const t = useTranslations("accounts");
  const [accounts, setAccounts] = useState<MT4AccountData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formToken, setFormToken] = useState("");
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const getToken = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }, []);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.mt4Accounts.list();
      setAccounts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
      // 生产环境不降级显示假数据，只展示错误状态
      if (process.env.NODE_ENV === "development") {
        setAccounts([{
          id: "demo-1", broker_name: "IC Markets (demo)", login: "584291",
          server: "ICMarketsLive01", account_type: "FOLLOWER", platform: "MT4",
          connection_status: "CONNECTED", balance: 11640, equity: 12480.20,
          currency: "USD", created_at: new Date().toISOString(),
        }]);
      }
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      const updated = await api.mt4Accounts.sync(id);
      setAccounts(prev => prev.map(a => a.id === id ? updated : a));
    } catch {
      toast.error(t("sync_failed"));
    } finally {
      setSyncingId(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm(t("disconnect_confirm"))) return;
    try {
      await api.mt4Accounts.disconnect(id);
      setAccounts(prev => prev.filter(a => a.id !== id));
    } catch {
      toast.error(t("action_failed"));
    }
  };

  const handleShowForm = async () => {
    const token = await getToken();
    setFormToken(token);
    setShowForm(true);
  };

  return (
    <div className="px-6 py-6">
      <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">{t("title")}</h1>
              <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
            </div>
            <button className={cn(buttonVariants({ size: "sm" }), "gap-2")} onClick={handleShowForm}>
              {t("connect_btn")}
            </button>
          </div>

          {error && (
            <div className="mb-4 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 rounded-lg">
              {t("demo_banner")} {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> {t("loading")}
            </div>
          ) : accounts.length === 0 ? (
            <Card className="border-border/60 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <ServerCrash className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold mb-1">{t("empty_title")}</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                  {t("empty_desc")}
                </p>
                <button className={cn(buttonVariants(), "gap-2")} onClick={handleShowForm}>
                  {t("empty_btn")}
                </button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {accounts.map(account => {
                const statusKey = account.connection_status in STATUS_COLORS ? account.connection_status : "DISCONNECTED";
                const status = STATUS_COLORS[statusKey];
                const StatusIcon = status.Icon;
                const statusLabel = statusKey === "CONNECTED" ? t("status_connected") : statusKey === "CONNECTING" ? t("status_connecting") : t("status_disconnected");
                return (
                  <Card key={account.id} className="border-border/60">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                            <StatusIcon className={cn("h-5 w-5", status.color.split(" ")[0])} />
                          </div>
                          <div>
                            <div className="font-semibold">{account.broker_name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Login #{account.login} · {account.server} · {account.platform}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn("text-[10px]", status.color)}>
                            <span className={cn("h-1.5 w-1.5 rounded-full mr-1.5 inline-block bg-current")} />
                            {statusLabel}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">{account.account_type}</Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border/50">
                        <div>
                          <div className="text-xs text-muted-foreground">{t("equity")}</div>
                          <div className="font-semibold text-sm mt-0.5">
                            {account.equity != null ? `$${account.equity.toLocaleString()}` : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">{t("balance")}</div>
                          <div className="font-semibold text-sm mt-0.5">
                            {account.balance != null ? `$${account.balance.toLocaleString()}` : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">{t("connected_on")}</div>
                          <div className="font-semibold text-sm mt-0.5">
                            {new Date(account.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => handleSync(account.id)}
                          disabled={syncingId === account.id}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
                        >
                          <RefreshCw className={cn("h-3.5 w-3.5", syncingId === account.id && "animate-spin")} />
                          {t("sync_btn")}
                        </button>
                        <button
                          onClick={() => handleDisconnect(account.id)}
                          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-destructive hover:text-destructive gap-1.5")}
                        >
                          <X className="h-3.5 w-3.5" /> {t("disconnect_btn")}
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

      {showForm && (
        <ConnectAccountForm
          token={formToken}
          onSuccess={async () => { setShowForm(false); await fetchAccounts(); }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}


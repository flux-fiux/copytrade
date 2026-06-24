"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  LayoutDashboard, Cpu, BookOpen, Radio, DollarSign, Settings,
  RefreshCw, X, ServerCrash, Wifi, WifiOff, Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { api, type MT4AccountData } from "@/lib/api-client";
import { ConnectAccountForm } from "@/components/dashboard/connect-account-form";

const sidebarLinks = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/accounts", label: "My Accounts", icon: Cpu },
  { href: "/dashboard/subscriptions", label: "Subscriptions", icon: BookOpen },
  { href: "/dashboard/signals", label: "Signals", icon: Radio },
  { href: "/dashboard/earnings", label: "Earnings", icon: DollarSign },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 border-r border-border/50 shrink-0 flex flex-col">
      <div className="px-4 py-4 border-b border-border/50">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dashboard</div>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {sidebarLinks.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href) && pathname !== "/dashboard";
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

const statusConfig: Record<string, { label: string; color: string; Icon: typeof Wifi }> = {
  CONNECTED: { label: "Connected", color: "text-emerald-400 border-emerald-500/30", Icon: Wifi },
  DISCONNECTED: { label: "Disconnected", color: "text-red-400 border-red-500/30", Icon: WifiOff },
  CONNECTING: { label: "Connecting", color: "text-yellow-400 border-yellow-500/30", Icon: Loader2 },
};

export default function AccountsPage() {
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
      const token = await getToken();
      const data = await api.mt4Accounts.list(token);
      setAccounts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
      // Show demo data in dev when API is unavailable
      setAccounts([{
        id: "demo-1", broker_name: "IC Markets (demo)", login: "584291",
        server: "ICMarketsLive01", account_type: "FOLLOWER", platform: "MT4",
        connection_status: "CONNECTED", balance: 11640, equity: 12480.20,
        currency: "USD", created_at: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      const token = await getToken();
      const updated = await api.mt4Accounts.sync(token, id);
      setAccounts(prev => prev.map(a => a.id === id ? updated : a));
    } catch {
      // silent — account might be mocked in dev
    } finally {
      setSyncingId(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm("Disconnect this account? Active copy trades will be paused.")) return;
    try {
      const token = await getToken();
      await api.mt4Accounts.disconnect(token, id);
      setAccounts(prev => prev.filter(a => a.id !== id));
    } catch {
      // silent
    }
  };

  const handleShowForm = async () => {
    const token = await getToken();
    setFormToken(token);
    setShowForm(true);
  };

  return (
    <div className="flex h-[calc(100vh-64px)]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">My MT4/MT5 Accounts</h1>
              <p className="text-sm text-muted-foreground mt-1">Manage your connected trading accounts</p>
            </div>
            <button className={cn(buttonVariants({ size: "sm" }), "gap-2")} onClick={handleShowForm}>
              Connect Account
            </button>
          </div>

          {error && (
            <div className="mb-4 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 rounded-lg">
              API unavailable — showing demo data. {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading accounts…
            </div>
          ) : accounts.length === 0 ? (
            <Card className="border-border/60 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <ServerCrash className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold mb-1">No accounts connected</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                  Connect your MT4 or MT5 account to start copying trades.
                </p>
                <button className={cn(buttonVariants(), "gap-2")} onClick={handleShowForm}>
                  Connect your first MT4 account
                </button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {accounts.map(account => {
                const status = statusConfig[account.connection_status] ?? statusConfig.DISCONNECTED;
                const StatusIcon = status.Icon;
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
                            {status.label}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">{account.account_type}</Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border/50">
                        <div>
                          <div className="text-xs text-muted-foreground">Equity</div>
                          <div className="font-semibold text-sm mt-0.5">
                            {account.equity != null ? `$${account.equity.toLocaleString()}` : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Balance</div>
                          <div className="font-semibold text-sm mt-0.5">
                            {account.balance != null ? `$${account.balance.toLocaleString()}` : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Connected</div>
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
                          Sync
                        </button>
                        <button
                          onClick={() => handleDisconnect(account.id)}
                          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-destructive hover:text-destructive gap-1.5")}
                        >
                          <X className="h-3.5 w-3.5" /> Disconnect
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

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

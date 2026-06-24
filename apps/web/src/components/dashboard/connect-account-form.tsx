"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api, type ConnectAccountPayload } from "@/lib/api-client";

interface Props {
  token: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const defaultForm: ConnectAccountPayload = {
  broker_name: "",
  login: "",
  password: "",
  server: "",
  account_type: "FOLLOWER",
  platform: "MT4",
};

export function ConnectAccountForm({ token, onSuccess, onCancel }: Props) {
  const [form, setForm] = useState<ConnectAccountPayload>(defaultForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.mt4Accounts.connect(token, form);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-background border border-border rounded-xl p-6 mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold">Connect MT4/MT5 Account</h2>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1.5">Broker Name</label>
            <input
              required
              type="text"
              placeholder="e.g. IC Markets"
              value={form.broker_name}
              onChange={e => setForm(f => ({ ...f, broker_name: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">MT4/MT5 Login</label>
            <input
              required
              type="text"
              placeholder="e.g. 584291"
              value={form.login}
              onChange={e => setForm(f => ({ ...f, login: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Server</label>
            <input
              required
              type="text"
              placeholder="e.g. ICMarketsLive01"
              value={form.server}
              onChange={e => setForm(f => ({ ...f, server: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <input
              required
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Encrypted with AES-256. Never stored in plaintext.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Account Type</label>
            <div className="flex gap-2">
              {(["FOLLOWER", "MASTER"] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, account_type: type }))}
                  className={cn(
                    "flex-1 py-2 text-sm font-medium rounded-lg border transition-colors",
                    form.account_type === type
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-foreground/30"
                  )}
                >
                  {type === "FOLLOWER" ? "Follower" : "Signal Provider"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Platform</label>
            <div className="flex gap-2">
              {(["MT4", "MT5"] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, platform: p }))}
                  className={cn(
                    "flex-1 py-2 text-sm font-medium rounded-lg border transition-colors",
                    form.platform === p
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-foreground/30"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className={cn(buttonVariants(), "flex-1", loading && "opacity-60 cursor-not-allowed")}
            >
              {loading ? "Connecting…" : "Connect Account"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

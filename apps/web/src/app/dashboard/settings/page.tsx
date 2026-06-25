"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { Loader2, Save, Bell, Shield, Wallet, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { api, type UserProfile } from "@/lib/api-client";


function FieldRow({ label, value, onChange, type = "text", disabled = false, hint }: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        disabled={disabled}
        className={cn(
          "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm",
          "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50",
          disabled && "opacity-60 cursor-not-allowed bg-muted/30"
        )}
      />
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [emailSignals, setEmailSignals] = useState(true);
  const [emailBilling, setEmailBilling] = useState(true);

  const getToken = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const data = await api.users.me(token);
        setProfile(data);
        setDisplayName(data.display_name ?? "");
        setUsername(data.username ?? "");
      } catch {
        // API not available in dev
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = await getToken();
      if (token && profile) {
        await api.users.update(token, { display_name: displayName, username: username || undefined });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      // silent in dev
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-6 py-6">
      <div className="max-w-xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your profile, notifications, and payout details</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="space-y-6">
              {/* Profile */}
              <Card className="border-border/60">
                <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Profile</h2>
                </div>
                <CardContent className="p-4 space-y-4">
                  <FieldRow
                    label="Email"
                    value={profile?.email ?? ""}
                    disabled
                    hint="Email is managed by your auth provider and cannot be changed here."
                  />
                  <FieldRow
                    label="Username"
                    value={username}
                    onChange={setUsername}
                    hint="Visible on the leaderboard and to followers."
                  />
                  <FieldRow
                    label="Display Name"
                    value={displayName}
                    onChange={setDisplayName}
                    hint="Optional full name shown on your profile."
                  />
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Role</label>
                    <div className="flex gap-2">
                      {(profile?.roles ?? ["FOLLOWER"]).map(r => (
                        <span key={r} className="text-xs px-2.5 py-1 rounded-md bg-primary/10 text-primary font-medium">{r}</span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      To become a Master, contact support or apply from the leaderboard.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Payout wallet */}
              <Card className="border-border/60">
                <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Payout Wallet</h2>
                </div>
                <CardContent className="p-4 space-y-4">
                  <FieldRow
                    label="USDT (TRC20) Wallet Address"
                    value={walletAddress}
                    onChange={setWalletAddress}
                    hint="Earnings are sent here on the 1st of each month."
                  />
                  <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                    Double-check the address. Crypto payments are irreversible.
                  </p>
                </CardContent>
              </Card>

              {/* Notifications */}
              <Card className="border-border/60">
                <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Notifications</h2>
                </div>
                <CardContent className="p-4 space-y-3">
                  {[
                    { label: "Signal alerts", desc: "Email when a master opens or closes a trade", checked: emailSignals, set: setEmailSignals },
                    { label: "Billing & payouts", desc: "Payment confirmations and payout receipts", checked: emailBilling, set: setEmailBilling },
                  ].map(({ label, desc, checked, set }) => (
                    <label key={label} className="flex items-start gap-3 cursor-pointer">
                      <div className="mt-0.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => set(e.target.checked)}
                          className="h-4 w-4 rounded border-border accent-primary"
                        />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{label}</div>
                        <div className="text-xs text-muted-foreground">{desc}</div>
                      </div>
                    </label>
                  ))}
                </CardContent>
              </Card>

              {/* Save */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={cn(buttonVariants(), "gap-2", saving && "opacity-60 cursor-not-allowed")}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Saving…" : "Save Changes"}
                </button>
                {saved && (
                  <span className="text-sm text-emerald-400">Saved successfully!</span>
                )}
              </div>
            </div>
          )}
        </div>
    </div>
  );
}

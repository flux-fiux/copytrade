"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("settings");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [strategy, setStrategy] = useState("");
  const [emailSignals, setEmailSignals] = useState(true);
  const [emailBilling, setEmailBilling] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

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
        setWalletAddress(data.wallet_address ?? "");
        setStrategy((data as unknown as Record<string, string>).apply_strategy ?? "");
        setEmailSignals(data.email_notify_signals ?? true);
        setEmailBilling(data.email_notify_billing ?? true);
      } catch {
        // API not available in dev
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      await api.users.update(token, {
        display_name: displayName || undefined,
        username: username || undefined,
        wallet_address: walletAddress || undefined,
        email_notify_signals: emailSignals,
        email_notify_billing: emailBilling,
        ...(strategy !== undefined ? { apply_strategy: strategy || undefined } : {}),
      } as Parameters<typeof api.users.update>[1]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-6 py-6">
      <div className="max-w-xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
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
                  <h2 className="text-sm font-semibold">{t("profile_section")}</h2>
                </div>
                <CardContent className="p-4 space-y-4">
                  <FieldRow
                    label={t("email")}
                    value={profile?.email ?? ""}
                    disabled
                    hint={t("email_hint")}
                  />
                  <FieldRow
                    label={t("username")}
                    value={username}
                    onChange={setUsername}
                    hint={t("username_hint")}
                  />
                  <FieldRow
                    label={t("display_name")}
                    value={displayName}
                    onChange={setDisplayName}
                    hint={t("display_name_hint")}
                  />
                  {(profile?.roles ?? []).includes("MASTER") && (
                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        {t("strategy_label")}
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">{t("strategy_hint_label")}</span>
                      </label>
                      <textarea
                        value={strategy}
                        onChange={e => setStrategy(e.target.value)}
                        maxLength={200}
                        rows={3}
                        placeholder={t("strategy_placeholder")}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
                      />
                      <p className="text-xs text-muted-foreground mt-1">{t("strategy_char_limit", { count: strategy.length })}</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium mb-1.5">{t("role")}</label>
                    <div className="flex gap-2">
                      {(profile?.roles ?? ["FOLLOWER"]).map(r => (
                        <span key={r} className="text-xs px-2.5 py-1 rounded-md bg-primary/10 text-primary font-medium">{r}</span>
                      ))}
                    </div>
                    {!(profile?.roles ?? []).includes("MASTER") && (
                      <Link
                        href="/dashboard/apply-master"
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2 gap-1.5 text-xs")}
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" /> {t("apply_master")}
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Payout wallet */}
              <Card className="border-border/60">
                <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">{t("payout_wallet")}</h2>
                </div>
                <CardContent className="p-4 space-y-4">
                  <FieldRow
                    label={t("wallet_address")}
                    value={walletAddress}
                    onChange={setWalletAddress}
                    hint={t("wallet_hint")}
                  />
                  <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                    {t("wallet_warning")}
                  </p>
                </CardContent>
              </Card>

              {/* Notifications */}
              <Card className="border-border/60">
                <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">{t("notifications_section")}</h2>
                </div>
                <CardContent className="p-4 space-y-3">
                  {[
                    { label: t("notif_signals"), desc: t("notif_signals_desc"), checked: emailSignals, set: setEmailSignals },
                    { label: t("notif_billing"), desc: t("notif_billing_desc"), checked: emailBilling, set: setEmailBilling },
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
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className={cn(buttonVariants(), "gap-2", saving && "opacity-60 cursor-not-allowed")}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? t("saving") : t("save_changes")}
                  </button>
                  {saved && (
                    <span className="text-sm text-emerald-400">{t("saved")}</span>
                  )}
                </div>
                {saveError && (
                  <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{saveError}</p>
                )}
              </div>
            </div>
          )}
        </div>
    </div>
  );
}

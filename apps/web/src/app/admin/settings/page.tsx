"use client";

import { useEffect, useState } from "react";
import { Save, Shield, DollarSign, Bell, Globe, Palette } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PlatformSettings {
  platform_commission_rate: number;
  require_kyc_for_master: boolean;
  auto_approve_masters: boolean;
  max_followers_per_master: number;
  maintenance_mode: boolean;
  allowed_countries: string;
}

const DEFAULTS: PlatformSettings = {
  platform_commission_rate: 20,
  require_kyc_for_master: true,
  auto_approve_masters: false,
  max_followers_per_master: 500,
  maintenance_mode: false,
  allowed_countries: "All",
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [branding, setBranding] = useState({ name: "", primary_color: "#6366f1", logo_url: "", favicon_url: "" });
  const [brandSaved, setBrandSaved] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      try {
        const res = await fetch(`${API_BASE}/api/v1/admin/platform-settings`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) setSettings(await res.json());
      } catch { /* use defaults */ }
    });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      try {
        const res = await fetch(`${API_BASE}/api/v1/tenants/current`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const d = await res.json();
          setBranding({
            name: d.name ?? "",
            primary_color: d.primary_color ?? "#6366f1",
            logo_url: d.logo_url ?? "",
            favicon_url: d.favicon_url ?? "",
          });
        }
      } catch { /* use defaults */ }
    });
  }, []);

  const saveBranding = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      await fetch(`${API_BASE}/api/v1/tenants/current/branding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(branding),
      });
      setBrandSaved(true);
      setTimeout(() => setBrandSaved(false), 2000);
    } catch { /* non-fatal in dev */ }
  };

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      try {
        await fetch(`${API_BASE}/api/v1/admin/platform-settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify(settings),
        });
      } catch { /* non-fatal in dev */ }
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const update = (key: keyof PlatformSettings, value: string | number | boolean) =>
    setSettings(prev => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Platform Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Global configuration for the CopyTrade platform</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saved ? "Saved!" : saving ? "Saving…" : "Save Changes"}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Revenue Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4" />
              Revenue & Commission
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1">Platform Commission Rate (%)</label>
              <input
                type="number"
                min={0} max={50} step={1}
                value={settings.platform_commission_rate}
                onChange={e => update("platform_commission_rate", Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">Platform takes this % from Master earnings</p>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Max Followers per Master</label>
              <input
                type="number"
                min={1} max={10000}
                value={settings.max_followers_per_master}
                onChange={e => update("max_followers_per_master", Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Master Approval */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              Master Approval
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.require_kyc_for_master}
                onChange={e => update("require_kyc_for_master", e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <div>
                <p className="text-sm font-medium">Require KYC for Masters</p>
                <p className="text-xs text-muted-foreground">Masters must complete identity verification</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.auto_approve_masters}
                onChange={e => update("auto_approve_masters", e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <div>
                <p className="text-sm font-medium">Auto-approve Master Applications</p>
                <p className="text-xs text-muted-foreground">Skip manual review queue (not recommended)</p>
              </div>
            </label>
          </CardContent>
        </Card>

        {/* System */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" />
              System
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.maintenance_mode}
                onChange={e => update("maintenance_mode", e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <div>
                <p className="text-sm font-medium">Maintenance Mode</p>
                <p className="text-xs text-muted-foreground">Show maintenance page to all non-admin users</p>
              </div>
            </label>
          </CardContent>
        </Card>

        {/* Regions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4" />
              Geographic Restrictions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <label className="text-sm font-medium block mb-1">Allowed Countries</label>
              <input
                type="text"
                value={settings.allowed_countries}
                onChange={e => update("allowed_countries", e.target.value)}
                placeholder="All, or comma-separated ISO codes: US, GB, JP"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">Enter &quot;All&quot; to allow all countries, or ISO codes to restrict</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Branding / White-Label */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4" />
            Branding (White-Label)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium block mb-1">Brand Name</label>
              <input
                type="text"
                value={branding.name}
                onChange={e => setBranding(p => ({ ...p, name: e.target.value }))}
                placeholder="CopyTrade"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Primary Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={branding.primary_color}
                  onChange={e => setBranding(p => ({ ...p, primary_color: e.target.value }))}
                  className="h-9 w-12 rounded border border-input bg-background p-1"
                />
                <input
                  type="text"
                  value={branding.primary_color}
                  onChange={e => setBranding(p => ({ ...p, primary_color: e.target.value }))}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Logo URL</label>
              <input
                type="url"
                value={branding.logo_url}
                onChange={e => setBranding(p => ({ ...p, logo_url: e.target.value }))}
                placeholder="https://…/logo.svg"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Favicon URL</label>
              <input
                type="url"
                value={branding.favicon_url}
                onChange={e => setBranding(p => ({ ...p, favicon_url: e.target.value }))}
                placeholder="https://…/favicon.ico"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={saveBranding} variant="outline" size="sm">
              <Palette className="h-4 w-4 mr-2" />
              {brandSaved ? "Saved!" : "Save Branding"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Applies to this tenant&apos;s subdomain — brand color, logo and favicon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

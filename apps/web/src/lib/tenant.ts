import "server-only";
import { headers } from "next/headers";

export interface TenantBranding {
  name: string;
  primaryColor: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Resolve the current tenant's public branding (server-side).
 * The backend resolves the tenant from the forwarded Host header (subdomain or
 * custom domain). The host is also passed as a query param so Next's fetch cache
 * is keyed per-tenant instead of colliding on the shared URL.
 */
export async function getTenantBranding(): Promise<TenantBranding | null> {
  try {
    const host = (await headers()).get("host") ?? "";
    const res = await fetch(
      `${API_BASE}/api/v1/tenants/current?h=${encodeURIComponent(host)}`,
      { headers: { host }, next: { revalidate: 300 } }
    );
    if (!res.ok) return null;
    const d = await res.json();
    return {
      name: d.name ?? "ArbMind",
      primaryColor: d.primary_color ?? null,
      logoUrl: d.logo_url ?? null,
      faviconUrl: d.favicon_url ?? null,
    };
  } catch {
    return null;
  }
}

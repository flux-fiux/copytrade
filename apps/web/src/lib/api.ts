/**
 * Single typed API gateway with built-in Supabase auth + real error surfacing.
 * Replaces the scattered raw `fetch(`${API}/...`)` + manual token plumbing that
 * let contract mismatches (e.g. candles) and failures hide silently.
 *
 * Client-side only (reads the browser Supabase session).
 */
import { createClient } from "@/lib/supabase/client";
import type {
  UserProfile, LeaderboardResponse, MasterDetail, MT4AccountData,
  ConnectAccountPayload, SignalData,
} from "@/lib/api-client";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function getToken(): Promise<string | null> {
  try {
    const { data: { session } } = await createClient().auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

interface Opts {
  method?: string;
  body?: unknown;
  auth?: boolean;      // default: attach token if a session exists
  signal?: AbortSignal;
}

export async function request<T>(path: string, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = opts.auth === false ? null : await getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  if (!res.ok) {
    let detail: unknown = res.statusText;
    try { const j = await res.json(); detail = j.detail ?? j.message ?? detail; } catch { /* non-JSON body */ }
    throw new ApiError(typeof detail === "string" ? detail : `Request failed (${res.status})`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Typed surface ──────────────────────────────────────────────────────────

export interface Notification {
  id: string; type: string; title: string; body?: string;
  read: boolean; data?: Record<string, unknown>; created_at: string;
}

export interface AgentAnalysis {
  id: string; symbol: string; asset_type: string; trade_date: string;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED";
  decision: string | null; reports: Record<string, string>;
  error: string | null; created_at: string | null; completed_at: string | null;
}

export const api = {
  users: {
    me: () => request<UserProfile>("/api/v1/users/me"),
    update: (data: Partial<UserProfile>) => request<UserProfile>("/api/v1/users/me", { method: "PUT", body: data }),
    onboardingStatus: () => request<{ is_master: boolean }>("/api/v1/users/me/onboarding-status"),
  },
  notifications: {
    list: () => request<Notification[]>("/api/v1/notifications/"),
    markRead: (id: string) => request<void>(`/api/v1/notifications/${id}/read`, { method: "POST" }),
    markAllRead: () => request<void>("/api/v1/notifications/read-all", { method: "POST" }),
    remove: (id: string) => request<void>(`/api/v1/notifications/${id}`, { method: "DELETE" }),
    clearAll: () => request<void>("/api/v1/notifications/", { method: "DELETE" }),
  },
  agents: {
    status: () => request<{ available: boolean; reason: string }>("/api/v1/agents/status"),
    analyze: (body: { symbol: string; asset_type?: string; depth?: string }) =>
      request<AgentAnalysis>("/api/v1/agents/analyze", { method: "POST", body }),
    list: (limit = 20) => request<AgentAnalysis[]>(`/api/v1/agents/analyses?limit=${limit}`),
    get: (id: string) => request<AgentAnalysis>(`/api/v1/agents/analyses/${id}`),
  },
  subscriptions: {
    my: () => request<unknown[]>("/api/v1/subscriptions/my"),
  },
  mt4Accounts: {
    list: () => request<MT4AccountData[]>("/api/v1/mt4-accounts/"),
    connect: (data: ConnectAccountPayload) => request<MT4AccountData>("/api/v1/mt4-accounts/", { method: "POST", body: data }),
    sync: (id: string) => request<MT4AccountData>(`/api/v1/mt4-accounts/${id}/sync`, { method: "POST" }),
    disconnect: (id: string) => request<void>(`/api/v1/mt4-accounts/${id}`, { method: "DELETE" }),
  },
  leaderboard: {
    list: (period = "1M", page = 1) => request<LeaderboardResponse>(`/api/v1/leaderboard/?period=${period}&page=${page}`, { auth: false }),
    master: (id: string) => request<MasterDetail>(`/api/v1/leaderboard/${id}`, { auth: false }),
  },
  signals: {
    list: (masterId: string) => request<SignalData[]>(`/api/v1/signals/?master_id=${masterId}`, { auth: false }),
  },
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function apiFetch<T>(path: string, options?: RequestInit & { token?: string }): Promise<T> {
  const { token, ...fetchOptions } = options ?? {};
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...fetchOptions, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API error ${res.status}`);
  }
  return res.json();
}

export const api = {
  leaderboard: {
    list: (period = '1M', page = 1) =>
      apiFetch<LeaderboardResponse>(`/api/v1/leaderboard/?period=${period}&page=${page}`),
    getMaster: (id: string) =>
      apiFetch<MasterDetail>(`/api/v1/leaderboard/${id}`),
  },
  mt4Accounts: {
    list: (token: string) =>
      apiFetch<MT4AccountData[]>('/api/v1/mt4-accounts/', { token }),
    connect: (token: string, data: ConnectAccountPayload) =>
      apiFetch<MT4AccountData>('/api/v1/mt4-accounts/', { method: 'POST', body: JSON.stringify(data), token }),
    sync: (token: string, id: string) =>
      apiFetch<MT4AccountData>(`/api/v1/mt4-accounts/${id}/sync`, { method: 'POST', token }),
    disconnect: (token: string, id: string) =>
      apiFetch<void>(`/api/v1/mt4-accounts/${id}`, { method: 'DELETE', token }),
  },
  users: {
    me: (token: string) =>
      apiFetch<UserProfile>('/api/v1/users/me', { token }),
    update: (token: string, data: Partial<UserProfile>) =>
      apiFetch<UserProfile>('/api/v1/users/me', { method: 'PUT', body: JSON.stringify(data), token }),
  },
  signals: {
    list: (masterId: string) =>
      apiFetch<SignalData[]>(`/api/v1/signals/?master_id=${masterId}`),
  },
  copyTrades: {
    list: (token: string, opts?: { subscription_id?: string; limit?: number }) => {
      const params = new URLSearchParams();
      if (opts?.subscription_id) params.set('subscription_id', opts.subscription_id);
      if (opts?.limit) params.set('limit', String(opts.limit));
      return apiFetch<CopyTradeData[]>(`/api/v1/copy-trades/?${params}`, { token });
    },
  },
  market: {
    quote: (symbol: string) =>
      apiFetch<{ c: number; h: number; l: number; o: number; pc: number; t: number }>(`/api/v1/market/quote?symbol=${symbol}`),
    candles: (symbol: string, resolution: string, from: number, to: number) =>
      apiFetch<{ s: string; t: number[]; o: number[]; h: number[]; l: number[]; c: number[]; v: number[] }>(
        `/api/v1/market/candles?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}`
      ),
    search: (q: string) =>
      apiFetch<Array<{ symbol: string; description: string }>>(`/api/v1/market/search?q=${encodeURIComponent(q)}`),
    news: (symbol: string) =>
      apiFetch<Array<{ headline: string; source: string; url: string; datetime: number }>>(`/api/v1/market/news?symbol=${symbol}`),
  },
};

export interface LeaderboardEntry {
  rank: number;
  master_id: string;
  username: string;
  return_pct: number;
  max_drawdown: number;
  sharpe_ratio: number;
  win_rate: number;
  followers_count: number;
  risk_grade: string;
  trading_days: number;
  period: string;
  is_certified?: boolean;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number;
  period: string;
}

export interface MT4AccountData {
  id: string;
  broker_name: string;
  login: string;
  server: string;
  account_type: string;
  platform: string;
  connection_status: string;
  balance?: number;
  equity?: number;
  currency: string;
  created_at: string;
}

export interface ConnectAccountPayload {
  broker_name: string;
  login: string;
  password: string;
  server: string;
  account_type: string;
  platform: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  wallet_address?: string;
  roles: string[];
  kyc_status: string;
  preferred_lang?: string;
  email_notify_signals?: boolean;
  email_notify_billing?: boolean;
  created_at: string;
}

export interface MasterDetail {
  master: { id: string; username: string; display_name?: string; apply_strategy?: string };
  score: {
    total_return_pct?: number;
    max_drawdown_pct?: number;
    sharpe_ratio?: number;
    win_rate_pct?: number;
    risk_grade?: string;
    followers_count?: number;
    trading_days?: number;
  } | null;
  followers_count: number;
  recent_signals: SignalData[];
}

export interface SignalData {
  id: string;
  symbol: string;
  direction: string;
  signal_type: string;
  volume: number;
  open_price?: number;
  profit?: number;
  opened_at: string;
}

export interface CopyTradeData {
  id: string;
  subscription_id: string;
  signal_id: string;
  follower_id: string;
  follower_account_id: string;
  symbol: string;
  direction: string;
  volume: number;
  open_price: number | null;
  close_price: number | null;
  slippage_pips: number | null;
  profit: number | null;
  status: string;
  fail_reason: string | null;
  mt4_ticket: number | null;
  opened_at: string | null;
  closed_at: string | null;
  created_at: string;
  master_name: string | null;
}

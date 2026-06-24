// Shared types between frontend and Node.js workers

export type UserRole = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'MASTER' | 'FOLLOWER' | 'BROKER';
export type SignalType = 'OPEN' | 'CLOSE' | 'MODIFY';
export type TradeDirection = 'BUY' | 'SELL';
export type AccountType = 'MASTER' | 'FOLLOWER';
export type RiskGrade = 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D';
export type LeaderboardPeriod = 'ALL_TIME' | '1Y' | '6M' | '3M' | '1M';

export interface Signal {
  id: string;
  master_id: string;
  mt4_account_id: string;
  signal_type: SignalType;
  symbol: string;
  direction: TradeDirection;
  volume: number;
  open_price?: number;
  close_price?: number;
  stop_loss?: number;
  take_profit?: number;
  profit?: number;
  pips?: number;
  mt4_ticket: number;
  opened_at: string;
  closed_at?: string;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  tags: string[];
}

export interface LeaderboardEntry {
  master_id: string;
  display_name: string;
  avatar_url?: string;
  period: LeaderboardPeriod;
  total_return_pct: number;
  monthly_return_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  win_rate_pct: number;
  profit_factor: number;
  total_trades: number;
  trading_days: number;
  followers_count: number;
  consistency_score: number;
  risk_grade: RiskGrade;
}

export interface MarketQuote {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  change_pct: number;
  volume?: number;
  timestamp: string;
}

export interface OHLCV {
  time: number;  // Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

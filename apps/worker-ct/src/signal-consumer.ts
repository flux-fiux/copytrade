import type Redis from 'ioredis';
import { logger } from './logger.js';

export interface CapturedSignal {
  id?: string;
  masterId: string;
  metaApiAccountId: string;
  signalType: 'OPEN' | 'CLOSE' | 'MODIFY';
  symbol: string;
  direction: 'BUY' | 'SELL';
  volume: number;
  openPrice?: number;
  closePrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  mt4Ticket?: number;
  openedAt?: string;
  closedAt?: string;
  profit?: number;
  tags: string[];
}

interface ActiveSubscription {
  subscription_id: string;
  follower_id: string;
  follower_account_id: string;
  tenant_id: string;
  lot_multiplier: number;
}

export class SignalConsumer {
  private subscriber: Redis | null = null;

  constructor(
    private readonly redis: Redis,
    private readonly apiUrl: string,
  ) {}

  async publishSignal(signal: CapturedSignal): Promise<void> {
    // 1. Publish to Redis for real-time push (worker-rt picks this up)
    const channel = `signal:${signal.masterId}`;
    await this.redis.publish(channel, JSON.stringify(signal));
    logger.info(
      { masterId: signal.masterId, signalType: signal.signalType, symbol: signal.symbol },
      'Signal published to Redis',
    );

    // 2. Persist to DB via API
    let signalId: string | null = null;
    try {
      const resp = await fetch(`${this.apiUrl}/api/v1/signals/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meta_api_account_id: signal.metaApiAccountId,
          master_id: signal.masterId,
          signal_type: signal.signalType,
          symbol: signal.symbol,
          direction: signal.direction,
          volume: signal.volume,
          open_price: signal.openPrice ?? null,
          close_price: signal.closePrice ?? null,
          stop_loss: signal.stopLoss ?? null,
          take_profit: signal.takeProfit ?? null,
          profit: signal.profit ?? null,
          mt4_ticket: signal.mt4Ticket ?? null,
          opened_at: signal.openedAt ?? null,
          closed_at: signal.closedAt ?? null,
        }),
      });
      if (resp.ok) {
        const body = await resp.json() as { signal_id?: string };
        signalId = body.signal_id ?? null;
      } else {
        const body = await resp.text();
        logger.error({ status: resp.status, body }, 'Signal ingest API error');
      }
    } catch (err) {
      logger.error({ err }, 'Signal ingest fetch failed');
    }

    // 3. Record copy trades for all active followers of this master
    if (signalId) {
      await this.recordCopyTrades(signal, signalId);
    }
  }

  async start() {
    this.subscriber = this.redis.duplicate();
    await this.subscriber.psubscribe('signal:*');

    this.subscriber.on('pmessage', async (_pattern, channel, message) => {
      try {
        const signal: CapturedSignal = JSON.parse(message);
        await this.handleSignal(channel, signal);
      } catch (err) {
        logger.error({ err, channel }, 'Failed to process signal');
      }
    });

    logger.info('Signal consumer started');
  }

  async stop() {
    if (this.subscriber) {
      await this.subscriber.punsubscribe('signal:*');
      this.subscriber.disconnect();
    }
  }

  private async handleSignal(_channel: string, _signal: CapturedSignal) {
    // publishSignal() is called directly by MetaAPIListener — this subscriber
    // handles signals re-published by OTHER workers (future multi-instance setup).
    // In single-worker mode this is a no-op to avoid double processing.
  }

  private async recordCopyTrades(signal: CapturedSignal, signalId: string): Promise<void> {
    // Fetch active subscriptions for this master from the API
    let subscriptions: ActiveSubscription[] = [];
    try {
      const resp = await fetch(
        `${this.apiUrl}/api/v1/copy-trades/subscriptions?master_id=${signal.masterId}`,
      );
      if (resp.ok) {
        subscriptions = (await resp.json()) as ActiveSubscription[];
      }
    } catch (err) {
      logger.error({ err }, 'Failed to fetch active subscriptions');
      return;
    }

    if (subscriptions.length === 0) return;

    logger.info(
      { masterId: signal.masterId, signalId, followerCount: subscriptions.length },
      'Recording copy trades',
    );

    // Record a copy_trade entry for each follower and push real-time event
    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const scaledVolume = parseFloat((signal.volume * sub.lot_multiplier).toFixed(2));
        try {
          const internalToken = process.env.INTERNAL_API_TOKEN ?? '';
          const resp = await fetch(`${this.apiUrl}/api/v1/copy-trades/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Internal-Token': internalToken,
            },
            body: JSON.stringify({
              tenant_id: sub.tenant_id,
              subscription_id: sub.subscription_id,
              signal_id: signalId,
              follower_id: sub.follower_id,
              follower_account_id: sub.follower_account_id,
              symbol: signal.symbol,
              direction: signal.direction,
              volume: scaledVolume,
              open_price: signal.openPrice ?? null,
              close_price: signal.closePrice ?? null,
              profit: signal.profit !== undefined ? signal.profit * sub.lot_multiplier : null,
              status: signal.signalType === 'CLOSE' ? 'CLOSED' : 'OPEN',
            }),
          });

          if (resp.ok) {
            const copyTrade = await resp.json() as Record<string, unknown>;
            // Push real-time event via Redis → worker-rt → follower's Socket.IO room
            await this.redis.publish(
              `copytrade:${sub.follower_id}`,
              JSON.stringify({
                ...copyTrade,
                master_name: signal.masterId,  // worker-rt relays this to frontend
              }),
            );
            logger.debug({ followerId: sub.follower_id, symbol: signal.symbol }, 'Copy trade recorded');
          } else {
            const body = await resp.text();
            logger.warn({ followerId: sub.follower_id, status: resp.status, body }, 'Copy trade record failed');
          }
        } catch (err) {
          logger.error({ err, followerId: sub.follower_id }, 'Copy trade processing error');
        }
      }),
    );
  }
}

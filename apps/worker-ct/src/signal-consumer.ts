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
      if (!resp.ok) {
        const body = await resp.text();
        logger.error({ status: resp.status, body }, 'Signal ingest API error');
      }
    } catch (err) {
      logger.error({ err }, 'Signal ingest fetch failed');
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

  private async handleSignal(channel: string, signal: CapturedSignal) {
    const masterId = channel.replace('signal:', '');
    logger.info({ masterId, signalType: signal.signalType, symbol: signal.symbol }, 'Processing signal for copy-trade');
    // CopyFactory handles follower execution; copy_trade records written here in Phase 1 Week 7-8
  }
}

import type MetaApi from 'metaapi.cloud-sdk';
import type Redis from 'ioredis';
import { logger } from './logger.js';

interface Signal {
  id: string;
  master_id: string;
  signal_type: 'OPEN' | 'CLOSE' | 'MODIFY';
  symbol: string;
  direction: 'BUY' | 'SELL';
  volume: number;
  open_price?: number;
  close_price?: number;
  stop_loss?: number;
  take_profit?: number;
  mt4_ticket: number;
}

export class SignalConsumer {
  private running = false;
  private subscriber: Redis | null = null;

  constructor(
    private readonly redis: Redis,
    private readonly metaApi: MetaApi,
  ) {}

  async start() {
    this.running = true;
    // Subscribe to signal channel pattern
    this.subscriber = this.redis.duplicate();
    await this.subscriber.psubscribe('signal:*');

    this.subscriber.on('pmessage', async (_pattern, channel, message) => {
      try {
        const signal: Signal = JSON.parse(message);
        await this.handleSignal(channel, signal);
      } catch (err) {
        logger.error({ err, channel }, 'Failed to process signal');
      }
    });

    logger.info('Signal consumer started, listening on signal:*');
  }

  async stop() {
    this.running = false;
    if (this.subscriber) {
      await this.subscriber.punsubscribe('signal:*');
      this.subscriber.disconnect();
    }
  }

  private async handleSignal(channel: string, signal: Signal) {
    const masterId = channel.replace('signal:', '');
    logger.info({ masterId, signalType: signal.signal_type, symbol: signal.symbol }, 'Processing signal');

    // TODO Phase 1 Week 7-8:
    // 1. Fetch active subscribers for this master from DB via HTTP call to api-core
    // 2. For each subscriber: run RiskGuard check
    // 3. Log execution result (CopyFactory handles actual execution)
    // 4. Record copy_trade row via API
  }
}

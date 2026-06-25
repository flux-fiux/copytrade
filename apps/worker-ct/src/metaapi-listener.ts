import MetaApi, { SynchronizationListener } from 'metaapi.cloud-sdk';
import { logger } from './logger.js';
import type { SignalConsumer } from './signal-consumer.js';

export class TradeListener extends SynchronizationListener {
  constructor(
    private readonly masterId: string,
    private readonly metaApiAccountId: string,
    private readonly consumer: SignalConsumer,
  ) {
    super();
  }

  async onSynchronized(instanceIndex: string, synchronizationId: string): Promise<void> {
    logger.info({ masterId: this.masterId, instanceIndex, synchronizationId }, 'Master account synchronized');
  }

  async onDealAdded(instanceIndex: string, deal: any): Promise<void> {
    if (!deal.symbol) return;

    const isOpen = deal.entry === 'DEAL_ENTRY_IN';
    await this.consumer.publishSignal({
      masterId: this.masterId,
      metaApiAccountId: this.metaApiAccountId,
      signalType: isOpen ? 'OPEN' : 'CLOSE',
      symbol: deal.symbol,
      direction: deal.type === 'DEAL_TYPE_BUY' ? 'BUY' : 'SELL',
      volume: deal.volume ?? 0,
      openPrice: isOpen ? deal.price : undefined,
      closePrice: !isOpen ? deal.price : undefined,
      stopLoss: deal.stopLoss ?? undefined,
      takeProfit: deal.takeProfit ?? undefined,
      profit: deal.profit,
      mt4Ticket: deal.positionId ? parseInt(deal.positionId, 10) : undefined,
      openedAt: isOpen ? new Date().toISOString() : undefined,
      closedAt: !isOpen ? new Date().toISOString() : undefined,
      tags: [],
    });
  }
}

export class MetaAPIListener {
  private readonly api: MetaApi;
  private readonly connections = new Map<string, any>();

  constructor(
    token: string,
    private readonly consumer: SignalConsumer,
  ) {
    this.api = new MetaApi(token);
  }

  async addMasterAccount(metaApiAccountId: string, masterId: string): Promise<void> {
    try {
      const account = await this.api.metatraderAccountApi.getAccount(metaApiAccountId);
      const connection = account.getStreamingConnection();
      connection.addSynchronizationListener(new TradeListener(masterId, metaApiAccountId, this.consumer));
      await connection.connect();
      await connection.waitSynchronized({ timeoutInSeconds: 60 });
      this.connections.set(metaApiAccountId, connection);
      logger.info({ metaApiAccountId, masterId }, 'Master account connected');
    } catch (err) {
      logger.error({ err, metaApiAccountId, masterId }, 'Failed to connect master account');
    }
  }

  hasAccount(metaApiAccountId: string): boolean {
    return this.connections.has(metaApiAccountId);
  }

  async disconnectAll(): Promise<void> {
    for (const [id, conn] of this.connections) {
      try {
        await conn.close();
        logger.info({ metaApiAccountId: id }, 'Disconnected');
      } catch (err) {
        logger.error({ err, metaApiAccountId: id }, 'Error disconnecting');
      }
    }
    this.connections.clear();
  }
}

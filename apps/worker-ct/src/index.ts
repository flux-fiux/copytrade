import 'dotenv/config';
import http from 'http';
import Redis from 'ioredis';
import { logger } from './logger.js';
import { SignalConsumer } from './signal-consumer.js';
import { MetaAPIListener } from './metaapi-listener.js';
import { fetchMasterAccounts } from './api-client.js';

const METAAPI_TOKEN = process.env.METAAPI_TOKEN ?? '';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const API_URL = process.env.API_URL ?? 'http://localhost:8000';
const HEALTH_PORT = parseInt(process.env.PORT ?? '3002', 10);

// Minimal HTTP server so Railway health checks pass
const healthServer = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok' }));
});
healthServer.listen(HEALTH_PORT, () => {
  logger.info({ port: HEALTH_PORT }, 'Health server listening');
});

async function main() {
  logger.info('CopyTrade Worker starting...');

  const redis = new Redis(REDIS_URL);

  redis.on('error', (err) => logger.error({ err }, 'Redis connection error'));
  redis.on('connect', () => logger.info('Redis connected'));

  const consumer = new SignalConsumer(redis, API_URL);
  await consumer.start();

  const listener = new MetaAPIListener(METAAPI_TOKEN, consumer);

  // Load active master accounts from API and start streaming
  const masters = await fetchMasterAccounts(API_URL);
  for (const { metaApiAccountId, masterId } of masters) {
    await listener.addMasterAccount(metaApiAccountId, masterId);
  }

  logger.info({ masterCount: masters.length }, 'Worker running');

  // Poll for newly-added master accounts every 60 s
  const SYNC_INTERVAL_MS = 60_000;
  const syncTimer = setInterval(async () => {
    try {
      const current = await fetchMasterAccounts(API_URL);
      let added = 0;
      for (const { metaApiAccountId, masterId } of current) {
        if (!listener.hasAccount(metaApiAccountId)) {
          await listener.addMasterAccount(metaApiAccountId, masterId);
          added++;
        }
      }
      if (added > 0) {
        logger.info({ added }, 'Connected new master accounts');
      }
    } catch (err) {
      logger.error({ err }, 'Master account sync failed');
    }
  }, SYNC_INTERVAL_MS);

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down...');
    clearInterval(syncTimer);
    await listener.disconnectAll();
    await consumer.stop();
    await redis.quit();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal error');
  process.exit(1);
});

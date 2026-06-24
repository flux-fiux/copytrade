import 'dotenv/config';
import Redis from 'ioredis';
import { logger } from './logger.js';
import { SignalConsumer } from './signal-consumer.js';
import { MetaAPIListener } from './metaapi-listener.js';
import { fetchMasterAccounts } from './api-client.js';

const METAAPI_TOKEN = process.env.METAAPI_TOKEN ?? '';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const API_URL = process.env.API_URL ?? 'http://localhost:8000';

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

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down...');
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

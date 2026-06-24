import 'dotenv/config';
import MetaApi from 'metaapi.cloud-sdk';
import Redis from 'ioredis';
import { logger } from './logger.js';
import { SignalConsumer } from './signal-consumer.js';

const METAAPI_TOKEN = process.env.METAAPI_TOKEN ?? '';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

async function main() {
  logger.info('CopyTrade Worker starting...');

  const metaApi = new MetaApi(METAAPI_TOKEN);
  const redis = new Redis(REDIS_URL);

  redis.on('error', (err) => logger.error({ err }, 'Redis connection error'));
  redis.on('connect', () => logger.info('Redis connected'));

  const consumer = new SignalConsumer(redis, metaApi);
  await consumer.start();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down...');
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

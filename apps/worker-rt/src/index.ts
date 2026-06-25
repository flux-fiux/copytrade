import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const PORT = parseInt(process.env.PORT ?? '3001');
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});

const redisOpts = {
  lazyConnect: true,
  retryStrategy: (times: number) => Math.min(times * 200, 5000),
  maxRetriesPerRequest: null,
};
const redis = new Redis(REDIS_URL, redisOpts);
const redisSub = new Redis(REDIS_URL, redisOpts);

redis.on('error', (err: Error) => logger.error({ err }, 'Redis pub error'));
redisSub.on('error', (err: Error) => logger.error({ err }, 'Redis sub error'));

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', connections: io.engine.clientsCount }),
);

io.on('connection', (socket: Socket) => {
  logger.info({ socketId: socket.id }, 'Client connected');

  socket.on('subscribe:market', (symbols: unknown) => {
    if (!Array.isArray(symbols)) return;
    (symbols as string[]).forEach((sym) =>
      socket.join(`market:${String(sym).toUpperCase()}`),
    );
    logger.debug({ socketId: socket.id, symbols }, 'Subscribed to market');
  });

  socket.on('unsubscribe:market', (symbols: unknown) => {
    if (!Array.isArray(symbols)) return;
    (symbols as string[]).forEach((sym) =>
      socket.leave(`market:${String(sym).toUpperCase()}`),
    );
  });

  socket.on('subscribe:signals', (masterId: unknown) => {
    if (typeof masterId !== 'string') return;
    socket.join(`signals:${masterId}`);
    logger.debug({ socketId: socket.id, masterId }, 'Subscribed to signals');
  });

  socket.on('subscribe:copytrades', (followerId: unknown) => {
    if (typeof followerId !== 'string') return;
    socket.join(`copytrades:${followerId}`);
    logger.debug({ socketId: socket.id, followerId }, 'Subscribed to copytrades');
  });

  socket.on('disconnect', (reason) => {
    logger.info({ socketId: socket.id, reason }, 'Client disconnected');
  });
});

async function startRedisSubscriber(): Promise<void> {
  await redisSub.connect();

  await redisSub.psubscribe('signal:*', 'market:*', 'copytrade:*');

  redisSub.on('pmessage', (_pattern: string, channel: string, message: string) => {
    try {
      const data = JSON.parse(message) as Record<string, unknown>;

      if (channel.startsWith('signal:')) {
        const masterId = channel.slice('signal:'.length);
        io.to(`signals:${masterId}`).emit('signal', { masterId, ...data });
      } else if (channel.startsWith('market:')) {
        const symbol = channel.slice('market:'.length);
        io.to(`market:${symbol}`).emit('quote', { symbol, ...data });
      } else if (channel.startsWith('copytrade:')) {
        const followerId = channel.slice('copytrade:'.length);
        io.to(`copytrades:${followerId}`).emit('copytrade', data);
      }
    } catch (err) {
      logger.error({ err, channel }, 'Failed to relay message');
    }
  });

  logger.info('Redis subscriber ready');
}

async function main(): Promise<void> {
  await redis.connect();
  await startRedisSubscriber();

  httpServer.listen(PORT, () => {
    logger.info({ port: PORT }, 'Realtime service started');
  });

  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down...');
    await new Promise<void>((resolve) => io.close(() => resolve()));
    redis.disconnect();
    redisSub.disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

main().catch((err) => {
  logger.error({ err }, 'Fatal error');
  process.exit(1);
});

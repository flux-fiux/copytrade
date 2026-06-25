import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const PORT = parseInt(process.env.PORT ?? '3001');
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
const API_BASE = process.env.INTERNAL_API_URL ?? 'http://localhost:8000';
const QUOTE_POLL_MS = parseInt(process.env.QUOTE_POLL_MS ?? '5000');

// Default symbols always broadcast when any market subscriber is active
const DEFAULT_SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD', 'US30', 'USDCAD', 'AUDUSD'];

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
// Separate clients for the Socket.IO Redis adapter (horizontal scaling)
const adapterPub = new Redis(REDIS_URL, redisOpts);
const adapterSub = new Redis(REDIS_URL, redisOpts);

redis.on('error', (err: Error) => logger.error({ err }, 'Redis pub error'));
redisSub.on('error', (err: Error) => logger.error({ err }, 'Redis sub error'));
adapterPub.on('error', (err: Error) => logger.error({ err }, 'Redis adapter pub error'));
adapterSub.on('error', (err: Error) => logger.error({ err }, 'Redis adapter sub error'));

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

// ── Market Quote Broadcaster ───────────────────────────────────────────────
// Polls FastAPI /api/v1/market/quote for every symbol that has at least one
// Socket.IO subscriber, then publishes to Redis → relayed to clients.
async function broadcastMarketQuotes(): Promise<void> {
  const rooms = io.sockets.adapter.rooms;

  // Collect all symbols with active subscribers (from DEFAULT_SYMBOLS + any
  // dynamic ones clients subscribed to)
  const subscribedSymbols = new Set<string>();
  for (const sym of DEFAULT_SYMBOLS) {
    const room = rooms.get(`market:${sym}`);
    if (room && room.size > 0) subscribedSymbols.add(sym);
  }
  // Also pick up any dynamic symbols not in the default list
  for (const [roomName] of rooms) {
    if (roomName.startsWith('market:')) {
      const sym = roomName.slice('market:'.length);
      if (!subscribedSymbols.has(sym)) {
        const room = rooms.get(roomName);
        if (room && room.size > 0) subscribedSymbols.add(sym);
      }
    }
  }

  if (subscribedSymbols.size === 0) return;

  await Promise.allSettled(
    [...subscribedSymbols].map(async (sym) => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/market/quote?symbol=${sym}`, {
          signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) return;
        const data = (await res.json()) as Record<string, unknown>;
        // Only publish if we got a real price
        if (!data.c && !data.price) return;
        await redis.publish(
          `market:${sym}`,
          JSON.stringify({ ...data, symbol: sym, t: Date.now() }),
        );
      } catch {
        // Transient errors are fine — just skip this tick for this symbol
      }
    }),
  );
}

async function main(): Promise<void> {
  await redis.connect();
  await adapterPub.connect();
  await adapterSub.connect();
  io.adapter(createAdapter(adapterPub, adapterSub));
  logger.info('Socket.IO Redis adapter attached');
  await startRedisSubscriber();

  httpServer.listen(PORT, () => {
    logger.info({ port: PORT }, 'Realtime service started');
  });

  // Start market quote broadcaster after the server is up
  setInterval(() => void broadcastMarketQuotes(), QUOTE_POLL_MS);
  logger.info({ intervalMs: QUOTE_POLL_MS }, 'Market quote broadcaster started');

  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down...');
    await new Promise<void>((resolve) => io.close(() => resolve()));
    redis.disconnect();
    redisSub.disconnect();
    adapterPub.disconnect();
    adapterSub.disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

main().catch((err) => {
  logger.error({ err }, 'Fatal error');
  process.exit(1);
});

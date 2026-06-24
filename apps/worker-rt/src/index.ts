import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
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

const redis = new Redis(REDIS_URL);
const redisSub = redis.duplicate();

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'Client connected');

  // Client subscribes to market data for specific symbols
  socket.on('subscribe:market', (symbols: string[]) => {
    symbols.forEach((sym) => socket.join(`market:${sym}`));
    logger.debug({ socketId: socket.id, symbols }, 'Subscribed to market data');
  });

  // Client subscribes to signals for a master
  socket.on('subscribe:signals', (masterId: string) => {
    socket.join(`signals:${masterId}`);
  });

  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Client disconnected');
  });
});

// Relay Redis Pub/Sub → Socket.IO rooms
redisSub.psubscribe('market:*', 'signal:*');
redisSub.on('pmessage', (_pattern, channel, message) => {
  const [type, id] = channel.split(':');
  if (type === 'market') {
    io.to(`market:${id}`).emit('market:update', JSON.parse(message));
  } else if (type === 'signal') {
    io.to(`signals:${id}`).emit('signal:new', JSON.parse(message));
  }
});

httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, 'Realtime service started');
});

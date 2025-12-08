// api/[...path].ts
import { VercelRequest, VercelResponse } from '@vercel/node';

const workerEnv = process.env.WORKERS;
if (!workerEnv) throw new Error('WORKERS env variable is not set');
if (!process.env.REDIS_URL) throw new Error('REDIS_URL env variable is not set');

const workers = workerEnv.split(',').map(s => s.trim()).filter(Boolean);
if (workers.length === 0) throw new Error('WORKERS env variable is empty');

const MAX_DAILY_REQUESTS = 100_000;
let currentIndex = 0;

let _redisClient: any = null;
let _redisConnecting: Promise<any> | null = null;

async function getRedis() {
  if (_redisClient && _redisClient.isOpen) return _redisClient;
  if (_redisConnecting) return _redisConnecting;

  _redisConnecting = (async () => {
    const { createClient } = await import('redis');
    const client = createClient({ url: process.env.REDIS_URL });
    client.on('error', (err: any) => {
      console.error('Redis client error', err);
    });
    await client.connect();
    _redisClient = client;
    _redisConnecting = null;
    return _redisClient;
  })();

  return _redisConnecting;
}

function getUtcDateString(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayKey(workerUrl: string) {
  const date = getUtcDateString(); 
  const encoded = encodeURIComponent(workerUrl);
  return `worker:${encoded}:${date}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!req.url) return res.status(400).send('Missing path');

  const path = req.url; 

  const redis = await getRedis();

  for (let i = 0; i < workers.length; i++) {
    const worker = workers[currentIndex];
    currentIndex = (currentIndex + 1) % workers.length;

    const key = getTodayKey(worker);
    const countStr = await redis.get(key);
    const count = countStr ? parseInt(countStr, 10) : 0;

    if (count < MAX_DAILY_REQUESTS) {
      const newCount = await redis.incr(key);

      const now = new Date();
      const nextUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
      const secondsUntilMidnight = Math.max(0, Math.floor((nextUtcMidnight - now.getTime()) / 1000));
      const ttl = await redis.ttl(key);
      if (ttl === -1 || ttl === -2) {
        await redis.expire(key, secondsUntilMidnight + 5);
      }

      if (newCount > MAX_DAILY_REQUESTS) {
        continue;
      }

      const redirectUrl = `${worker}${path}`;
      return res.redirect(redirectUrl);
    }
  }

  return res.status(503).send('All workers have reached daily quota');
}

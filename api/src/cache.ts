import { createClient, type RedisClientType } from 'redis';
import { env } from './env';

export const cache: RedisClientType = createClient({ url: env.REDIS_URL });
cache.on('error', (err) => console.error('redis error', err));

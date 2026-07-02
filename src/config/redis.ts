import IORedis, { Redis } from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

/**
 * BullMQ requires a Redis connection configured with maxRetriesPerRequest: null
 * so that it can manage blocking commands (used internally by Workers) correctly.
 * We create a single shared connection factory and reuse it across Queue,
 * Worker and QueueEvents instances (BullMQ recommends *separate* connections
 * per Queue/Worker/QueueEvents in high-throughput setups, so we expose a
 * factory function rather than a singleton).
 */
export function createRedisConnection(): Redis {
  const connection = new IORedis({
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password,
    db: env.redis.db,
    tls: env.redis.tls ? {} : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  connection.on('connect', () => logger.info('Redis connection established'));
  connection.on('error', (err) => logger.error({ err }, 'Redis connection error'));
  connection.on('close', () => logger.warn('Redis connection closed'));

  return connection;
}



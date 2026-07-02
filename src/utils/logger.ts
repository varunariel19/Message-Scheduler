import pino from 'pino';
import { env } from '../config/env';

/**
 * Central structured logger. In development we pretty-print; in production
 * we emit plain JSON lines so they can be shipped to a log aggregator.
 */
export const logger = pino({
  level: env.logLevel,
  transport:
    env.nodeEnv === 'development'
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
        }
      : undefined,
});

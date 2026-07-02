import dotenv from 'dotenv';

dotenv.config();

/**
 * Small helper to fail fast if a required env var is missing.
 * Better to crash on boot than to silently misbehave in production.
 */
function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function optionalBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw.toLowerCase() === 'true';
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: optionalNumber('PORT', 4000),
  logLevel: process.env.LOG_LEVEL ?? 'info',

  redis: {
    host: required('REDIS_HOST', 'localhost'),
    port: optionalNumber('REDIS_PORT', 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: optionalNumber('REDIS_DB', 0),
    tls: optionalBoolean('REDIS_TLS', false),
  },

  queue: {
    name: process.env.QUEUE_NAME ?? 'delayed-messages',
    workerConcurrency: optionalNumber('WORKER_CONCURRENCY', 5),
    jobAttempts: optionalNumber('JOB_ATTEMPTS', 5),
    backoffDelayMs: optionalNumber('JOB_BACKOFF_DELAY_MS', 5000),
    removeOnCompleteAgeSeconds: optionalNumber('REMOVE_ON_COMPLETE_AGE_SECONDS', 3600),
    removeOnFailAgeSeconds: optionalNumber('REMOVE_ON_FAIL_AGE_SECONDS', 86400),
  },
  
  webhook: {
    baseUrl: required('MAIN_BACKEND_URL', 'http://localhost:7111'),
    path: process.env.MAIN_BACKEND_WEBHOOK_PATH ?? '/api/webhook/delayed/send',
    timeoutMs: optionalNumber('WEBHOOK_TIMEOUT_MS', 10000),
    authHeader: process.env.WEBHOOK_AUTH_HEADER || undefined,
    authToken: process.env.WEBHOOK_AUTH_TOKEN || undefined,
  },
};

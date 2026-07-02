import { env } from './env';

/**
 * Shared BullMQ job options. Applied as the *default* when a job is added;
 * individual jobs can still override attempts/backoff/delay per-call.
 */
export const defaultJobOptions = {
  attempts: env.queue.jobAttempts,
  backoff: {
    type: 'exponential' as const,
    delay: env.queue.backoffDelayMs,
  },
  removeOnComplete: {
    age: env.queue.removeOnCompleteAgeSeconds,
  },
  removeOnFail: {
    age: env.queue.removeOnFailAgeSeconds,
  },
};

export const QUEUE_NAME = env.queue.name;

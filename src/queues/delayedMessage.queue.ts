import { Queue } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { QUEUE_NAME, defaultJobOptions } from '../config/bullmq';
import { DelayedMessageJobData } from '../interfaces/delayedMessage.interface';

/**
 * The Queue is the producer-side handle: it's what we use to add jobs.
 * BullMQ persists everything in Redis, so this object is cheap — it just
 * wraps a Redis connection and namespaces keys under `bull:<QUEUE_NAME>:*`.
 */
export const delayedMessageQueue = new Queue<DelayedMessageJobData>(QUEUE_NAME, {
  connection: createRedisConnection(),
  defaultJobOptions,
});

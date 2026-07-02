import { QueueEvents } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { QUEUE_NAME } from '../config/bullmq';
import { logger } from '../utils/logger';

/**
 * QueueEvents listens to a dedicated Redis pub/sub channel that BullMQ
 * maintains for queue-wide lifecycle events. This is separate from the
 * Worker's own 'completed'/'failed' events because QueueEvents works even
 * from a process that isn't running a Worker (e.g. a monitoring/admin
 * process), and it captures events for ALL workers on the queue, not just
 * jobs processed by a specific Worker instance.
 */
export function createQueueEvents(): QueueEvents {
  const queueEvents = new QueueEvents(QUEUE_NAME, {
    connection: createRedisConnection(),
  });

  queueEvents.on('completed', ({ jobId }) => {
    logger.info({ jobId }, 'Job completed (queue event)');
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    logger.error({ jobId, failedReason }, 'Job failed (queue event)');
  });

  queueEvents.on('delayed', ({ jobId }) => {
    logger.debug({ jobId }, 'Job delayed (queue event)');
  });

  queueEvents.on('stalled', ({ jobId }) => {
    logger.warn({ jobId }, 'Job stalled (queue event) — check worker health');
  });

  return queueEvents;
}

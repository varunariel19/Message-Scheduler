import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { QUEUE_NAME } from '../config/bullmq';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { DelayedMessageJobData } from '../interfaces/delayedMessage.interface';
import { sendDelayedMessageWebhook } from '../services/webhook.service';

export function createDelayedMessageWorker(): Worker<DelayedMessageJobData> {

  const worker = new Worker<DelayedMessageJobData>(QUEUE_NAME, async (job: Job<DelayedMessageJobData>) => {

    logger.info({ jobId: job.id, messageId: job.data.messageId }, 'Processing delayed message job');
    await sendDelayedMessageWebhook(job);

    logger.info({ jobId: job.id, messageId: job.data.messageId }, 'Webhook delivered successfully');
    return { deliveredAt: new Date().toISOString() };

  }, { connection: createRedisConnection(), concurrency: env.queue.workerConcurrency });

  worker.on('completed', async (job) => {
    try {
      await job.remove();
      logger.info({ jobId: job.id, messageId: job.data.messageId }, 'Job removed from Redis after completion');
    } catch (err) {
      logger.warn({ jobId: job.id, err }, 'Failed to remove completed job from Redis');
    }
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, messageId: job?.data?.messageId, attemptsMade: job?.attemptsMade, err },
      'Delayed message job failed'
    );
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Worker error');
  });

  return worker;
}

import { Express } from 'express';
import { Server } from 'http';
import { Worker, QueueEvents } from 'bullmq';
import { env } from './config/env';
import { logger } from './utils/logger';
import { createDelayedMessageWorker } from './queues/delayedMessage.worker';
import { createQueueEvents } from './queues/queue.events';
import { delayedMessageQueue } from './queues/delayedMessage.queue';

export interface RunningServer {
  httpServer: Server;
  worker: Worker;
  queueEvents: QueueEvents;
}

/**
 * Boots the HTTP server, the BullMQ worker, and the QueueEvents listener
 * together, and wires up graceful shutdown for all three plus the queue's
 * own Redis connection.
 */
export function startServer(app: Express): RunningServer {
  const httpServer = app.listen(env.port, () => {
    logger.info(`Message Scheduling Service listening on port ${env.port} (${env.nodeEnv})`);
  });

  const worker = createDelayedMessageWorker();
  const queueEvents = createQueueEvents();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    // Order matters: stop accepting new HTTP requests first, then stop
    // pulling new jobs (worker.close waits for in-flight jobs to finish),
    // then close the remaining Redis-backed connections.
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await worker.close();
    await queueEvents.close();
    await delayedMessageQueue.close();

    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
  });
  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught exception');
    // Uncaught exceptions leave the process in an unknown state; exit and
    // let the orchestrator (Docker/K8s) restart it cleanly.
    process.exit(1);
  });

  return { httpServer, worker, queueEvents };
}

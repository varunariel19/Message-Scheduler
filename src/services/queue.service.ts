import { delayedMessageQueue } from '../queues/delayedMessage.queue';
import { JobDetailsResponse, DelayedMessageJobData } from '../interfaces/delayedMessage.interface';

/**
 * Thin wrapper around BullMQ's Job API so controllers don't talk to BullMQ
 * directly. Keeps the queue library an implementation detail of this layer.
 */
export async function getJobById(jobId: string): Promise<JobDetailsResponse | null> {
  const job = await delayedMessageQueue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();

  return {
    id: job.id ?? jobId,
    name: job.name,
    data: job.data,
    state,
    attemptsMade: job.attemptsMade,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    failedReason: job.failedReason,
    delay: job.delay,
  };
}

export async function cancelJob(jobId: string): Promise<boolean> {
  const job = await delayedMessageQueue.getJob(jobId);
  if (!job) return false;

  const state = await job.getState();
  if (state === 'completed' || state === 'active') {
    // Already delivered or currently being processed — too late to cancel cleanly.
    throw new Error(`Cannot cancel job in state "${state}"`);
  }

  await job.remove();
  return true;
}

export async function rescheduleJob(
  jobId: string,
  newScheduledAt: string,
  newDelayMs: number
): Promise<DelayedMessageJobData> {
  const job = await delayedMessageQueue.getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  const state = await job.getState();
  if (state === 'completed' || state === 'active') {
    throw new Error(`Cannot reschedule job in state "${state}"`);
  }

  // BullMQ has no built-in "change delay in place" for a job already sitting
  // in the delayed set, so the safe approach is: remove the old job, add a
  // fresh one with the same data but a new delay/scheduledAt.
  const updatedData: DelayedMessageJobData = { ...job.data, scheduledAt: newScheduledAt };
  await job.remove();

  await delayedMessageQueue.add('delayed-message', updatedData, {
    jobId, // keep the same external job ID for a seamless client experience
    delay: newDelayMs,
  });

  return updatedData;
}

import { delayedMessageQueue } from '../queues/delayedMessage.queue';
import { computeDelayMs } from '../utils/date';
import {
  ScheduleMessageRequest,
  ScheduleMessageResponse,
  DelayedMessageJobData,
} from '../interfaces/delayedMessage.interface';

const JOB_NAME = 'delayed-message';

/**
 * Core business logic for scheduling a delayed message.
 * Controllers stay thin; this is where the actual work happens so it's
 * independently testable without spinning up Express.
 */
export async function scheduleDelayedMessage(
  request: ScheduleMessageRequest
): Promise<ScheduleMessageResponse> {
  const delayMs = computeDelayMs(request.scheduledAt);

  const jobData: DelayedMessageJobData = {
    messageId: request.messageId,
    conversationId: request.conversationId,
    senderId: request.senderId,
    scheduledAt: request.scheduledAt,
    webhookPayload: request.webhookPayload,
  };

  const job = await delayedMessageQueue.add(JOB_NAME, jobData, {
    delay: delayMs,
    // Use the caller's messageId as the BullMQ job ID when possible, so
    // re-submitting the same messageId is naturally idempotent (BullMQ
    // rejects/returns the existing job rather than creating a duplicate).
    jobId: request.messageId,
  });

  return {
    jobId: job.id ?? request.messageId,
    messageId: request.messageId,
    scheduledAt: request.scheduledAt,
    delayMs,
    status: 'scheduled',
  };
}

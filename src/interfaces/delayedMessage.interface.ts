/**
 * The exact shape the .NET backend expects on its webhook.
 * Kept as `Record<string, unknown>` at the top level since this payload's
 * internal shape is owned by the .NET side — the Node service just relays it
 * verbatim. Tighten this type if/when the .NET contract stabilizes.
 */
export type WebhookPayload = Record<string, unknown>;

export interface ScheduleMessageRequest {
  messageId: string;
  conversationId: string;
  senderId: string;
  scheduledAt: string; // ISO-8601 datetime string, must be in the future
  webhookPayload: WebhookPayload;
}

export interface ScheduleMessageResponse {
  jobId: string;
  messageId: string;
  scheduledAt: string;
  delayMs: number;
  status: 'scheduled';
}

/** What's actually stored as the BullMQ job data. */
export interface DelayedMessageJobData {
  messageId: string;
  conversationId: string;
  senderId: string;
  scheduledAt: string;
  webhookPayload: WebhookPayload;
}

export interface RescheduleRequest {
  scheduledAt: string;
}

export interface JobDetailsResponse {
  id: string;
  name: string;
  data: DelayedMessageJobData;
  state: string;
  attemptsMade: number;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  failedReason?: string;
  delay: number;
}

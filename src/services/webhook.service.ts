import axios, { AxiosError } from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { DelayedMessageJobData } from '../interfaces/delayedMessage.interface';
import { Job } from 'bullmq';

const webhookClient = axios.create({
  baseURL: env.webhook.baseUrl,
  timeout: env.webhook.timeoutMs,
  headers: { 'Content-Type': 'application/json' },
});

export async function sendDelayedMessageWebhook(job: Job<DelayedMessageJobData>): Promise<void> {
  const data = job.data;
  const headers: Record<string, string> = {};
  if (env.webhook.authHeader && env.webhook.authToken) {
    headers[env.webhook.authHeader] = env.webhook.authToken;
  }

  try {
    const response = await webhookClient.post(
      env.webhook.path,
      {
        messageId: data.messageId,
        conversationId: data.conversationId,
        senderId: data.senderId,
        scheduledAt: data.scheduledAt,
        ...data.webhookPayload,
      },
      { headers }
    );

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Webhook returned non-2xx status: ${response.status}`);
    }

    logger.info({ messageId: data.messageId, jobId: job.id }, 'Webhook succeeded, job removed from Redis');
  } catch (err) {
    const axiosErr = err as AxiosError;
    logger.error(
      {
        messageId: data.messageId,
        status: axiosErr.response?.status,
        responseData: axiosErr.response?.data,
        message: axiosErr.message,
      },
      'Webhook call to .NET backend failed'
    );
    throw err;
  }
}
import { Request, Response } from 'express';
import { scheduleDelayedMessage } from '../services/schedule.service';
import { getJobById, cancelJob, rescheduleJob } from '../services/queue.service';
import { computeDelayMs } from '../utils/date';
import { ScheduleMessageRequest, RescheduleRequest } from '../interfaces/delayedMessage.interface';
import { AppError } from '../middleware/errorHandler';

export async function scheduleMessage(req: Request, res: Response): Promise<void> {

  const body = req.body as ScheduleMessageRequest;
  console.log("Message schedule hit" , body);
  const result = await scheduleDelayedMessage(body);
  console.log("Message schedule successfully !" , result);
  res.status(201).json(result);
}

export async function getJob(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const job = await getJobById(id);

  if (!job) {
    const err: AppError = new Error(`Job ${id} not found`);
    err.statusCode = 404;
    throw err;
  }

  res.status(200).json(job);
}

export async function deleteJob(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const removed = await cancelJob(id);

  if (!removed) {
    const err: AppError = new Error(`Job ${id} not found`);
    err.statusCode = 404;
    throw err;
  }

  res.status(200).json({ id, cancelled: true });
}

export async function patchJob(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { scheduledAt } = req.body as RescheduleRequest;

  const delayMs = computeDelayMs(scheduledAt);
  const updated = await rescheduleJob(id, scheduledAt, delayMs);

  res.status(200).json({ id, ...updated, delayMs, status: 'rescheduled' });
}

export function healthCheck(_req: Request, res: Response): void {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
}

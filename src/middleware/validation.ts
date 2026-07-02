import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

/**
 * Zod schemas double as runtime validation AND compile-time types.
 * scheduledAt is validated as a parseable date string; the "must be in the
 * future" business rule is enforced later in the service layer (so this
 * middleware stays a pure shape/format check).
 */
export const scheduleMessageSchema = z.object({
  messageId: z.string().min(1, 'messageId is required'),
  conversationId: z.string().min(1, 'conversationId is required'),
  senderId: z.string().min(1, 'senderId is required'),
  scheduledAt: z
    .string()
    .refine((val) => !Number.isNaN(new Date(val).getTime()), 'scheduledAt must be a valid ISO-8601 datetime'),
  webhookPayload: z.record(z.unknown()).default({}),
});

export const rescheduleSchema = z.object({
  scheduledAt: z
    .string()
    .refine((val) => !Number.isNaN(new Date(val).getTime()), 'scheduledAt must be a valid ISO-8601 datetime'),
});

/**
 * Generic middleware factory: validates req.body against a Zod schema,
 * replaces req.body with the parsed (and defaulted) result, or forwards a
 * 400 error to the error handler.
 */
export function validateBody(schema: z.ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const message = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      next(Object.assign(new Error(message), { statusCode: 400 }));
      return;
    }

    req.body = result.data;
    next();
  };
}

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { validateBody, scheduleMessageSchema, rescheduleSchema } from '../middleware/validation';
import {
  scheduleMessage,
  getJob,
  deleteJob,
  patchJob,
  healthCheck,
} from '../controllers/schedule.controller';

const router = Router();

router.get('/health', healthCheck);

router.post('/schedule-message', validateBody(scheduleMessageSchema), asyncHandler(scheduleMessage));

router.get('/jobs/:id', asyncHandler(getJob));
router.delete('/jobs/:id', asyncHandler(deleteJob));
router.patch('/jobs/:id', validateBody(rescheduleSchema), asyncHandler(patchJob));

export default router;

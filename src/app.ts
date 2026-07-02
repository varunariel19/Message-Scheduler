import express, { Express } from 'express';
import routes from './routes/schedule.routes';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

export function createApp(): Express {
  const app = express();

  app.use(express.json());

  // Lightweight request logging
  app.use((req, _res, next) => {
    logger.debug({ method: req.method, path: req.path }, 'Incoming request');
    next();
  });

  app.use('/', routes);

  // 404 handler for unmatched routes
  app.use((req, res) => {
    res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.path}`, statusCode: 404 } });
  });

  // Must be registered last
  app.use(errorHandler);

  return app;
}

import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { requestId } from './middleware/requestId';
import { errorHandler } from './middleware/errorHandler';
import { ApiError } from './lib/errors';
import { waypointsRouter } from './modules/waypoints/router';
import { chatRouter } from './modules/chat/router';
import { narrateRouter } from './modules/narrate/router';
import packageJson from '../package.json';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(requestId);

  // Visitor routes (§9) are intentionally open to any origin. No /admin/*
  // routes exist yet in this slice of the backend, so CORS_ALLOWED_ORIGINS
  // is read and validated but not yet enforced anywhere — the restriction
  // point belongs on the admin router once it exists.
  void env.CORS_ALLOWED_ORIGINS;
  app.use(cors());

  app.use(express.json({ limit: '100kb' }));

  app.get('/health', async (_req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', dbLatencyMs: Date.now() - start, version: packageJson.version });
    } catch (err) {
      next(err);
    }
  });

  app.use(waypointsRouter);
  app.use(chatRouter);
  app.use(narrateRouter);

  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(ApiError.notFound(`No route for ${req.method} ${req.path}`));
  });

  app.use(errorHandler);

  return app;
}

export const app = createApp();

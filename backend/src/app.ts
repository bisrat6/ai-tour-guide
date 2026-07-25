import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { ApiError } from './lib/errors.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestId } from './middleware/requestId.js';
import { healthRouter } from './modules/health/router.js';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(helmet());
  // Visitor routes (§9) are open; /admin/* gets the restricted policy
  // below once those routers land in D1-3+ (§7.4).
  app.use(cors());
  app.use(
    '/admin',
    cors({
      origin: env.CORS_ALLOWED_ORIGINS.length > 0 ? env.CORS_ALLOWED_ORIGINS : false,
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.use('/health', healthRouter);

  app.use((req, _res, next) => {
    next(ApiError.notFound(`No route for ${req.method} ${req.path}.`));
  });

  app.use(errorHandler);

  return app;
}

import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { ApiError } from './lib/errors.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestId } from './middleware/requestId.js';
import { authRouter } from './modules/auth/router.js';
import { healthRouter } from './modules/health/router.js';
import { museumsRouter } from './modules/museums/router.js';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(helmet());
  // Visitor routes (§9) are open; /admin/* gets the restricted CORS policy
  // below (§7.4).
  app.use(cors());
  app.use(
    '/admin',
    cors({
      origin: env.CORS_ALLOWED_ORIGINS.length > 0 ? env.CORS_ALLOWED_ORIGINS : false,
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.use('/health', healthRouter);
  app.use('/admin', authRouter);
  app.use('/admin', museumsRouter);

  app.use((req, _res, next) => {
    next(ApiError.notFound(`No route for ${req.method} ${req.path}.`));
  });

  app.use(errorHandler);

  return app;
}

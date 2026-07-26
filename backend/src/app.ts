import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { ApiError } from './lib/errors.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestId } from './middleware/requestId.js';
import { auditLogsRouter } from './modules/auditLogs/router.js';
import { authRouter } from './modules/auth/router.js';
import { billingRouter } from './modules/billing/router.js';
import { chatRouter } from './modules/chat/router.js';
import { healthRouter } from './modules/health/router.js';
import { itemsRouter } from './modules/items/router.js';
import { museumsRouter } from './modules/museums/router.js';
import { narrateRouter } from './modules/narrate/router.js';
import { roomsRouter } from './modules/rooms/router.js';
import { ticketsRouter } from './modules/tickets/router.js';
import { waypointsRouter } from './modules/waypoints/router.js';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestId);
  // cross-origin: visitor audio is loaded by the Flutter web/app origin via
  // <audio>/just_audio. Helmet's default CORP of "same-origin" blocks that
  // cross-origin media fetch even when CORS allows the JSON APIs, so chat
  // answers and room narration fail to play in the browser.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
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
  app.use('/admin', roomsRouter);
  app.use('/admin', itemsRouter);
  app.use('/admin', billingRouter);
  app.use('/admin', auditLogsRouter);
  // Visitor-facing, so mounted at the root rather than under /admin.
  app.use(ticketsRouter);
  app.use(waypointsRouter);
  app.use(chatRouter);
  app.use(narrateRouter);

  app.use((req, _res, next) => {
    next(ApiError.notFound(`No route for ${req.method} ${req.path}.`));
  });

  app.use(errorHandler);

  return app;
}

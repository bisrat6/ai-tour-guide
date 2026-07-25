import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { ApiError } from './lib/errors.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestId } from './middleware/requestId.js';
import { adminsRouter } from './modules/admins/router.js';
import { auditRouter } from './modules/audit/router.js';
import { authRouter } from './modules/auth/router.js';
import { billingRouter } from './modules/billing/router.js';
import { healthRouter } from './modules/health/router.js';
import { itemsRouter } from './modules/items/router.js';
import { museumsRouter } from './modules/museums/router.js';
import { overviewRouter } from './modules/overview/router.js';
import { roomsRouter } from './modules/rooms/router.js';
import { ticketsRouter } from './modules/tickets/router.js';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(helmet());

  /**
   * One CORS layer, not two (§7.4). A permissive app-wide `cors()` followed by
   * a restricted `/admin` one looked stricter than it was: the first layer
   * answers the preflight OPTIONS itself and ends the request, so the second
   * never ran, and on a real request it had already written
   * `Access-Control-Allow-Origin: *` that the second layer then declined to
   * overwrite. Deciding per-request keeps the restriction real.
   *
   * X-Request-Id is exposed explicitly. The browser hides every non-simple
   * response header from cross-origin JS, so without this the client's
   * fallback read of it silently returns null and a report loses its trace id.
   */
  const allowedOrigins = env.CORS_ALLOWED_ORIGINS;
  app.use(
    cors({
      origin(origin, callback) {
        // Visitor routes (§9) are open to any origin. Admin routes are not, but
        // the origin check for them happens below where the path is known.
        if (allowedOrigins.length === 0 || origin === undefined) {
          callback(null, true);
          return;
        }
        callback(null, allowedOrigins.includes(origin));
      },
      exposedHeaders: ['X-Request-Id'],
    }),
  );

  /**
   * Enforced after CORS rather than inside it: a browser already refuses a
   * disallowed origin at the preflight, but a non-browser caller ignores CORS
   * entirely, and `/admin` should not answer one just because it did.
   */
  if (allowedOrigins.length > 0) {
    app.use('/admin', (req, _res, next) => {
      const origin = req.headers.origin;
      if (origin !== undefined && !allowedOrigins.includes(origin)) {
        next(ApiError.forbidden('This origin is not allowed to call the admin API.'));
        return;
      }
      next();
    });
  }

  app.use(express.json({ limit: '100kb' }));

  app.use('/health', healthRouter);
  app.use('/admin', authRouter);
  app.use('/admin', museumsRouter);
  app.use('/admin', adminsRouter);
  app.use('/admin', roomsRouter);
  app.use('/admin', itemsRouter);
  app.use('/admin', billingRouter);
  app.use('/admin', auditRouter);
  app.use('/admin', overviewRouter);
  // Visitor-facing, so mounted at the root rather than under /admin.
  app.use(ticketsRouter);

  app.use((req, _res, next) => {
    next(ApiError.notFound(`No route for ${req.method} ${req.path}.`));
  });

  app.use(errorHandler);

  return app;
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { requestId } from './middleware/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { ApiError } from './lib/errors.js';
import { devRouter } from './modules/dev/router.js';
import { ticketsRouter } from './modules/tickets/router.js';
import { billingRouter } from './modules/billing/router.js';

const app = express();

// ── Request ID (first, so every response and log carries it) ─────────────────
app.use(requestId);

// ── Security ─────────────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS — open for visitor routes, restricted for /admin/* ──────────────────
const allowedOrigins = (process.env['CORS_ALLOWED_ORIGINS'] ?? '').split(',').filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }),
);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', async (_req, res, next) => {
  const start = Date.now();
  try {
    const { prisma } = await import('./lib/prisma.js');
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      dbLatencyMs: Date.now() - start,
      version: process.env['npm_package_version'] ?? '0.1.0',
    });
  } catch (err) {
    next(err);
  }
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use(ticketsRouter);
app.use(billingRouter);

// ── Dev-only routes ───────────────────────────────────────────────────────────
if (process.env['NODE_ENV'] !== 'production') {
  app.use(devRouter);

  // Dev room-create route: exercises requireWithinTierLimit before Dev 1's
  // real POST /admin/rooms exists. Move this stub to the real route in Phase 4.
  const { requireAuth } = await import('./middleware/requireAuth.js');
  const { requireWithinTierLimit } = await import('./middleware/requireWithinTierLimit.js');
  const { asyncHandler } = await import('./lib/asyncHandler.js');
  const { prisma } = await import('./lib/prisma.js');

  app.post(
    '/dev/rooms',
    requireAuth,
    requireWithinTierLimit('room', async (req) => {
      // Use the admin's own museumId, or the body's museumId for system admins
      const admin = req.admin;
      if (admin.role === 'SYSTEM_ADMIN') {
        const bodyMuseumId = (req.body as { museumId?: string }).museumId;
        if (!bodyMuseumId) throw ApiError.badRequest('museumId required for system admin');
        return bodyMuseumId;
      }
      if (!admin.museumId) throw ApiError.badRequest('No museum associated with this account');
      return admin.museumId;
    }),
    asyncHandler(async (req, res) => {
      const { title, roomOverviewText, narrationScript, storyOrder, museumId: bodyMuseumId } = req.body as {
        title?: string;
        roomOverviewText?: string;
        narrationScript?: string;
        storyOrder?: number;
        museumId?: string;
      };

      const museumId = req.admin.role === 'SYSTEM_ADMIN' ? (bodyMuseumId ?? '') : (req.admin.museumId ?? '');
      if (!museumId || !title) throw ApiError.badRequest('museumId and title are required');

      const room = await prisma.room.create({
        data: {
          museumId,
          title: title,
          roomOverviewText: roomOverviewText ?? '',
          narrationScript: narrationScript ?? '',
          storyOrder: storyOrder ?? 1,
        },
      });
      res.status(201).json(room);
    }),
  );
}

// ── 404 for unmatched routes ──────────────────────────────────────────────────
app.use((_req, _res, next) => {
  next(ApiError.notFound('Route'));
});

// ── Terminal error handler ────────────────────────────────────────────────────
app.use(errorHandler);

export { app };

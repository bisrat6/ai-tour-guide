import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';

const app = createApp();
const server = createServer(app);

server.listen(env.PORT, () => {
  logger.info(`Backend listening on port ${env.PORT} (${env.NODE_ENV}).`);
});

let shuttingDown = false;

function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}, shutting down gracefully...`);

  server.close(() => {
    prisma
      .$disconnect()
      .catch((err: unknown) => logger.error({ err }, 'Error disconnecting Prisma.'))
      .finally(() => {
        logger.info('Shutdown complete.');
        process.exit(0);
      });
  });

  setTimeout(() => {
    logger.error('Forced shutdown after 10s timeout.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

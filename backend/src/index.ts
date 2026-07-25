// Validate env eagerly — process exits with a readable error if anything is wrong
import './config/env.js';
import { app } from './app.js';

const port = Number(process.env['PORT'] ?? 3000);

const server = app.listen(port, () => {
  console.log(`[adwa-backend] listening on port ${port} (NODE_ENV=${process.env['NODE_ENV'] ?? 'development'})`);
});

// ── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown(signal: string) {
  console.log(`[adwa-backend] ${signal} received — shutting down`);
  server.close(async () => {
    try {
      const { prisma } = await import('./lib/prisma.js');
      await prisma.$disconnect();
    } catch {
      // best-effort
    }
    process.exit(0);
  });
  // Force exit after 10 s if close hangs
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

import type { AdminRole } from '@prisma/client';
import type { Logger } from 'pino';

export interface AdminContext {
  id: string;
  role: AdminRole;
  museumId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      log: Logger;
      admin?: AdminContext;
    }
  }
}

export {};

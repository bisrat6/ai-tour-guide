import type { Logger } from 'pino';

export interface AdminContext {
  id: string;
  role: 'SYSTEM_ADMIN' | 'MUSEUM_ADMIN';
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

export interface MockAdminContext {
  id: string;
  role: 'SYSTEM_ADMIN' | 'MUSEUM_ADMIN';
  museumId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: MockAdminContext;
      requestId: string;
    }
  }
}

export interface MockAdminContext {
  id: string;
  role: 'SYSTEM_ADMIN' | 'MUSEUM_ADMIN';
  museumId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      admin?: MockAdminContext;
      requestId: string;
    }
  }
}

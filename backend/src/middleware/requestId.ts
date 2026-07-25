import type { Request, Response, NextFunction } from 'express';
import { ulid } from 'ulid';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers['x-request-id'] as string | undefined) ?? `req_${ulid()}`;
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

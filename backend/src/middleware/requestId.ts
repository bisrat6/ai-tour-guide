import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

/** Assigns a request ID to every request, echoed on the response and on every log line (§7.1). */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('X-Request-Id');
  const id = incoming && incoming.length > 0 ? incoming : crypto.randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

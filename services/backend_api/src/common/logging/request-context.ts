import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

export interface RequestContextStore {
  requestId: string;
  method: string;
  url: string;
}

export const requestContext = new AsyncLocalStorage<RequestContextStore>();

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  res.setHeader('x-request-id', requestId);
  requestContext.run({ requestId, method: req.method, url: req.originalUrl }, next);
}

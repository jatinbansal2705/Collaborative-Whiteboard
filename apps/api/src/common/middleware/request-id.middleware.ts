import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const REQUEST_ID_HEADER = 'x-request-id';

export function requestId(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const headerValue = req.headers[REQUEST_ID_HEADER];
  const id =
    typeof headerValue === 'string' && headerValue.length > 0
      ? headerValue
      : randomUUID();

  req.id = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}

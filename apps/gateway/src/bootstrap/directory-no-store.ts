import type { NextFunction, Request, Response } from 'express';

/**
 * Directory responses are never cacheable. Handlers declare `no-store` themselves, but a guard or pipe can reject a
 * request before the handler's header applies, so set it for every directory path up front.
 */
export function applyDirectoryNoStore(
  request: Request,
  response: Response,
  next: NextFunction
): void {
  if (/^\/api\/directory(\/|$)/.test(request.path))
    response.setHeader('Cache-Control', 'no-store');
  next();
}

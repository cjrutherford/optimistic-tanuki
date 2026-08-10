import type { RequestHandler } from 'express';
import type { ServerSessionRequest } from './server-session-validation';

export const protectedRoutePaths = [
  '/projects',
  '/profile',
  '/settings',
  '/messages',
  '/messages/new',
] as const;

export type SessionValidator = (
  request: ServerSessionRequest
) => Promise<boolean>;

const matchesProtectedRoute = (path: string, route: string): boolean =>
  path === route || path.startsWith(`${route}/`);

export const requiresSessionValidation = (path: string): boolean =>
  protectedRoutePaths.some((route) => matchesProtectedRoute(path, route));

export function createProtectedRouteGate({
  validateSession,
}: {
  validateSession: SessionValidator;
}): RequestHandler {
  return async (request, response, next) => {
    if (!requiresSessionValidation(request.path)) {
      next();
      return;
    }

    try {
      if (await validateSession(request)) {
        next();
        return;
      }
    } catch {
      // A validator failure is indistinguishable from an invalid session.
    }

    response.redirect(
      `/login?returnUrl=${encodeURIComponent(request.originalUrl)}`
    );
  };
}

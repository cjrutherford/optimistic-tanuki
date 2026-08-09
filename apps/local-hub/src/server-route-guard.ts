import type { RequestHandler } from 'express';
import type { ServerSessionRequest } from './server-session-validation';

const PROTECTED_ROUTES = [
  '/account',
  '/seller-dashboard',
  '/messages',
  '/messages/new',
];

const MEMBER_ROUTES = [
  '/city/:slug/classifieds/new',
  '/c/:communitySlug/classifieds/new',
];

export type SessionValidator = (
  request: ServerSessionRequest
) => Promise<boolean>;

const matchesRoute = (path: string, route: string): boolean => {
  if (!route.includes(':')) {
    return path.startsWith(route);
  }

  const pattern = route.replace(/:[^/]+/g, '[^/]+');
  return new RegExp(`^${pattern}$`).test(path);
};

export const requiresSessionValidation = (path: string): boolean =>
  PROTECTED_ROUTES.some((route) => matchesRoute(path, route)) ||
  MEMBER_ROUTES.some((route) => matchesRoute(path, route));

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

    if (await validateSession(request)) {
      next();
      return;
    }

    const returnUrl =
      (request.query['returnUrl'] as string) || request.originalUrl;
    const loginUrl = `/login${
      returnUrl && returnUrl !== '/'
        ? `?returnUrl=${encodeURIComponent(returnUrl)}`
        : ''
    }`;
    response.redirect(loginUrl);
  };
}

import { createGatewaySessionValidator } from './server-session-validation';
import {
  createProtectedRouteGate,
  requiresSessionValidation,
} from './server-route-guard';
import { appRoutes } from './app/app.routes';
import { AuthGuard } from './app/guards/auth.guard';
import { MemberGuard } from './app/guards/member.guard';

describe('createProtectedRouteGate', () => {
  const request = (path: string, originalUrl = path, query = {}) =>
    ({ path, originalUrl, query, cookies: {}, headers: {} } as any);
  const response = () => ({ redirect: jest.fn() } as any);

  it('continues SSR rendering when the gateway validates a protected session', async () => {
    const next = jest.fn();
    const res = response();
    const validateSession = jest.fn().mockResolvedValue(true);

    await createProtectedRouteGate({ validateSession })(
      request('/account'),
      res,
      next
    );

    expect(validateSession).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('redirects a protected deep link when no credential is present', async () => {
    const next = jest.fn();
    const res = response();

    await createProtectedRouteGate({
      validateSession: jest.fn().mockResolvedValue(false),
    })(request('/account', '/account?tab=profile'), res, next);

    expect(res.redirect).toHaveBeenCalledWith(
      '/login?returnUrl=%2Faccount%3Ftab%3Dprofile'
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('redirects a protected deep link when the gateway rejects its credential', async () => {
    const next = jest.fn();
    const res = response();

    await createProtectedRouteGate({
      validateSession: jest.fn().mockResolvedValue(false),
    })(request('/seller-dashboard'), res, next);

    expect(res.redirect).toHaveBeenCalledWith(
      '/login?returnUrl=%2Fseller-dashboard'
    );
  });

  it('redirects a protected deep link when gateway validation times out', async () => {
    const timeoutFetch = jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_, reject) =>
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('gateway validation timed out'))
          )
        )
    );
    const res = response();
    const next = jest.fn();
    const validateSession = createGatewaySessionValidator({
      gatewayUrl: 'http://gateway:3000',
      fetch: timeoutFetch as any,
      timeoutMs: 1,
    });

    await createProtectedRouteGate({ validateSession })(
      request('/messages/new', '/messages/new?recipient=neighbor'),
      res,
      next
    );

    expect(res.redirect).toHaveBeenCalledWith(
      '/login?returnUrl=%2Fmessages%2Fnew%3Frecipient%3Dneighbor'
    );
    expect(next).not.toHaveBeenCalled();
  });
});

describe('Express route protection policy', () => {
  it('covers every Angular AuthGuard or MemberGuard route', () => {
    const guardedPaths = appRoutes
      .filter((route) =>
        route.canActivate?.some(
          (guard) => guard === AuthGuard || guard === MemberGuard
        )
      )
      .map((route) => `/${route.path?.replace(/:[^/]+/g, 'test-route-value')}`);

    expect(guardedPaths).toEqual(
      expect.arrayContaining([
        '/account',
        '/seller-dashboard',
        '/messages',
        '/messages/new',
        '/city/test-route-value/classifieds/new',
        '/c/test-route-value/classifieds/new',
      ])
    );
    for (const path of guardedPaths) {
      expect(requiresSessionValidation(path)).toBe(true);
    }
  });
});

import { appRoutes } from './app/app.routes';
import { AuthenticationGuard } from './app/authentication.guard';
import { ProfileGuard } from './app/profile.guard';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createProtectedRouteGate,
  protectedRoutePaths,
  requiresSessionValidation,
} from './server-route-guard';

describe('createProtectedRouteGate', () => {
  const request = (path: string, originalUrl = path) =>
    ({ path, originalUrl, cookies: {}, headers: {} } as any);
  const response = () => ({ redirect: jest.fn() } as any);

  it('continues to the client-only shell only after a valid session', async () => {
    const next = jest.fn();
    const res = response();
    const validateSession = jest.fn().mockResolvedValue(true);

    await createProtectedRouteGate({ validateSession })(
      request('/projects'),
      res,
      next
    );

    expect(validateSession).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('redirects a missing session from a protected deep link', async () => {
    const next = jest.fn();
    const res = response();

    await createProtectedRouteGate({
      validateSession: jest.fn().mockResolvedValue(false),
    })(request('/projects', '/projects?view=active'), res, next);

    expect(res.redirect).toHaveBeenCalledWith(
      '/login?returnUrl=%2Fprojects%3Fview%3Dactive'
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('redirects an invalid session from every protected route family', async () => {
    for (const path of protectedRoutePaths) {
      const res = response();
      const next = jest.fn();
      await createProtectedRouteGate({
        validateSession: jest.fn().mockResolvedValue(false),
      })(request(path), res, next);

      expect(res.redirect).toHaveBeenCalledWith(
        `/login?returnUrl=${encodeURIComponent(path)}`
      );
      expect(next).not.toHaveBeenCalled();
    }
  });

  it('protects nested paths without matching similarly named public paths', () => {
    expect(requiresSessionValidation('/messages/new')).toBe(true);
    expect(requiresSessionValidation('/messages/new/thread-1')).toBe(true);
    expect(requiresSessionValidation('/projects/archive')).toBe(true);
    expect(requiresSessionValidation('/projects-archive')).toBe(false);
  });

  it('never gates the client-only OAuth callback behind a session check', async () => {
    // The callback shell redeems its one-time grant in the browser; a server
    // validation here would spend a gateway RPC per login and bounce an
    // in-flight login back to /login before redemption completes.
    expect(requiresSessionValidation('/oauth/callback')).toBe(false);
    expect(requiresSessionValidation('/oauth/callback/google')).toBe(false);

    const next = jest.fn();
    const res = response();
    const validateSession = jest.fn();
    await createProtectedRouteGate({ validateSession })(
      request(
        '/oauth/callback/google',
        '/oauth/callback/google?callbackCode=x'
      ),
      res,
      next
    );

    expect(validateSession).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
    expect(res.redirect).not.toHaveBeenCalled();
  });
});

describe('Forge server route policy', () => {
  it('places the gate after the API proxy and before static or Angular rendering', () => {
    const serverSource = readFileSync(join(__dirname, 'server.ts'), 'utf8');
    const apiProxy = serverSource.indexOf("'/api'");
    const sessionGate = serverSource.indexOf(
      'app.use(createProtectedRouteGate({ validateSession: validateGatewaySession }));'
    );
    const staticRendering = serverSource.indexOf(
      'express.static(browserDistFolder'
    );
    const angularRendering = serverSource.indexOf("app.use('/**'");

    expect(apiProxy).toBeGreaterThanOrEqual(0);
    expect(sessionGate).toBeGreaterThan(apiProxy);
    expect(staticRendering).toBeGreaterThan(sessionGate);
    expect(angularRendering).toBeGreaterThan(staticRendering);
  });

  it('covers every Angular AuthenticationGuard or ProfileGuard route exactly', () => {
    const guardedPaths = appRoutes
      .filter((route) =>
        route.canActivate?.some(
          (guard) => guard === AuthenticationGuard || guard === ProfileGuard
        )
      )
      .map((route) => `/${route.path}`)
      .sort();

    expect([...protectedRoutePaths].sort()).toEqual(guardedPaths);
    for (const path of guardedPaths) {
      expect(requiresSessionValidation(path)).toBe(true);
    }
  });
});

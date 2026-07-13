import {
  emailAuthRoutes,
  parseEmailActionToken,
} from './email-action.component';

describe('parseEmailActionToken', () => {
  it('reads the token from a URL fragment', () => {
    expect(parseEmailActionToken('#token=abc%20123')).toBe('abc 123');
  });

  it('creates all three app-local callback routes with the app storage key', () => {
    const routes = emailAuthRoutes('product-auth-token');
    expect(routes.map((route) => route.path)).toEqual([
      'auth/verify',
      'auth/magic-link',
      'auth/reset-password',
    ]);
    expect(routes[0].data?.['storageKey']).toBe('product-auth-token');
  });

  it('returns an empty value when the token is absent', () => {
    expect(parseEmailActionToken('#other=value')).toBe('');
  });
});

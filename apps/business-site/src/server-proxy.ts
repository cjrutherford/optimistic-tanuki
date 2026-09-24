const CLIENT_ORIGIN_PATH_PREFIX = '/api/oauth/';

/**
 * Whether the SSR API proxy must forward the browser's Origin untouched.
 *
 * The gateway redeem check requires `Origin` to equal the OAuth grant's app
 * origin, so rewriting it to the gateway origin 401s every OAuth redeem
 * proxied through business-site and bounces the login back to /login.
 * Non-OAuth paths keep the existing gateway-origin rewrite.
 */
export function shouldPreserveClientOrigin(originalUrl: string): boolean {
  const path = originalUrl.split('?')[0];
  // The proxy middleware may see the mount-stripped path (/oauth/...) rather
  // than the full original URL (/api/oauth/...); accept both spellings.
  return (
    path === '/api/oauth' ||
    path.startsWith(CLIENT_ORIGIN_PATH_PREFIX) ||
    path === '/oauth' ||
    path.startsWith('/oauth/')
  );
}

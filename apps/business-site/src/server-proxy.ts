import type { RequestHandler } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';

const CLIENT_AUTHORITY_PATHS = [
  '/api/oauth',
  '/api/authentication',
  '/oauth',
  '/authentication',
];

/**
 * Whether the SSR API proxy must forward the browser's public Host untouched.
 *
 * The gateway redeem check requires the public Host, and the authentication
 * registry resolves registration from Origin plus Host. Origin is preserved
 * for every API path because the gateway validates it against its CORS allowlist.
 */
export function shouldPreserveClientHost(originalUrl: string): boolean {
  const path = originalUrl.split('?')[0];
  // The proxy middleware may see the mount-stripped path (/oauth/...) rather
  // than the full original URL (/api/oauth/...); accept both spellings.
  return CLIENT_AUTHORITY_PATHS.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}
export function createBusinessApiProxy(gatewayUrl: string): RequestHandler {
  const gatewayHost = new URL(gatewayUrl).host;
  const proxy = createProxyMiddleware({
    target: `${gatewayUrl}/api`,
    ws: true,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq, req) => {
        const appRequest = req as typeof req & {
          businessPublicHost?: string;
        };
        const originalUrl = (req as { originalUrl?: unknown }).originalUrl;
        const rawUrl =
          typeof originalUrl === 'string'
            ? originalUrl
            : typeof req.url === 'string'
            ? req.url
            : '';
        if (shouldPreserveClientHost(rawUrl) && appRequest.businessPublicHost) {
          proxyReq.setHeader('host', appRequest.businessPublicHost);
        } else {
          proxyReq.setHeader('host', gatewayHost);
        }
        if (req.headers.origin) {
          proxyReq.setHeader('origin', req.headers.origin);
        }
        // Write parsed JSON only after setting headers; writing can flush the
        // outgoing request and make subsequent Host/Origin changes too late.
        fixRequestBody(proxyReq, req);
      },
    },
  });
  return (req, res, next) => {
    const appRequest = req as typeof req & {
      businessPublicHost?: string;
    };
    appRequest.businessPublicHost = req.headers.host;
    return proxy(req, res, next);
  };
}

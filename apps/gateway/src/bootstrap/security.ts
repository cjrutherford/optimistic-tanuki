import type { Request, Response, NextFunction } from 'express';
import type { AppRegistry } from '@optimistic-tanuki/app-registry-backend';

const UNSAFE_HTTP_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
const PRODUCTION = process.env['NODE_ENV'] === 'production';
const DEV_ALLOW_ALL_BROWSER_ORIGINS =
  !PRODUCTION && process.env['DEV_ALLOW_ALL_BROWSER_ORIGINS'] === 'true';

const trimOrigin = (value: string): string => value.trim().replace(/\/$/, '');

export const parseConfiguredOrigins = (
  value = process.env['CORS_ALLOWED_ORIGINS'] ||
    process.env['CORS_ORIGIN'] ||
    ''
): string[] =>
  value
    .split(',')
    .map((entry) => trimOrigin(entry))
    .filter((entry) => entry.length > 0 && entry !== '*');

export const getTrustedOrigins = ({
  configuredOrigins = parseConfiguredOrigins(),
  registry,
}: {
  configuredOrigins?: string[];
  registry?: AppRegistry;
} = {}): string[] => {
  const trustedOrigins = new Set<string>();

  for (const origin of configuredOrigins) {
    const normalizedOrigin = normalizeOrigin(origin);
    if (normalizedOrigin) {
      trustedOrigins.add(normalizedOrigin);
    }
  }

  for (const app of registry?.apps ?? []) {
    const normalizedOrigin = normalizeOrigin(app.uiBaseUrl);
    if (normalizedOrigin) {
      trustedOrigins.add(normalizedOrigin);
    }
  }

  return [...trustedOrigins];
};

export const originHost = (origin: string): string | null => {
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
};

export const normalizeOrigin = (origin: string): string | null => {
  try {
    return trimOrigin(new URL(origin).origin);
  } catch {
    return null;
  }
};

export const isLoopbackOrigin = (origin: string): boolean => {
  const host = originHost(origin);
  return host ? LOCALHOST_HOSTNAMES.has(host) : false;
};

export const isPrivateNetworkHost = (host: string): boolean => {
  return (
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)
  );
};

export const isTailnetHost = (host: string): boolean =>
  host.endsWith('.ts.net');

export const isNonProductionDevelopmentOrigin = (origin: string): boolean => {
  if (PRODUCTION) {
    return false;
  }

  const host = originHost(origin);
  if (!host) {
    return false;
  }

  return (
    LOCALHOST_HOSTNAMES.has(host) ||
    isPrivateNetworkHost(host) ||
    isTailnetHost(host)
  );
};

export const isAllowedOrigin = (
  origin: string,
  configuredOrigins = parseConfiguredOrigins()
): boolean => {
  if (DEV_ALLOW_ALL_BROWSER_ORIGINS) {
    return true;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) {
    return false;
  }

  if (
    configuredOrigins.some(
      (entry) => normalizeOrigin(entry) === normalizedOrigin
    )
  ) {
    return true;
  }

  return isNonProductionDevelopmentOrigin(normalizedOrigin);
};

export const getRequestOrigin = (request: Request): string => {
  const forwardedProto = request.get('x-forwarded-proto');
  const forwardedHost = request.get('x-forwarded-host');
  const proto = forwardedProto?.split(',')[0]?.trim() || request.protocol;
  const host = forwardedHost?.split(',')[0]?.trim() || request.get('host');
  return `${proto}://${host}`;
};

export const isProxiedRequest = (request: Request): boolean => {
  return !!(
    request.get('x-forwarded-host') || request.get('x-forwarded-proto')
  );
};

export const shouldRejectBrowserMutation = (
  request: Request,
  trustedOrigins = parseConfiguredOrigins()
): boolean => {
  if (!UNSAFE_HTTP_METHODS.has(request.method.toUpperCase())) {
    return false;
  }

  const secFetchSite = request.get('sec-fetch-site');
  const originHeader = request.get('origin');

  if (!originHeader) {
    return secFetchSite === 'cross-site';
  }

  const normalizedOrigin = normalizeOrigin(originHeader);
  if (!normalizedOrigin) {
    return true;
  }

  if (normalizedOrigin === getRequestOrigin(request)) {
    if (!isProxiedRequest(request)) {
      return false;
    }

    return !isAllowedOrigin(normalizedOrigin, trustedOrigins);
  }

  return !isAllowedOrigin(normalizedOrigin, trustedOrigins);
};

export const applyGatewaySecurityHeaders = (
  request: Request,
  response: Response,
  next: NextFunction
): void => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader(
    'Permissions-Policy',
    'camera=(), geolocation=(), microphone=(), payment=(), usb=()'
  );
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-site');

  if (request.path.startsWith('/api')) {
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
    );
  }

  const forwardedProto = request.get('x-forwarded-proto');
  if (request.secure || forwardedProto?.includes('https')) {
    response.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  next();
};

export const enforceTrustedBrowserOrigins = (
  request: Request,
  response: Response,
  next: NextFunction,
  trustedOrigins = parseConfiguredOrigins()
): void => {
  if (shouldRejectBrowserMutation(request, trustedOrigins)) {
    response.status(403).json({
      message: 'Cross-site browser mutations are not allowed.',
    });
    return;
  }

  next();
};

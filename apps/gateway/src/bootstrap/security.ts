import type { Request, Response, NextFunction } from 'express';

const UNSAFE_HTTP_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
const PRODUCTION = process.env['NODE_ENV'] === 'production';

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

export const isAllowedOrigin = (
  origin: string,
  configuredOrigins = parseConfiguredOrigins()
): boolean => {
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

  return !PRODUCTION && isLoopbackOrigin(normalizedOrigin);
};

export const getRequestOrigin = (request: Request): string => {
  const forwardedProto = request.get('x-forwarded-proto');
  const forwardedHost = request.get('x-forwarded-host');
  const proto = forwardedProto?.split(',')[0]?.trim() || request.protocol;
  const host = forwardedHost?.split(',')[0]?.trim() || request.get('host');
  return `${proto}://${host}`;
};

export const shouldRejectBrowserMutation = (
  request: Request,
  configuredOrigins = parseConfiguredOrigins()
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
    return false;
  }

  return !isAllowedOrigin(normalizedOrigin, configuredOrigins);
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
  next: NextFunction
): void => {
  if (shouldRejectBrowserMutation(request)) {
    response.status(403).json({
      message: 'Cross-site browser mutations are not allowed.',
    });
    return;
  }

  next();
};

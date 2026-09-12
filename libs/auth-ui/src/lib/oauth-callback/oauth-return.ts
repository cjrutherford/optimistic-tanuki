export interface AuthReturnTarget {
  origin: string;
  path: string;
  href: string;
  isCurrentOrigin: boolean;
}

export interface AuthReturnNormalizationOptions {
  currentOrigin: string;
  registeredOrigins?: readonly string[];
  /**
   * What an auth page (/login, /register, an OAuth callback) resolves to.
   * 'reject' (the default) returns null, which guards and login pages rely on
   * to apply their own fallback. 'origin-root' returns the root of the
   * validated origin instead — for the OAuth callback, which must still redeem
   * when sign-in was started from the login page itself.
   */
  authLoopFallback?: 'reject' | 'origin-root';
}

const AUTH_LOOP_PATHS = new Set([
  '/login',
  '/register',
  '/auth/login',
  '/auth/register',
  '/authentication/login',
  '/authentication/register',
  '/oauth/callback',
]);

export function normalizeAuthReturnTo(
  returnTo: string | null | undefined,
  options: AuthReturnNormalizationOptions
): AuthReturnTarget | null {
  if (
    !returnTo ||
    returnTo.trim() !== returnTo ||
    hasControlCharacter(returnTo) ||
    returnTo.includes('\\') ||
    returnTo.startsWith('//')
  ) {
    return null;
  }

  const currentOrigin = normalizeOrigin(options.currentOrigin);
  if (!currentOrigin) return null;

  const registeredOrigins = new Set(
    (options.registeredOrigins || [])
      .map((origin) => normalizeOrigin(origin))
      .filter((origin): origin is string => !!origin)
  );
  registeredOrigins.add(currentOrigin);

  let target: URL;
  try {
    target = new URL(returnTo, currentOrigin);
  } catch {
    return null;
  }

  if (
    !['http:', 'https:'].includes(target.protocol) ||
    !registeredOrigins.has(target.origin) ||
    (!returnTo.startsWith('/') && !isAbsoluteUrl(returnTo))
  ) {
    return null;
  }

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(target.pathname || '/');
  } catch {
    return null;
  }

  const normalizedPath = decodedPath.replace(/\/+$/, '') || '/';
  if (
    !decodedPath.startsWith('/') ||
    decodedPath.startsWith('//') ||
    decodedPath.includes('\\') ||
    hasControlCharacter(decodedPath)
  ) {
    return null;
  }

  if (
    AUTH_LOOP_PATHS.has(normalizedPath.toLowerCase()) ||
    normalizedPath.toLowerCase().startsWith('/oauth/callback/')
  ) {
    if (options.authLoopFallback !== 'origin-root') return null;
    return {
      origin: target.origin,
      path: '/',
      href: `${target.origin}/`,
      isCurrentOrigin: target.origin === currentOrigin,
    };
  }

  const path = `${target.pathname || '/'}${target.search}${target.hash}`;
  return {
    origin: target.origin,
    path,
    href: `${target.origin}${path}`,
    isCurrentOrigin: target.origin === currentOrigin,
  };
}

function isAbsoluteUrl(value: string): boolean {
  return /^[a-z][a-z\d+.-]*:\/\//i.test(value);
}

function normalizeOrigin(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.origin !== value
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

import { JwtService } from '@nestjs/jwt';
import {
  isRollingSessionApp,
  SESSION_IDLE_WINDOW_MS,
} from '@optimistic-tanuki/models';

/** An expired legacy OT/TS JWT is usable only after Auth's authoritative idle check. */
export async function verifySessionToken<T extends object & { appId?: string }>(
  jwt: Pick<JwtService, 'verifyAsync'>,
  token: string
): Promise<T> {
  try {
    return await jwt.verifyAsync<T>(token);
  } catch (error) {
    if ((error as Error)?.name !== 'TokenExpiredError') throw error;
    const payload = await jwt.verifyAsync<T>(token, { ignoreExpiration: true });
    if (!isRollingSessionApp(payload.appId)) throw error;
    return payload;
  }
}
export function sessionCookieOptions(appId?: unknown) {
  const secure = process.env.AUTH_COOKIE_SECURE;
  return {
    httpOnly: true,
    secure:
      secure === undefined
        ? process.env.NODE_ENV === 'production'
        : secure === 'true',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: isRollingSessionApp(appId)
      ? SESSION_IDLE_WINDOW_MS
      : 60 * 60 * 1000,
  };
}
/** Only trusted Auth RPC issuance responses use this scope hint; it grants no access. */
export function issuedSessionCookieOptions(token: string) {
  const payload = new JwtService().decode<{ appId?: string }>(token);
  return sessionCookieOptions(payload?.appId);
}

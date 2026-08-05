import { JwtService } from '@nestjs/jwt';

type OwnerTokenPayload = { profileId?: string };
type OwnerRole = { name?: string; role?: { name?: string } };

const OWNER_ROLE_NAMES = new Set([
  'owner_console_owner',
  'owner',
  'global_admin',
  'system_admin',
]);

export type AdminApiAuthorizationOptions = {
  authorization?: string;
  cookieHeader?: string;
  jwtSecret?: string;
  gatewayUrl: string;
  fetchImpl?: typeof fetch;
  verifyToken?: (token: string, secret: string) => OwnerTokenPayload;
};

function getSessionToken(
  authorization: string | undefined,
  cookieHeader: string | undefined
): string | undefined {
  const [scheme, bearerToken] = authorization?.split(' ') ?? [];
  if (scheme === 'Bearer' && bearerToken) {
    return bearerToken;
  }

  const sessionCookie = cookieHeader
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('ot_session='));
  if (!sessionCookie) return undefined;

  try {
    return decodeURIComponent(sessionCookie.slice('ot_session='.length));
  } catch {
    return undefined;
  }
}

export async function authorizeOwnerConsoleAdminRequest(
  options: AdminApiAuthorizationOptions
): Promise<{ authorized: true } | { authorized: false; status: 401 | 403 }> {
  const token = getSessionToken(options.authorization, options.cookieHeader);
  if (!token || !options.jwtSecret) {
    return { authorized: false, status: 401 };
  }

  let payload: OwnerTokenPayload;
  try {
    payload = (
      options.verifyToken ??
      ((value, secret) =>
        new JwtService({ secret }).verify<OwnerTokenPayload>(value))
    )(token, options.jwtSecret);
  } catch {
    return { authorized: false, status: 401 };
  }
  if (!payload.profileId) return { authorized: false, status: 403 };

  try {
    const response = await (options.fetchImpl ?? fetch)(
      `${options.gatewayUrl}/api/permissions/user-roles/${encodeURIComponent(
        payload.profileId
      )}?appScope=owner-console`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-ot-appscope': 'owner-console',
        },
      }
    );
    if (!response.ok) return { authorized: false, status: 401 };
    const roles = (await response.json()) as OwnerRole[];
    return roles.some((role) =>
      OWNER_ROLE_NAMES.has(role.role?.name ?? role.name ?? '')
    )
      ? { authorized: true }
      : { authorized: false, status: 403 };
  } catch {
    return { authorized: false, status: 401 };
  }
}

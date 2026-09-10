export const BUSINESS_SITE_APP_SCOPE = 'business-site' as const;

export type BusinessAuthStateStatus =
  | 'signed-out'
  | 'loading'
  | 'signed-in'
  | 'expired';

export type BusinessSessionKind = 'owner' | 'client';

export interface BusinessIdentity {
  userId: string;
  profileId: string;
  email: string;
  name?: string;
}

export interface BusinessSessionMetadata {
  kind: BusinessSessionKind;
  appScope: typeof BUSINESS_SITE_APP_SCOPE;
  transport: 'cookie';
}

export interface BusinessAuthRecoveryIntent {
  reason: 'unauthorized' | 'expired';
  returnTo: string | null;
}

export interface BusinessAuthState {
  status: BusinessAuthStateStatus;
  identity: BusinessIdentity | null;
  session: BusinessSessionMetadata | null;
  recovery: BusinessAuthRecoveryIntent | null;
}

export type BusinessAuthStateEvent =
  | { type: 'restore-start' }
  | {
      type: 'restore-success';
      identity: BusinessIdentity;
      session: BusinessSessionMetadata;
    }
  | { type: 'unauthorized'; returnTo?: string | null }
  | { type: 'expiry'; returnTo?: string | null }
  | { type: 'sign-out' };

const AUTH_LOOP_PATHS = new Set([
  '/login',
  '/register',
  '/auth/login',
  '/auth/register',
  '/authentication/login',
  '/authentication/register',
]);

export function createBusinessAuthState(): BusinessAuthState {
  return {
    status: 'signed-out',
    identity: null,
    session: null,
    recovery: null,
  };
}

export function normalizeBusinessReturnTo(
  returnTo: string | null | undefined
): string | null {
  if (
    !returnTo ||
    returnTo.trim() !== returnTo ||
    hasControlCharacter(returnTo)
  ) {
    return null;
  }

  if (
    !returnTo.startsWith('/') ||
    returnTo.startsWith('//') ||
    returnTo.includes('\\')
  ) {
    return null;
  }

  try {
    const url = new URL(returnTo, 'https://business-site.invalid');
    const decodedPath = decodeURIComponent(url.pathname);
    const authLoopPath = decodedPath.replace(/\/+$/, '') || '/';

    if (
      url.origin !== 'https://business-site.invalid' ||
      !decodedPath.startsWith('/') ||
      decodedPath.startsWith('//') ||
      decodedPath.includes('\\') ||
      hasControlCharacter(decodedPath) ||
      AUTH_LOOP_PATHS.has(authLoopPath)
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return returnTo;
}

export function transitionBusinessAuthState(
  _state: BusinessAuthState,
  event: BusinessAuthStateEvent
): BusinessAuthState {
  switch (event.type) {
    case 'restore-start':
      return {
        status: 'loading',
        identity: null,
        session: null,
        recovery: null,
      };
    case 'restore-success':
      return {
        status: 'signed-in',
        identity: event.identity,
        session: event.session,
        recovery: null,
      };
    case 'unauthorized':
      return {
        status: 'expired',
        identity: null,
        session: null,
        recovery: {
          reason: 'unauthorized',
          returnTo: normalizeBusinessReturnTo(event.returnTo),
        },
      };
    case 'expiry':
      return {
        status: 'expired',
        identity: null,
        session: null,
        recovery: {
          reason: 'expired',
          returnTo: normalizeBusinessReturnTo(event.returnTo),
        },
      };
    case 'sign-out':
      return createBusinessAuthState();
  }
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }

  return false;
}

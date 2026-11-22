import { HttpStatus } from '@nestjs/common';
import { registerSafeEventCatalogue } from '@optimistic-tanuki/logger';

/** Steps of the OAuth callback; a failure is always attributed to one. */
export const OAUTH_STEPS = [
  'state',
  'exchange',
  'login',
  'register',
  'profile',
  'access',
  'session',
  'grant',
  // Pending-intent endpoints (not part of the single-pass callback).
  'link',
  'age',
  'pending',
] as const;
export type OAuthStep = (typeof OAUTH_STEPS)[number];

/** Fixed user-facing description for every error code the flow can emit. */
export const OAUTH_ERROR_DESCRIPTIONS = {
  provider_denied: 'OAuth sign-in was cancelled or declined.',
  provider_exchange_failed:
    'The sign-in provider did not complete the request. Please try again.',
  provider_email_missing:
    'The sign-in provider did not share a usable email address.',
  state_invalid:
    'This sign-in attempt expired or could not be validated. Please start again.',
  account_deleted: 'This account has been deleted.',
  registration_closed: 'Creating an account with this sign-in is not allowed.',
  owner_not_provisioned:
    'This console has no provisioned owner. Contact the person who runs this deployment.',
  not_authorized_for_app: 'This account is not authorized for this app.',
  guardian_mismatch:
    'The guardian permission belongs to a different applicant.',
  email_verification_required:
    'Check your email to verify your account before signing in.',
  session_issue_failed: 'Your session could not be created. Please try again.',
  profile_setup_failed:
    'Your profile for this app could not be set up. Please try again.',
  oauth_callback_failed: 'OAuth authentication could not be completed.',
  // Pending-intent endpoints.
  link_credentials_invalid: 'That password or code did not match.',
  link_attempts_exhausted:
    'Too many incorrect attempts. Please start the sign-in again.',
  link_method_unavailable: 'That confirmation method is not available.',
  link_code_cooldown:
    'A code was just sent. Please wait before requesting another.',
  email_code_send_failed: 'The confirmation code could not be sent.',
  age_ineligible: 'You are not eligible to create an account.',
  age_invalid: 'A valid date of birth is required.',
  guardian_consent_required:
    'A parent or guardian must record permission first.',
  guardian_token_invalid:
    'The private permission link is invalid or has expired.',
} as const;
export type OAuthErrorCode = keyof typeof OAUTH_ERROR_DESCRIPTIONS;

export const OAUTH_ERROR_STATUS: Record<OAuthErrorCode, number> = {
  provider_denied: HttpStatus.FORBIDDEN,
  provider_exchange_failed: HttpStatus.BAD_GATEWAY,
  provider_email_missing: HttpStatus.BAD_REQUEST,
  state_invalid: HttpStatus.UNAUTHORIZED,
  account_deleted: HttpStatus.FORBIDDEN,
  registration_closed: HttpStatus.FORBIDDEN,
  owner_not_provisioned: HttpStatus.FORBIDDEN,
  not_authorized_for_app: HttpStatus.FORBIDDEN,
  guardian_mismatch: HttpStatus.FORBIDDEN,
  email_verification_required: HttpStatus.FORBIDDEN,
  session_issue_failed: HttpStatus.INTERNAL_SERVER_ERROR,
  profile_setup_failed: HttpStatus.INTERNAL_SERVER_ERROR,
  oauth_callback_failed: HttpStatus.INTERNAL_SERVER_ERROR,
  link_credentials_invalid: HttpStatus.UNAUTHORIZED,
  link_attempts_exhausted: HttpStatus.UNAUTHORIZED,
  link_method_unavailable: HttpStatus.BAD_REQUEST,
  link_code_cooldown: HttpStatus.TOO_MANY_REQUESTS,
  email_code_send_failed: HttpStatus.SERVICE_UNAVAILABLE,
  age_ineligible: HttpStatus.FORBIDDEN,
  age_invalid: HttpStatus.BAD_REQUEST,
  guardian_consent_required: HttpStatus.FORBIDDEN,
  guardian_token_invalid: HttpStatus.BAD_REQUEST,
};

/** A failure with a name. Never constructed from a provider or RPC message. */
export class OAuthFlowError extends Error {
  constructor(
    readonly code: OAuthErrorCode,
    readonly step: OAuthStep,
    options?: { cause?: unknown }
  ) {
    super(code);
    this.name = 'OAuthFlowError';
    if (options && 'cause' in options) {
      Object.defineProperty(this, 'cause', {
        value: options.cause,
        enumerable: false,
      });
    }
  }
}

/** Per-step fallback when a failure carries no typed code of its own. */
export const DEFAULT_CODE_FOR_STEP: Record<OAuthStep, OAuthErrorCode> = {
  state: 'state_invalid',
  exchange: 'provider_exchange_failed',
  login: 'oauth_callback_failed',
  register: 'oauth_callback_failed',
  profile: 'profile_setup_failed',
  access: 'oauth_callback_failed',
  session: 'session_issue_failed',
  grant: 'session_issue_failed',
  link: 'oauth_callback_failed',
  age: 'oauth_callback_failed',
  pending: 'oauth_callback_failed',
};

/**
 * Authentication-service sentinel for the account deletion fence. Matched only
 * on errors that came back from our own RPC calls, never on provider text.
 */
export const isDeletionFenceError = (error: unknown): boolean => {
  const candidates: unknown[] = [error];
  if (error && typeof error === 'object') {
    const e = error as { message?: unknown; error?: unknown; code?: unknown };
    candidates.push(e.message, e.error, e.code);
    if (e.error && typeof e.error === 'object')
      candidates.push((e.error as { message?: unknown }).message);
  }
  return candidates.some(
    (c) =>
      typeof c === 'string' &&
      (c === 'ACCOUNT_DELETION_FENCED' || c === 'OAUTH_ACCOUNT_DELETION_FENCED')
  );
};

const PROVIDERS = ['google', 'github', 'microsoft', 'facebook'];
// Catalogue of safe events for this module; only these fields ever reach logs.
registerSafeEventCatalogue({
  'oauth.callback.failed': {
    step: OAUTH_STEPS,
    code: Object.keys(OAUTH_ERROR_DESCRIPTIONS),
    provider: PROVIDERS,
    appScope: /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/,
  },
  'oauth.callback.unexpected': {
    step: OAUTH_STEPS,
    provider: PROVIDERS,
    appScope: /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/,
  },
  'oauth.pending.created': {
    kind: ['link_account', 'age_verification'],
    provider: PROVIDERS,
    appScope: /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/,
  },
  'oauth.pending.completed': {
    kind: ['link_account', 'age_verification'],
    provider: PROVIDERS,
    appScope: /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/,
  },
  'oauth.pending.cancelled': {
    kind: ['link_account', 'age_verification'],
  },
  'oauth.pending.failed': {
    kind: ['link_account', 'age_verification'],
    step: OAUTH_STEPS,
    code: Object.keys(OAUTH_ERROR_DESCRIPTIONS),
    provider: PROVIDERS,
    appScope: /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/,
  },
});

/**
 * Apps that run the date-of-birth / guardian step. Only these may create an
 * `age_verification` pending intent or send a guardian permission email.
 * Each maps to the route that reads `#token=` into `guardianResumeToken`
 * (client-interface and local-hub both serve it at `/register`).
 */
export const GUARDIAN_RETURN_PATHS = {
  'client-interface': '/register',
  'local-hub': '/register',
} as const;

export const isAgeGatedApp = (
  appScope: string
): appScope is keyof typeof GUARDIAN_RETURN_PATHS =>
  Object.prototype.hasOwnProperty.call(GUARDIAN_RETURN_PATHS, appScope);

/** Explicit failure for an app with no guardian return route; never a default. */
export const guardianReturnPathFor = (appScope: string): string => {
  if (!isAgeGatedApp(appScope)) {
    throw new Error(`No guardian return path is defined for app ${appScope}`);
  }
  return GUARDIAN_RETURN_PATHS[appScope];
};

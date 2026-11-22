/**
 * Every `error` code the OAuth callback can produce (see the pending OAuth
 * intent contract in docs/plans/2026-11-21-owner-console-overhaul.md), plus the
 * pending-step codes and the client-side cancellation code. One map keeps the
 * popup, the callback page and every login page saying the same thing.
 */
export interface OAuthErrorCopy {
  title: string;
  message: string;
  /** What the person can do next. */
  action: string;
}

export interface DescribedOAuthError extends OAuthErrorCopy {
  code: string;
  known: boolean;
}

export const OAUTH_ERROR_COPY: Readonly<Record<string, OAuthErrorCopy>> = {
  provider_denied: {
    title: 'Sign-in cancelled',
    message: 'You cancelled sign-in at the provider.',
    action: 'Choose a provider and try again when you are ready.',
  },
  provider_exchange_failed: {
    title: 'The provider did not respond',
    message:
      'We could not finish talking to the provider to confirm who you are.',
    action: 'Try again in a moment, or sign in with email and password.',
  },
  provider_email_missing: {
    title: 'No email address from the provider',
    message: 'The provider did not share an email address with us.',
    action:
      'Make your email visible to apps in your provider account settings and try again, or sign in with email and password.',
  },
  state_invalid: {
    title: 'This sign-in attempt expired',
    message:
      'The sign-in request is missing, expired or was started in another browser.',
    action: 'Start over from the sign-in page in this browser.',
  },
  account_deleted: {
    title: 'Account deleted',
    message: 'The account for this sign-in has been deleted.',
    action:
      'Contact support if you think this is a mistake, or register again later.',
  },
  registration_closed: {
    title: 'Sign-up with a provider is not available',
    message: "This app doesn't allow creating an account with a provider.",
    action:
      'Sign in with an existing account using email and password instead.',
  },
  owner_not_provisioned: {
    title: 'No owner set up yet',
    message: 'This console has no provisioned owner account.',
    action: 'Ask the person who runs this deployment to finish owner setup.',
  },
  not_authorized_for_app: {
    title: 'No access to this app',
    message: 'This account is not allowed to use this app.',
    action: 'Ask an administrator to grant you access, or use another account.',
  },
  guardian_mismatch: {
    title: 'Guardian permission does not match',
    message: 'The guardian permission link belongs to a different applicant.',
    action: 'Use the link sent for this account, or request permission again.',
  },
  email_verification_required: {
    title: 'Verify your email first',
    message: 'This email address has to be verified before you can sign in.',
    action: 'Open the verification email we sent, then try again.',
  },
  session_issue_failed: {
    title: 'Could not start your session',
    message: 'You were verified, but we could not create your session.',
    action: 'Try signing in again.',
  },
  profile_setup_failed: {
    title: 'Could not set up your profile',
    message:
      'Your account was verified, but your profile could not be created.',
    action: 'Try again; if it keeps happening, contact support.',
  },
  oauth_callback_failed: {
    title: 'Something went wrong',
    message: 'Sign-in failed unexpectedly.',
    action: 'Try again; if it keeps happening, contact support.',
  },
  link_credentials_invalid: {
    title: 'That did not match',
    message: 'The password or code you entered was not correct.',
    action: 'Check it and try again.',
  },
  link_attempts_exhausted: {
    title: 'Too many attempts',
    message: 'Too many incorrect attempts, so this link request was closed.',
    action: 'Start over from the sign-in page.',
  },
  link_method_unavailable: {
    title: 'That method is not available',
    message: 'That way of confirming your account is not available here.',
    action: 'Choose another method.',
  },
  link_code_cooldown: {
    title: 'A code was just sent',
    message:
      'We already emailed you a code. Wait a minute before requesting another code.',
    action: 'Check your inbox, or try again in a minute.',
  },
  email_code_send_failed: {
    title: 'Could not send the code',
    message: 'We could not email you a confirmation code.',
    action: 'Try again in a moment.',
  },
  age_invalid: {
    title: 'Check your date of birth',
    message: 'Enter a valid date of birth.',
    action: 'Correct the date and try again.',
  },
  guardian_token_invalid: {
    title: 'Permission link no longer works',
    message: 'The guardian permission link is invalid or has expired.',
    action: 'Ask for a new permission request and try again.',
  },
  guardian_consent_required: {
    title: 'Guardian permission needed',
    message: 'A parent or guardian must give permission first.',
    action: 'Ask them to approve the email we sent, then sign in again.',
  },
  age_ineligible: {
    title: 'Not eligible to sign up',
    message:
      'You must be at least 13 to sign up, and anyone under 18 needs a parent or guardian to give permission.',
    action: 'Ask a parent or guardian for help.',
  },
  pending_expired: {
    title: 'This request expired',
    message: 'This step is no longer available; it may have timed out.',
    action: 'Start over from the sign-in page.',
  },
  oauth_cancelled: {
    title: 'Sign-in cancelled',
    message: 'You cancelled this sign-in.',
    action: 'Choose a provider and try again when you are ready.',
  },
};

export function describeOAuthError(
  code: string | null | undefined,
  description?: string | null
): DescribedOAuthError {
  const key = (code ?? '').trim();
  const copy = Object.prototype.hasOwnProperty.call(OAUTH_ERROR_COPY, key)
    ? OAUTH_ERROR_COPY[key]
    : undefined;
  if (copy) return { code: key, known: true, ...copy };
  const detail = (description ?? '').trim();
  return {
    code: key || 'unknown',
    known: false,
    title: 'Authentication failed',
    message: detail || 'Sign-in could not be completed.',
    action: 'Try again; if it keeps happening, contact support.',
  };
}

/** One sentence for places that only have room for a single string. */
export function oauthErrorMessage(
  code: string | null | undefined,
  description?: string | null
): string {
  const d = describeOAuthError(code, description);
  return d.known
    ? `${d.message} ${d.action}`
    : `${d.message} (code: ${d.code})`;
}

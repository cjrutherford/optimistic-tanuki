import {
  OAUTH_ERROR_COPY,
  describeOAuthError,
  oauthErrorMessage,
} from './oauth-errors';

const CONTRACT_CODES = [
  'provider_denied',
  'provider_exchange_failed',
  'provider_email_missing',
  'state_invalid',
  'account_deleted',
  'registration_closed',
  'owner_not_provisioned',
  'not_authorized_for_app',
  'guardian_mismatch',
  'email_verification_required',
  'session_issue_failed',
  'profile_setup_failed',
  'oauth_callback_failed',
];

describe('OAuth error map', () => {
  it.each(CONTRACT_CODES)('has specific copy and an action for %s', (code) => {
    const described = describeOAuthError(code, 'server text');
    expect(described.known).toBe(true);
    expect(described.message).toBeTruthy();
    expect(described.action).toBeTruthy();
    expect(described.message).not.toContain('server text');
  });

  it('covers the pending-step codes too', () => {
    for (const code of [
      'link_credentials_invalid',
      'link_attempts_exhausted',
      'link_method_unavailable',
      'link_code_cooldown',
      'email_code_send_failed',
      'age_invalid',
      'guardian_token_invalid',
      'guardian_consent_required',
      'age_ineligible',
      'oauth_cancelled',
    ]) {
      expect(OAUTH_ERROR_COPY[code]).toBeDefined();
    }
  });

  it('tells provider_email_missing and registration_closed apart', () => {
    expect(oauthErrorMessage('provider_email_missing')).toMatch(/email/i);
    expect(oauthErrorMessage('registration_closed')).toMatch(
      /doesn't allow creating an account/
    );
  });

  it('shows the description and the code for an unknown code', () => {
    expect(oauthErrorMessage('brand_new_code', 'Something odd.')).toBe(
      'Something odd. (code: brand_new_code)'
    );
  });

  it('never returns a blank message', () => {
    expect(describeOAuthError(undefined).message).toBeTruthy();
    expect(oauthErrorMessage('', '')).toContain('unknown');
  });

  it('ignores inherited object keys', () => {
    expect(describeOAuthError('constructor').known).toBe(false);
  });
});

describe('OAuth error map completeness', () => {
  // Mirrors OAUTH_ERROR_DESCRIPTIONS in the gateway's oauth-flow-error.ts; the
  // gateway spec checks that list against this file's source.
  const GATEWAY_CODES = [
    'provider_denied',
    'provider_exchange_failed',
    'provider_email_missing',
    'state_invalid',
    'account_deleted',
    'registration_closed',
    'owner_not_provisioned',
    'not_authorized_for_app',
    'guardian_mismatch',
    'email_verification_required',
    'session_issue_failed',
    'profile_setup_failed',
    'oauth_callback_failed',
    'link_credentials_invalid',
    'link_attempts_exhausted',
    'link_method_unavailable',
    'link_code_cooldown',
    'email_code_send_failed',
    'age_ineligible',
    'age_invalid',
    'guardian_consent_required',
    'guardian_token_invalid',
  ];

  it.each(GATEWAY_CODES)('has an entry for %s', (code) => {
    expect(OAUTH_ERROR_COPY[code]).toBeDefined();
  });

  it('tells the person to wait a minute for a new code', () => {
    expect(oauthErrorMessage('link_code_cooldown')).toMatch(
      /wait a minute before requesting another code/i
    );
  });
});

export * from './lib/auth-ui';
export * from './lib/auth-ui/index';
export { OAuthService } from './lib/services/oauth.service';
export { normalizeAuthReturnTo } from './lib/oauth-callback/oauth-return';
export type {
  AuthReturnTarget,
  AuthReturnNormalizationOptions,
} from './lib/oauth-callback/oauth-return';
export { oauthCallbackReferrerPolicy } from './lib/oauth-callback/oauth-callback-referrer-policy';
export { EmailAuthClientService } from './lib/services/email-auth.service';
export type { EmailActionPurpose } from './lib/services/email-auth.service';
export {
  EmailActionComponent,
  emailAuthRoutes,
  parseEmailActionToken,
} from './lib/email-action/email-action.component';
export {
  GuardianConsentComponent,
  guardianConsentRoutes,
} from './lib/guardian-consent/guardian-consent.component';
export type {
  OAuthLoginResult,
  OAuthPopupResult,
  OAuthProviderConfig,
  OAuthUserInfo,
} from './lib/services/oauth.service';
export {
  OAUTH_ERROR_COPY,
  describeOAuthError,
  oauthErrorMessage,
} from './lib/oauth-callback/oauth-errors';
export type {
  DescribedOAuthError,
  OAuthErrorCopy,
} from './lib/oauth-callback/oauth-errors';
export { DateOfBirthStepComponent } from './lib/age-gate/date-of-birth-step.component';
export { ageFromDateOfBirth } from './lib/age-gate/age';

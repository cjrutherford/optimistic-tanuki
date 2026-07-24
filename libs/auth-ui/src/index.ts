export * from './lib/auth-ui';
export * from './lib/auth-ui/index';
export { OAuthService } from './lib/services/oauth.service';
export { oauthCallbackReferrerPolicy } from './lib/oauth-callback/oauth-callback-referrer-policy';
export { EmailAuthClientService } from './lib/services/email-auth.service';
export type { EmailActionPurpose } from './lib/services/email-auth.service';
export {
  EmailActionComponent,
  emailAuthRoutes,
  parseEmailActionToken,
} from './lib/email-action/email-action.component';
export type {
  OAuthLoginResult,
  OAuthPopupResult,
  OAuthProviderConfig,
  OAuthUserInfo,
} from './lib/services/oauth.service';

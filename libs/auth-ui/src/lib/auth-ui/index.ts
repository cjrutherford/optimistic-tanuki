export { RegisterBlockComponent } from './register-block/register-block.component';
export { LoginBlockComponent } from './login-block/login-block.component';
export { MfaBlockComponent } from './mfa-block/mfa-block.component';
export { ConfirmBlockComponent } from './confirm-block/confirm-block.component';
export { OAuthButtonsComponent } from './oauth-buttons/oauth-buttons.component';
export type { OAuthProviderEvent } from './oauth-buttons/oauth-buttons.component';
export {
  OAuthCallbackComponent,
  oauthCallbackRoutes,
} from '../oauth-callback/oauth-callback.component';
export { normalizeAuthReturnTo } from '../oauth-callback/oauth-return';
export type {
  AuthReturnTarget,
  AuthReturnNormalizationOptions,
} from '../oauth-callback/oauth-return';

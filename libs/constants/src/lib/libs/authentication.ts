const AuthCommands = {
  Login: 'Login',
  EnableMultiFactor: 'EnableMultiFactor',
  ResetPassword: 'ResetPassword',
  Register: 'Register',
  Validate: 'Validate',
  UserIdFromEmail: 'UserIdFromEmail',
  // Issue a new token for a user (e.g. after profile creation). Payload: { userId, profileId? }
  Issue: 'Issue',
  ValidateTotp: 'ValidateTotp',
  // OAuth commands for social login and account linking
  OAuthLogin: 'OAuthLogin',
  OAuthCallback: 'OAuthCallback',
  LinkProvider: 'LinkProvider',
  UnlinkProvider: 'UnlinkProvider',
  GetLinkedProviders: 'GetLinkedProviders',
  // Email commands for MFA verification
  SendMfaSetupEmail: 'SendMfaSetupEmail',
  SendMfaVerificationEmail: 'SendMfaVerificationEmail',
  // Returns sanitized public OAuth config for a given domain (no secrets)
  GetOAuthConfig: 'GetOAuthConfig',
};

export default AuthCommands;

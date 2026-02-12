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
};

export default AuthCommands;

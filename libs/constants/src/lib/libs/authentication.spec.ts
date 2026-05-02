import AuthCommands from './authentication';

describe('AuthCommands', () => {
  it('defines each auth command only once', () => {
    const keys = Object.keys(AuthCommands);
    const uniqueKeys = new Set(keys);

    expect(uniqueKeys.size).toBe(keys.length);
    expect(AuthCommands).toMatchObject({
      Login: 'Login',
      Logout: 'Logout',
      OAuthLogin: 'OAuthLogin',
      OAuthCallback: 'OAuthCallback',
      LinkProvider: 'LinkProvider',
      UnlinkProvider: 'UnlinkProvider',
      GetLinkedProviders: 'GetLinkedProviders',
      SendMfaSetupEmail: 'SendMfaSetupEmail',
      SendMfaVerificationEmail: 'SendMfaVerificationEmail',
      GetOAuthConfig: 'GetOAuthConfig',
    });
  });
});

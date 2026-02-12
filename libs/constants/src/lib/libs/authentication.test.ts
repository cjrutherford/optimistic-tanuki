import AuthCommands from './authentication';
describe('AuthCommands', () => {
  it('should have a Login command', () => {
    expect(AuthCommands.Login).toBe('Login');
  });

  it('should have an EnableMultiFactor command', () => {
    expect(AuthCommands.EnableMultiFactor).toBe('EnableMultiFactor');
  });

  it('should have a ResetPassword command', () => {
    expect(AuthCommands.ResetPassword).toBe('ResetPassword');
  });

  it('should have a Register command', () => {
    expect(AuthCommands.Register).toBe('Register');
  });

  it('should have a Validate command', () => {
    expect(AuthCommands.Validate).toBe('Validate');
  });

  it('should have a ValidateTotp command', () => {
    expect(AuthCommands.ValidateTotp).toBe('ValidateTotp');
  });

  it('should have an OAuthLogin command', () => {
    expect(AuthCommands.OAuthLogin).toBe('OAuthLogin');
  });

  it('should have an OAuthCallback command', () => {
    expect(AuthCommands.OAuthCallback).toBe('OAuthCallback');
  });

  it('should have a LinkProvider command', () => {
    expect(AuthCommands.LinkProvider).toBe('LinkProvider');
  });

  it('should have an UnlinkProvider command', () => {
    expect(AuthCommands.UnlinkProvider).toBe('UnlinkProvider');
  });

  it('should have a GetLinkedProviders command', () => {
    expect(AuthCommands.GetLinkedProviders).toBe('GetLinkedProviders');
  });
});

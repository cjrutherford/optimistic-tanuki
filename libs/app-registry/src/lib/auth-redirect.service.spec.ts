import { AuthRedirectService } from './auth-redirect.service';

describe('AuthRedirectService', () => {
  it('clears session state and redirects to the auth app login route', () => {
    const session = { clearSession: jest.fn() };
    const navigation = { navigate: jest.fn() };
    const service = new AuthRedirectService(
      session as any,
      navigation as any,
      'auth'
    );

    service.redirectToLogin();

    expect(session.clearSession).toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenCalledWith('auth', '/login', {
      includeReturn: true,
    });
  });
});

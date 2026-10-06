import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';

// Exercise rejected provider results before any session or router operation.
describe.each([
  ['login', LoginComponent, 'OAuth login failed. Please try again.'],
  [
    'registration',
    RegisterComponent,
    'OAuth registration failed. Please try again.',
  ],
] as const)('%s OAuth failure', (_name, component, fallback) => {
  it.each([undefined, 'Sign-in was cancelled.'])(
    'exposes an error for a rejected provider result: %s',
    async (error) => {
      const state = {
        error: null as string | null,
        oauthService: {
          initiateOAuthLogin: jest
            .fn()
            .mockResolvedValue({ success: false, error }),
        },
        authState: { restoreSession: jest.fn() },
        router: { navigate: jest.fn(), navigateByUrl: jest.fn() },
      };
      await component.prototype.onOAuthProvider.call(state as never, {
        provider: 'google',
      });
      expect(state.error).toBe(error || fallback);
      expect(state.authState.restoreSession).not.toHaveBeenCalled();
      expect(state.router.navigate).not.toHaveBeenCalled();
      expect(state.router.navigateByUrl).not.toHaveBeenCalled();
    }
  );
});

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { OAuthService } from './oauth.service';

describe('OAuthService', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('accepts a callback message after a browser briefly reports the popup as closed', async () => {
    jest.useFakeTimers();
    const popup = { closed: true, close: jest.fn() } as unknown as Window;
    jest.spyOn(window, 'open').mockReturnValue(popup);

    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        OAuthService,
        { provide: 'API_BASE_URL', useValue: '/api' },
      ],
    }).compileComponents();
    const service = TestBed.inject(OAuthService);
    service.configureProviders({ google: { clientId: 'google-client-id' } });

    const login = service.initiateOAuthLogin('google', 'owner-console');
    jest.advanceTimersByTime(1000);
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: {
          type: 'oauth-callback',
          payload: { success: true, token: 'platform-token' },
        },
      })
    );

    await expect(login).resolves.toEqual({
      success: true,
      token: 'platform-token',
    });
  });

  it('accepts a cookie-session callback without requiring a browser-readable token', async () => {
    const popup = { closed: false, close: jest.fn() } as unknown as Window;
    jest.spyOn(window, 'open').mockReturnValue(popup);

    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        OAuthService,
        { provide: 'API_BASE_URL', useValue: '/api' },
      ],
    }).compileComponents();
    const service = TestBed.inject(OAuthService);
    service.configureProviders({ google: { clientId: 'google-client-id' } });

    const login = service.initiateOAuthLogin(
      'google',
      'client-interface',
      true
    );
    expect(
      new URL(
        jest.mocked(window.open).mock.calls[0][0] as string
      ).searchParams.get('sessionMode')
    ).toBe('cookie');
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: {
          type: 'oauth-callback',
          payload: { success: true, session: true },
        },
      })
    );

    await expect(login).resolves.toEqual({ success: true, session: true });
  });
});

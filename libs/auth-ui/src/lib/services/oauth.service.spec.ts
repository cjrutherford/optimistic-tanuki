import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
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
        source: popup,
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

  it('ignores callback messages from a different window', async () => {
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

    const login = service.initiateOAuthLogin('google');
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        source: window,
        data: {
          type: 'oauth-callback',
          payload: { success: true, token: 'forged-token' },
        },
      })
    );
    await Promise.resolve();

    let settled = false;
    void login.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        source: popup,
        data: {
          type: 'oauth-callback',
          payload: { success: true, token: 'real-token' },
        },
      })
    );

    await expect(login).resolves.toEqual({
      success: true,
      token: 'real-token',
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
    const http = TestBed.inject(HttpClient);
    jest
      .spyOn(http, 'post')
      .mockReturnValue(
        of({ session: true, returnOrigin: window.location.origin }) as any
      );
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
        source: popup,
        data: {
          type: 'oauth-callback',
          payload: { success: true, callbackCode: 'one-time-code' },
        },
      })
    );

    await expect(login).resolves.toEqual({ success: true, session: true });
    expect(http.post).toHaveBeenCalledWith(
      '/api/oauth/callback/redeem',
      { callbackCode: 'one-time-code' },
      expect.objectContaining({
        withCredentials: true,
        headers: { 'X-ot-session-mode': 'cookie' },
      })
    );
  });

  it('waits for the cookie-session callback when a cross-origin popup reports closed', async () => {
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

    const login = service.initiateOAuthLogin(
      'google',
      'client-interface',
      true
    );
    let settled = false;
    void login.then(() => {
      settled = true;
    });

    jest.advanceTimersByTime(2_500);
    await Promise.resolve();

    expect(settled).toBe(false);

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        source: popup,
        data: {
          type: 'oauth-callback',
          payload: { success: true, session: true },
        },
      })
    );

    await expect(login).resolves.toEqual({ success: true, session: true });
  });

  it('restores a cookie session after the popup closes without delivering a callback message', async () => {
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
    const http = TestBed.inject(HttpClient);
    jest.spyOn(http, 'get').mockReturnValue(of({ data: { userId: 'user-1' } }));
    service.configureProviders({ google: { clientId: 'google-client-id' } });

    const login = service.initiateOAuthLogin(
      'google',
      'client-interface',
      true
    );
    let result: unknown;
    void login.then((value) => {
      result = value;
    });

    jest.advanceTimersByTime(2_500);
    await Promise.resolve();
    await Promise.resolve();

    expect(http.get).toHaveBeenCalledWith('/api/authentication/session', {
      withCredentials: true,
    });
    expect(result).toEqual({ success: true, session: true });
  });

  it('continues recovering a pending cookie session for the active OAuth attempt', async () => {
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
    const http = TestBed.inject(HttpClient);
    jest
      .spyOn(http, 'get')
      .mockReturnValue(throwError(() => new Error('Session is not ready yet')));
    service.configureProviders({ google: { clientId: 'google-client-id' } });

    void service.initiateOAuthLogin('google', 'client-interface', true);

    jest.advanceTimersByTime(12_500);
    await Promise.resolve();

    expect(http.get).toHaveBeenCalledTimes(11);
  });

  it('gives up recovering the cookie session after a bounded number of probes', async () => {
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
    const http = TestBed.inject(HttpClient);
    jest
      .spyOn(http, 'get')
      .mockReturnValue(throwError(() => new Error('Session is not ready yet')));
    service.configureProviders({ google: { clientId: 'google-client-id' } });

    const login = service.initiateOAuthLogin(
      'google',
      'client-interface',
      true
    );
    let result: unknown;
    void login.then((value) => {
      result = value;
    });

    // Far beyond the recovery window: polling must stop and the attempt
    // must settle instead of hammering the session endpoint forever.
    jest.advanceTimersByTime(60_000);
    await Promise.resolve();
    await Promise.resolve();

    expect(result).toEqual({
      success: false,
      error: 'OAuth session could not be restored',
    });
    expect(http.get).toHaveBeenCalledTimes(15);

    const callsAfterSettle = jest.mocked(http.get).mock.calls.length;
    jest.advanceTimersByTime(30_000);
    await Promise.resolve();
    expect(jest.mocked(http.get).mock.calls.length).toBe(callsAfterSettle);
  });

  it('keeps the legacy registration call shape on the hardened OAuth flow', async () => {
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
    const http = TestBed.inject(HttpClient);
    jest.spyOn(http, 'post').mockReturnValue(
      of({
        token: 'compatibility-token',
        returnOrigin: window.location.origin,
      }) as any
    );
    service.configureProviders({ google: { clientId: 'google-client-id' } });

    const completion = service.completeOAuthRegistration(
      'google',
      'legacy-provider-id',
      'legacy@example.com',
      'Legacy',
      'Caller',
      ''
    );

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        source: popup,
        data: {
          type: 'oauth-callback',
          payload: { success: true, callbackCode: 'one-time-code' },
        },
      })
    );

    await expect(completion).resolves.toEqual({
      success: true,
      token: 'compatibility-token',
    });
    expect(http.post).toHaveBeenCalledWith(
      '/api/oauth/callback/redeem',
      { callbackCode: 'one-time-code' },
      expect.objectContaining({ withCredentials: true })
    );
  });

  it('rejects a legacy registration redemption with an unsafe return origin', async () => {
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
    const http = TestBed.inject(HttpClient);
    jest.spyOn(http, 'post').mockReturnValue(
      of({
        token: 'forged-token',
        returnOrigin: 'https://evil.example',
      }) as any
    );
    service.configureProviders({ google: { clientId: 'google-client-id' } });

    const completion = service.completeOAuthRegistration(
      'google',
      'legacy-provider-id',
      'legacy@example.com',
      'Legacy',
      'Caller',
      ''
    );

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        source: popup,
        data: {
          type: 'oauth-callback',
          payload: { success: true, callbackCode: 'one-time-code' },
        },
      })
    );

    await expect(completion).resolves.toEqual({
      success: false,
      error: 'OAuth callback origin mismatch',
    });
  });
});

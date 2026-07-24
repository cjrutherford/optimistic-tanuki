import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OAuthController } from './oauth.controller';
import { ClientProxy } from '@nestjs/microservices';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { of } from 'rxjs';
import { RoleInitService } from '@optimistic-tanuki/permission-lib';
import { AuthCommands } from '@optimistic-tanuki/constants';
import { RegisterAccountBootstrapService } from '@optimistic-tanuki/auth-feature-account-bootstrap';
import { GATEWAY_APP_REGISTRY } from '../registry/registry.controller';
import { AuthGuard } from '../../auth/auth.guard';
import { LocalOAuthStateStore, OAUTH_STATE_STORE } from './oauth-state.store';

describe('OAuthController', () => {
  let controller: OAuthController;
  let authClient: ClientProxy;
  let configGet: jest.Mock;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    process.env.OAUTH_STATE_SECRET = 'state-secret';
    delete process.env.CLIENT_INTERFACE_DOMAIN;
    delete process.env.CLIENT_INTERFACE_UI_BASE_URL;
    configGet = jest.fn();
    authClient = {
      send: jest.fn().mockReturnValue(of(true)),
      connect: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<ClientProxy>;

    const profileClient = {
      send: jest.fn().mockReturnValue(of([])),
      connect: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<ClientProxy>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OAuthController],
      providers: [
        {
          provide: 'AUTHENTICATION_SERVICE',
          useValue: authClient,
        },
        {
          provide: 'PROFILE_SERVICE',
          useValue: profileClient,
        },
        {
          provide: GATEWAY_APP_REGISTRY,
          useValue: {
            version: 'test',
            generatedAt: '2026-07-13T00:00:00Z',
            apps: [
              {
                appId: 'client-interface',
                name: 'Optimistic Tanuki',
                domain: 'optimistic-tanuki.example',
                uiBaseUrl: 'https://optimistic-tanuki.example',
                apiBaseUrl: 'https://optimistic-tanuki.example/api',
                appType: 'client',
                visibility: 'public',
              },
            ],
          },
        },
        {
          provide: RoleInitService,
          useValue: {
            initializeRoles: jest.fn().mockResolvedValue(undefined),
            enqueue: jest.fn().mockResolvedValue(undefined),
            processNow: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: configGet,
          },
        },
        {
          provide: RegisterAccountBootstrapService,
          useValue: {
            register: jest.fn(),
          },
        },
        {
          provide: OAUTH_STATE_STORE,
          useValue: new LocalOAuthStateStore(),
        },
        Logger,
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OAuthController>(OAuthController);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('startOAuth', () => {
    const request = { params: { provider: 'google' } } as any;

    it('binds an opaque state to a short-lived HttpOnly browser nonce cookie', async () => {
      process.env.OAUTH_STATE_SECRET = 'state-secret';
      configGet.mockImplementation((key: string) =>
        key === 'oauth.google'
          ? {
              enabled: true,
              clientId: 'client-id',
              scopes: ['openid'],
              authorizationEndpoint:
                'https://accounts.google.com/o/oauth2/v2/auth',
            }
          : undefined
      );
      const response = { redirect: jest.fn(), cookie: jest.fn() } as any;

      await controller.startOAuth(
        request,
        response,
        'https://optimistic-tanuki.example/login',
        'client-interface',
        undefined
      );

      const redirect = new URL(response.redirect.mock.calls[0][0]);
      expect(redirect.searchParams.get('state')).toMatch(
        /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
      );
      expect(response.cookie).toHaveBeenCalledWith(
        'oauth_state_nonce',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/api/oauth',
          maxAge: 10 * 60 * 1000,
        })
      );
    });

    it('retains a bounded set of concurrent initiation nonces', async () => {
      process.env.OAUTH_STATE_SECRET = 'state-secret';
      configGet.mockImplementation((key: string) =>
        key === 'oauth.google'
          ? {
              enabled: true,
              clientId: 'client-id',
              scopes: ['openid'],
              authorizationEndpoint:
                'https://accounts.google.com/o/oauth2/v2/auth',
            }
          : undefined
      );
      const firstResponse = { redirect: jest.fn(), cookie: jest.fn() } as any;
      await controller.startOAuth(
        request,
        firstResponse,
        'https://optimistic-tanuki.example/login',
        'client-interface',
        undefined
      );
      const firstCookie = firstResponse.cookie.mock.calls[0][1];
      const secondResponse = { redirect: jest.fn(), cookie: jest.fn() } as any;
      await controller.startOAuth(
        { ...request, cookies: { oauth_state_nonce: firstCookie } } as any,
        secondResponse,
        'https://optimistic-tanuki.example/login',
        'client-interface',
        undefined
      );
      expect(JSON.parse(secondResponse.cookie.mock.calls[0][1])).toHaveLength(
        2
      );
    });

    it('fails closed when OAUTH_STATE_SECRET is absent', async () => {
      delete process.env.OAUTH_STATE_SECRET;
      configGet.mockImplementation((key: string) =>
        key === 'oauth.google'
          ? {
              enabled: true,
              clientId: 'client-id',
              scopes: ['openid'],
              authorizationEndpoint:
                'https://accounts.google.com/o/oauth2/v2/auth',
            }
          : undefined
      );

      await expect(
        controller.startOAuth(
          request,
          { redirect: jest.fn(), cookie: jest.fn() } as any,
          'https://optimistic-tanuki.example/login',
          'client-interface',
          undefined
        )
      ).rejects.toMatchObject({ status: HttpStatus.SERVICE_UNAVAILABLE });
    });

    it('uses the provider redirect URI when config supplies one', async () => {
      configGet.mockImplementation((key: string) =>
        key === 'oauth.google'
          ? {
              enabled: true,
              clientId: 'client-id',
              redirectUri: 'https://oauth.example/callback/google',
              scopes: ['openid'],
              authorizationEndpoint:
                'https://accounts.google.com/o/oauth2/v2/auth',
            }
          : undefined
      );
      const response = { redirect: jest.fn(), cookie: jest.fn() } as any;

      await controller.startOAuth(
        request,
        response,
        'https://optimistic-tanuki.example/login',
        'client-interface',
        undefined
      );

      const redirect = new URL(response.redirect.mock.calls[0][0]);
      expect(redirect.searchParams.get('redirect_uri')).toBe(
        'https://oauth.example/callback/google'
      );
    });

    it('falls back to the registry bridge URL when config omits redirect URI', async () => {
      configGet.mockImplementation((key: string) =>
        key === 'oauth.google'
          ? {
              enabled: true,
              clientId: 'client-id',
              scopes: ['openid'],
              authorizationEndpoint:
                'https://accounts.google.com/o/oauth2/v2/auth',
            }
          : undefined
      );
      const response = { redirect: jest.fn(), cookie: jest.fn() } as any;

      await controller.startOAuth(
        request,
        response,
        'https://optimistic-tanuki.example/login',
        'client-interface',
        undefined
      );

      const redirect = new URL(response.redirect.mock.calls[0][0]);
      expect(redirect.searchParams.get('redirect_uri')).toBe(
        'https://optimistic-tanuki.example/oauth/callback/google'
      );
    });
  });

  describe('OAuth state consumption', () => {
    const statePayload = {
      provider: 'google',
      returnTo: 'https://optimistic-tanuki.example/login',
      appScope: 'client-interface',
      issuedAt: Date.now(),
    };

    it('accepts a matching nonce once and rejects replay', async () => {
      process.env.OAUTH_STATE_SECRET = 'state-secret';
      const issued = await (controller as any).signState(statePayload);
      await expect(
        (controller as any).verifyAndConsumeState(
          issued.state,
          'google',
          issued.nonce
        )
      ).resolves.toMatchObject({ provider: 'google' });
      await expect(
        (controller as any).verifyAndConsumeState(
          issued.state,
          'google',
          issued.nonce
        )
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });

    it('rejects a missing or mismatched browser nonce', async () => {
      process.env.OAUTH_STATE_SECRET = 'state-secret';
      const missing = await (controller as any).signState(statePayload);
      await expect(
        (controller as any).verifyAndConsumeState(
          missing.state,
          'google',
          undefined
        )
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
      const mismatch = await (controller as any).signState(statePayload);
      await expect(
        (controller as any).verifyAndConsumeState(
          mismatch.state,
          'google',
          'wrong'
        )
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });

    it('does not consume a state when the browser nonce is wrong', async () => {
      process.env.OAUTH_STATE_SECRET = 'state-secret';
      const issued = await (controller as any).signState(statePayload);

      await expect(
        (controller as any).verifyAndConsumeState(
          issued.state,
          'google',
          'wrong'
        )
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
      await expect(
        (controller as any).verifyAndConsumeState(
          issued.state,
          'google',
          issued.nonce
        )
      ).resolves.toMatchObject({ provider: 'google' });
    });

    it('rejects an expired state', async () => {
      process.env.OAUTH_STATE_SECRET = 'state-secret';
      const issued = await (controller as any).signState(statePayload);
      const store = (controller as any).oauthStateStore as LocalOAuthStateStore;
      const stored = await store.consume(issued.stateId);
      await store.create(issued.stateId, {
        ...stored!,
        expiresAt: Date.now() - 1,
      });
      await expect(
        (controller as any).verifyAndConsumeState(
          issued.state,
          'google',
          issued.nonce
        )
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });
  });

  describe('oauthRedirectCallback', () => {
    it('rejects a blank provider stable id before it can be linked or used to sign in', async () => {
      const issued = await (controller as any).signState({
        provider: 'google',
        returnTo: 'https://optimistic-tanuki.example/login',
        appScope: 'client-interface',
        issuedAt: Date.now(),
        linkUserId: 'user-1',
      });
      jest.spyOn(controller as any, 'exchangeProviderCode').mockResolvedValue({
        providerUserId: '   ',
        email: 'person@example.com',
        emailVerified: true,
        displayName: 'Person Example',
        firstName: 'Person',
        lastName: 'Example',
      });
      const response = { redirect: jest.fn() } as any;

      await controller.oauthRedirectCallback(
        {
          params: { provider: 'google' },
          query: { code: 'provider-code', state: issued.state },
          cookies: {
            oauth_state_nonce: JSON.stringify([
              { id: issued.stateId, nonce: issued.nonce },
            ]),
          },
        } as any,
        response
      );

      expect(authClient.send).not.toHaveBeenCalledWith(
        { cmd: AuthCommands.LinkProvider },
        expect.anything()
      );
      expect(authClient.send).not.toHaveBeenCalledWith(
        { cmd: AuthCommands.OAuthLogin },
        expect.anything()
      );
      const callbackUrl = new URL(response.redirect.mock.calls[0][0]);
      expect(callbackUrl.searchParams.get('error')).toBe(
        'oauth_callback_failed'
      );
      expect(callbackUrl.searchParams.has('callbackCode')).toBe(false);
      expect(callbackUrl.searchParams.has('token')).toBe(false);
    });

    it('does not register an OAuth identity with an unusable email address', async () => {
      const issued = await (controller as any).signState({
        provider: 'google',
        returnTo: 'https://optimistic-tanuki.example/login',
        appScope: 'client-interface',
        issuedAt: Date.now(),
      });
      jest.spyOn(controller as any, 'exchangeProviderCode').mockResolvedValue({
        providerUserId: 'google-user',
        email: 'not an email',
        emailVerified: false,
        displayName: 'Person Example',
        firstName: 'Person',
        lastName: 'Example',
      });
      (authClient.send as jest.Mock).mockReturnValue(
        of({ data: { needsRegistration: true } })
      );
      const registerOAuthUser = jest.spyOn(
        controller as any,
        'registerOAuthUser'
      );
      const response = { redirect: jest.fn() } as any;

      await controller.oauthRedirectCallback(
        {
          params: { provider: 'google' },
          query: { code: 'provider-code', state: issued.state },
          cookies: {
            oauth_state_nonce: JSON.stringify([
              { id: issued.stateId, nonce: issued.nonce },
            ]),
          },
        } as any,
        response
      );

      expect(registerOAuthUser).not.toHaveBeenCalled();
      expect(
        new URL(response.redirect.mock.calls[0][0]).searchParams.get('error')
      ).toBe('oauth_callback_failed');
    });

    it('rejects an expired callback grant', async () => {
      const store = (controller as any).oauthStateStore as LocalOAuthStateStore;
      await store.createCallbackGrant('state-1.secret', {
        token: 'platform-token',
        returnOrigin: 'https://optimistic-tanuki.example',
        stateId: 'state-1',
        nonceHash: (controller as any).hashNonce('nonce'),
        expiresAt: Date.now() - 1,
      });

      await expect(
        controller.redeemCallbackCode({ callbackCode: 'state-1.secret' }, {
          headers: { origin: 'https://optimistic-tanuki.example' },
          cookies: {
            oauth_state_nonce: JSON.stringify([
              { id: 'state-1', nonce: 'nonce' },
            ]),
          },
        } as any)
      ).rejects.toMatchObject({ status: HttpStatus.UNAUTHORIZED });
    });

    it('links the provider identity returned by the provider to the authenticated link-flow user', async () => {
      const issued = await (controller as any).signState({
        provider: 'google',
        returnTo: 'https://optimistic-tanuki.example/login',
        appScope: 'client-interface',
        issuedAt: Date.now(),
        linkUserId: 'user-1',
      });
      jest.spyOn(controller as any, 'exchangeProviderCode').mockResolvedValue({
        providerUserId: 'provider-derived-id',
        email: 'person@example.com',
        emailVerified: true,
        displayName: 'Person Example',
        firstName: 'Person',
        lastName: 'Example',
      });
      (authClient.send as jest.Mock).mockReturnValue(
        of({ data: { id: 'link-1' } })
      );
      const response = { redirect: jest.fn() } as any;

      await controller.oauthRedirectCallback(
        {
          params: { provider: 'google' },
          query: { code: 'provider-code', state: issued.state },
          cookies: {
            oauth_state_nonce: JSON.stringify([
              { id: issued.stateId, nonce: issued.nonce },
            ]),
          },
        } as any,
        response
      );

      expect(authClient.send).toHaveBeenCalledWith(
        { cmd: AuthCommands.LinkProvider },
        {
          userId: 'user-1',
          provider: 'google',
          providerUserId: 'provider-derived-id',
          providerEmail: 'person@example.com',
          providerDisplayName: 'Person Example',
        }
      );
      expect(response.redirect).toHaveBeenCalledWith(
        expect.stringContaining('linked=google')
      );
      expect(authClient.send).not.toHaveBeenCalledWith(
        { cmd: AuthCommands.OAuthLogin },
        expect.anything()
      );
    });

    it('completes a valid callback once with its browser-bound nonce', async () => {
      process.env.OAUTH_STATE_SECRET = 'state-secret';
      const issued = await (controller as any).signState({
        provider: 'google',
        returnTo: 'https://optimistic-tanuki.example/login',
        appScope: 'client-interface',
        issuedAt: Date.now(),
      });
      jest.spyOn(controller as any, 'exchangeProviderCode').mockResolvedValue({
        providerUserId: 'google-user',
        email: 'person@example.com',
        emailVerified: true,
        displayName: 'Person Example',
        firstName: 'Person',
        lastName: 'Example',
      });
      (authClient.send as jest.Mock).mockImplementation(
        (command: { cmd: string }) =>
          of(
            command.cmd === AuthCommands.OAuthLogin
              ? { data: { userId: 'user-1' } }
              : { data: { newToken: 'platform-token' } }
          )
      );
      const profileClient = (controller as any).profileClient;
      profileClient.send.mockReturnValue(
        of([
          { id: 'profile-1', userId: 'user-1', appScope: 'client-interface' },
        ])
      );
      const response = { redirect: jest.fn() } as any;
      await controller.oauthRedirectCallback(
        {
          params: { provider: 'google' },
          query: { code: 'provider-code', state: issued.state },
          cookies: {
            oauth_state_nonce: JSON.stringify([
              { id: issued.stateId, nonce: issued.nonce },
            ]),
          },
        } as any,
        response
      );
      const callbackUrl = new URL(response.redirect.mock.calls[0][0]);
      const callbackCode = callbackUrl.searchParams.get('callbackCode');
      expect(callbackCode).toEqual(expect.any(String));
      expect(callbackUrl.searchParams.has('token')).toBe(false);

      await expect(
        controller.redeemCallbackCode({ callbackCode: callbackCode! }, {
          headers: { origin: 'https://attacker.example' },
          cookies: {
            oauth_state_nonce: JSON.stringify([
              { id: issued.stateId, nonce: issued.nonce },
            ]),
          },
        } as any)
      ).rejects.toMatchObject({ status: HttpStatus.UNAUTHORIZED });
      await expect(
        controller.redeemCallbackCode({ callbackCode: callbackCode! }, {
          headers: { origin: 'https://optimistic-tanuki.example' },
          cookies: {
            oauth_state_nonce: JSON.stringify([
              { id: issued.stateId, nonce: issued.nonce },
            ]),
          },
        } as any)
      ).resolves.toEqual({ token: 'platform-token' });
      await expect(
        controller.redeemCallbackCode({ callbackCode: callbackCode! }, {
          headers: { origin: 'https://optimistic-tanuki.example' },
          cookies: {
            oauth_state_nonce: JSON.stringify([
              { id: issued.stateId, nonce: issued.nonce },
            ]),
          },
        } as any)
      ).rejects.toMatchObject({ status: HttpStatus.UNAUTHORIZED });
      const replayResponse = {
        redirect: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;
      await controller.oauthRedirectCallback(
        {
          params: { provider: 'google' },
          query: { code: 'provider-code', state: issued.state },
          cookies: {
            oauth_state_nonce: JSON.stringify([
              { id: issued.stateId, nonce: issued.nonce },
            ]),
          },
        } as any,
        replayResponse
      );
      expect(replayResponse.status).toHaveBeenCalledWith(
        HttpStatus.BAD_REQUEST
      );
      expect(replayResponse.json).toHaveBeenCalledWith({
        error: 'invalid_oauth_callback',
        error_description: 'OAuth callback could not be validated.',
      });
    });

    it('returns a generic public error when callback state is invalid', async () => {
      const response = {
        redirect: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.oauthRedirectCallback(
        {
          params: { provider: 'google' },
          query: { code: 'provider-code', state: 'not-a-valid-state' },
          cookies: {
            oauth_state_nonce: JSON.stringify([
              { id: 'not-a-valid-state', nonce: 'nonce' },
            ]),
          },
        } as any,
        response
      );

      expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(response.json).toHaveBeenCalledWith({
        error: 'invalid_oauth_callback',
        error_description: 'OAuth callback could not be validated.',
      });
      expect(response.redirect).not.toHaveBeenCalled();
    });
  });

  describe('provider requests', () => {
    it('bounds the token exchange with an abort signal', async () => {
      configGet.mockImplementation((key: string) =>
        key === 'oauth.google'
          ? {
              clientId: 'client-id',
              clientSecret: 'client-secret',
              redirectUri:
                'https://optimistic-tanuki.example/oauth/callback/google',
              tokenEndpoint: 'https://provider.example/token',
              userInfoEndpoint: 'https://provider.example/userinfo',
            }
          : undefined
      );
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      await expect(
        (controller as any).exchangeProviderCode('google', 'provider-code')
      ).rejects.toThrow('OAuth provider request failed');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://provider.example/token',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      fetchMock.mockRestore();
    });

    it('normalizes upstream aborts into a safe callback redirect', async () => {
      const issued = await (controller as any).signState({
        provider: 'google',
        returnTo: 'https://optimistic-tanuki.example/login',
        appScope: 'client-interface',
        issuedAt: Date.now(),
      });
      jest
        .spyOn(controller as any, 'exchangeProviderCode')
        .mockRejectedValue(
          new DOMException(
            'provider access_token=secret-token timed out',
            'AbortError'
          )
        );
      const response = { redirect: jest.fn() } as any;

      await controller.oauthRedirectCallback(
        {
          params: { provider: 'google' },
          query: { code: 'provider-code', state: issued.state },
          cookies: {
            oauth_state_nonce: JSON.stringify([
              { id: issued.stateId, nonce: issued.nonce },
            ]),
          },
        } as any,
        response
      );

      const callbackUrl = new URL(response.redirect.mock.calls[0][0]);
      expect(callbackUrl.searchParams.get('error')).toBe(
        'oauth_callback_failed'
      );
      expect(callbackUrl.searchParams.get('error_description')).toBe(
        'OAuth authentication could not be completed.'
      );
      expect(response.redirect.mock.calls[0][0]).not.toContain('secret-token');
      expect(callbackUrl.searchParams.has('callbackCode')).toBe(false);
      expect(callbackUrl.searchParams.has('token')).toBe(false);
    });
  });

  describe('getOAuthConfig', () => {
    it('returns sanitized provider config from the gateway source of truth', async () => {
      configGet.mockImplementation((key: string) =>
        key === 'oauth.google'
          ? {
              enabled: true,
              clientId: 'public-client-id',
              clientSecret: 'must-not-leak',
              scopes: ['openid'],
              authorizationEndpoint:
                'https://accounts.google.com/o/oauth2/v2/auth',
            }
          : undefined
      );

      const result = await controller.getOAuthConfig(
        { headers: { origin: 'https://optimistic-tanuki.example' } } as any,
        undefined
      );

      expect(result).toEqual({
        google: {
          clientId: 'public-client-id',
          redirectUri:
            'https://optimistic-tanuki.example/oauth/callback/google',
          scopes: ['openid'],
          authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
          enabled: true,
        },
      });
      expect(JSON.stringify(result)).not.toContain('must-not-leak');
      expect(authClient.send).not.toHaveBeenCalled();
    });
  });

  describe('oauthCallback', () => {
    it('rejects legacy callbacks without forwarding their unverified body', async () => {
      const callbackRequest = {
        provider: 'google' as any,
        code: 'auth-code',
        accessToken: 'attacker-supplied-access-token',
        refreshToken: 'attacker-supplied-refresh-token',
      };

      await expect(controller.oauthCallback()).rejects.toMatchObject({
        status: HttpStatus.GONE,
      });
      expect(authClient.send).not.toHaveBeenCalled();
    });
  });

  describe('linkProvider', () => {
    it('retires the direct link endpoint so client-supplied provider identities cannot be linked', async () => {
      await expect(controller.linkProvider()).rejects.toMatchObject({
        status: HttpStatus.GONE,
      });
      expect(authClient.send).not.toHaveBeenCalled();
    });

    it('starts a guarded OAuth flow that keeps the link user ID server-side', async () => {
      configGet.mockImplementation((key: string) =>
        key === 'oauth.google'
          ? {
              enabled: true,
              clientId: 'client-id',
              scopes: ['openid'],
              authorizationEndpoint:
                'https://accounts.google.com/o/oauth2/v2/auth',
            }
          : undefined
      );
      const response = { redirect: jest.fn(), cookie: jest.fn() } as any;

      await controller.startOAuthLink(
        { params: { provider: 'google' }, user: { userId: 'user-1' } } as any,
        response,
        'https://optimistic-tanuki.example/login',
        'client-interface',
        undefined
      );

      const state = new URL(
        response.redirect.mock.calls[0][0]
      ).searchParams.get('state')!;
      expect(state).not.toContain('user-1');
      const stateId = state.split('.')[0];
      const nonce = JSON.parse(response.cookie.mock.calls[0][1])[0].nonce;
      await expect(
        (controller as any).verifyAndConsumeState(state, 'google', nonce)
      ).resolves.toMatchObject({ linkUserId: 'user-1' });
    });
  });

  describe('unlinkProvider', () => {
    it('should unlink a provider from the current user', async () => {
      const mockResult = {
        message: 'Provider google unlinked successfully',
        code: 0,
      };
      (authClient.send as jest.Mock).mockReturnValue(of(mockResult));

      const user = {
        userId: 'user-1',
        email: 'test@test.com',
        name: 'Test',
        profileId: 'p1',
        exp: 0,
        iat: 0,
      };
      const unlinkRequest = { provider: 'google' as any };
      const result = await controller.unlinkProvider(unlinkRequest, { user });

      expect(authClient.send).toHaveBeenCalledWith(
        { cmd: AuthCommands.UnlinkProvider },
        { ...unlinkRequest, userId: 'user-1' }
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw HttpException on error', async () => {
      (authClient.send as jest.Mock).mockImplementation(() => {
        throw new Error('unlink error');
      });

      const user = {
        userId: 'user-1',
        email: 'test@test.com',
        name: 'Test',
        profileId: 'p1',
        exp: 0,
        iat: 0,
      };
      const unlinkRequest = { provider: 'google' as any };
      await expect(
        controller.unlinkProvider(unlinkRequest, { user })
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getLinkedProviders', () => {
    it('should return linked providers for the current user', async () => {
      const mockResult = {
        message: 'Linked providers retrieved',
        code: 0,
        data: [{ provider: 'google', providerEmail: 'test@gmail.com' }],
      };
      (authClient.send as jest.Mock).mockReturnValue(of(mockResult));

      const user = {
        userId: 'user-1',
        email: 'test@test.com',
        name: 'Test',
        profileId: 'p1',
        exp: 0,
        iat: 0,
      };
      const result = await controller.getLinkedProviders({ user });

      expect(authClient.send).toHaveBeenCalledWith(
        { cmd: AuthCommands.GetLinkedProviders },
        { userId: 'user-1' }
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw HttpException on error', async () => {
      (authClient.send as jest.Mock).mockImplementation(() => {
        throw new Error('providers error');
      });

      const user = {
        userId: 'user-1',
        email: 'test@test.com',
        name: 'Test',
        profileId: 'p1',
        exp: 0,
        iat: 0,
      };
      await expect(controller.getLinkedProviders({ user })).rejects.toThrow(
        HttpException
      );
    });
  });

  describe('account-mutating identity routes require AuthGuard', () => {
    // These routes used to have NO guard at all (not even @Public()), so an
    // unsigned/forged JWT read via the unverified `@User()` decorator could
    // link/unlink providers or list linked providers for an arbitrary victim.
    // AuthGuard must now be present so a bad signature is rejected with 401
    // before the handler (and its guard-verified `request.user`) ever runs.
    it('guards link initiation, direct-link retirement, unlink, and provider listing with AuthGuard', () => {
      expect(
        Reflect.getMetadata(
          GUARDS_METADATA,
          OAuthController.prototype.startOAuthLink
        )
      ).toEqual(expect.arrayContaining([AuthGuard]));
      expect(
        Reflect.getMetadata(
          GUARDS_METADATA,
          OAuthController.prototype.linkProvider
        )
      ).toEqual(expect.arrayContaining([AuthGuard]));
      expect(
        Reflect.getMetadata(
          GUARDS_METADATA,
          OAuthController.prototype.unlinkProvider
        )
      ).toEqual(expect.arrayContaining([AuthGuard]));
      expect(
        Reflect.getMetadata(
          GUARDS_METADATA,
          OAuthController.prototype.getLinkedProviders
        )
      ).toEqual(expect.arrayContaining([AuthGuard]));
    });
  });
});

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
    delete process.env.APP_SCOPE_ORIGINS;
    configGet = jest.fn();
    authClient = {
      send: jest.fn().mockReturnValue(of(true)),
      connect: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<ClientProxy>;

    const profileClient = {
      send: jest.fn().mockReturnValue(of([])),
      connect: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<ClientProxy>;
    const permissionsClient = {
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
          provide: 'PERMISSIONS_SERVICE',
          useValue: permissionsClient,
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
              {
                appId: 'forgeofwill',
                name: 'Forge of Will',
                domain: 'forgeofwill.com',
                uiBaseUrl: 'https://forgeofwill.com',
                apiBaseUrl: 'https://forgeofwill.com/api',
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

  it('always sends the final callback through the Client Interface proxy', () => {
    process.env.CLIENT_INTERFACE_UI_BASE_URL = 'https://proxy.example/';

    expect((controller as any).buildFinalCallbackUrl()).toBe(
      'https://proxy.example/oauth/callback'
    );
  });

  it('uses the exact Forge callback proxy origin for the Forge app scope', () => {
    process.env.CLIENT_INTERFACE_UI_BASE_URL = 'http://localhost:8080';
    process.env.APP_SCOPE_ORIGINS = JSON.stringify({
      forgeofwill: 'http://forgeofwill.localhost:8081',
    });

    expect((controller as any).buildFinalCallbackUrl('forgeofwill')).toBe(
      'http://forgeofwill.localhost:8081/oauth/callback'
    );
  });

  it('keeps the client-interface callback proxy on the global default origin', () => {
    process.env.CLIENT_INTERFACE_UI_BASE_URL = 'http://localhost:8080';
    process.env.APP_SCOPE_ORIGINS = JSON.stringify({
      forgeofwill: 'http://forgeofwill.localhost:8081',
    });

    expect((controller as any).buildFinalCallbackUrl('client-interface')).toBe(
      'http://localhost:8080/oauth/callback'
    );
  });

  it('maps the exact Forge E2E callback origin to the Forge app scope', () => {
    process.env.APP_SCOPE_ORIGINS = JSON.stringify({
      forgeofwill: 'http://forgeofwill.localhost:8081',
    });

    expect(
      (controller as any).resolveAppScopeForReturnTo(
        'http://forgeofwill.localhost:8081/login'
      )
    ).toBe('forgeofwill');
  });

  it('resolves the finance profile-scope alias to the registered Fin Commander app ID', () => {
    process.env.APP_SCOPE_ORIGINS = JSON.stringify({
      finance: 'http://fin-commander.localhost:8089',
    });

    expect(
      (controller as any).resolveAppScopeForReturnTo(
        'http://fin-commander.localhost:8089/login'
      )
    ).toBe('fin-commander');
    expect((controller as any).profileScopeForApp('fin-commander')).toBe(
      'finance'
    );
  });

  it('rejects production OAuth registration for owner-console', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await expect(
        (controller as any).registerOAuthUser('owner-console', 'google', {
          providerUserId: 'google-owner',
          email: 'owner@example.com',
          emailVerified: true,
          displayName: 'Owner User',
          firstName: 'Owner',
          lastName: 'User',
        })
      ).rejects.toThrow('Owner Console accounts must be provisioned');
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
    }
  });

  it('carries a provider-verified email assertion only when registering a new OAuth account', async () => {
    const registerBootstrap = (controller as any).registerBootstrap;
    registerBootstrap.register.mockResolvedValue({
      data: { user: { id: '89275026-3642-5afe-be87-ca57f818b2c2' } },
    });
    (authClient.send as jest.Mock).mockReturnValue(
      of({ data: { id: 'oauth-1' } })
    );

    await (controller as any).registerOAuthUser('digital-homestead', 'google', {
      providerUserId: 'google-user',
      email: 'person@example.com',
      emailVerified: true,
      displayName: 'Person Example',
      firstName: 'Person',
      lastName: 'Example',
    });

    expect(authClient.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.LinkProvider },
      expect.objectContaining({
        userId: '89275026-3642-5afe-be87-ca57f818b2c2',
        providerEmail: 'person@example.com',
        providerEmailVerified: true,
      })
    );
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
        'google',
        'https://optimistic-tanuki.example/login',
        'client-interface',
        undefined
      );

      const redirect = new URL(response.redirect.mock.calls[0][0]);
      expect(redirect.searchParams.get('state')).toMatch(
        /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
      );
      expect(redirect.searchParams.get('code_challenge_method')).toBe('S256');
      expect(redirect.searchParams.get('code_challenge')).toMatch(
        /^[A-Za-z0-9_-]{43}$/
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

    it('uses Forge’s exact app-scoped gateway callback URI and a host-only nonce cookie', async () => {
      process.env.CLIENT_INTERFACE_UI_BASE_URL = 'http://localhost:8080';
      process.env.APP_SCOPE_ORIGINS = JSON.stringify({
        forgeofwill: 'http://forgeofwill.localhost:8081',
      });
      configGet.mockImplementation((key: string) =>
        key === 'oauth.google'
          ? {
              enabled: true,
              clientId: 'client-id',
              redirectUri: 'http://localhost:8080/api/oauth/callback/google',
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
        'google',
        'http://forgeofwill.localhost:8081/login',
        'forgeofwill',
        'forgeofwill.localhost'
      );

      const authorizationUrl = new URL(response.redirect.mock.calls[0][0]);
      expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(
        'http://forgeofwill.localhost:8081/api/oauth/callback/google'
      );
      expect(response.cookie.mock.calls[0][2]).not.toHaveProperty('domain');
    });

    it('keeps the client-interface provider callback on its global gateway callback URI', async () => {
      process.env.CLIENT_INTERFACE_UI_BASE_URL = 'http://localhost:8080';
      process.env.APP_SCOPE_ORIGINS = JSON.stringify({
        forgeofwill: 'http://forgeofwill.localhost:8081',
      });
      configGet.mockImplementation((key: string) =>
        key === 'oauth.google'
          ? {
              enabled: true,
              clientId: 'client-id',
              redirectUri: 'https://not-the-callback.example/google',
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
        'google',
        'http://localhost:8080/login',
        'client-interface',
        'localhost'
      );

      expect(
        new URL(response.redirect.mock.calls[0][0]).searchParams.get(
          'redirect_uri'
        )
      ).toBe('http://localhost:8080/api/oauth/callback/google');
    });

    it('rejects a caller-supplied app scope that differs from returnTo', async () => {
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
          'google',
          'https://optimistic-tanuki.example/login',
          'owner-console',
          undefined
        )
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });

    it('rejects the retired shared localhost Forge return origin', async () => {
      await expect(
        controller.startOAuth(
          request,
          { redirect: jest.fn(), cookie: jest.fn() } as any,
          'google',
          'http://localhost:8081/login',
          'forgeofwill',
          undefined
        )
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
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
        'google',
        'https://optimistic-tanuki.example/login',
        'client-interface',
        undefined
      );
      const firstCookie = firstResponse.cookie.mock.calls[0][1];
      const secondResponse = { redirect: jest.fn(), cookie: jest.fn() } as any;
      await controller.startOAuth(
        { ...request, cookies: { oauth_state_nonce: firstCookie } } as any,
        secondResponse,
        'google',
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
          'google',
          'https://optimistic-tanuki.example/login',
          'client-interface',
          undefined
        )
      ).rejects.toMatchObject({ status: HttpStatus.SERVICE_UNAVAILABLE });
    });

    it('uses the app-scoped gateway callback instead of a global provider redirect URI', async () => {
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
        'google',
        'https://optimistic-tanuki.example/login',
        'client-interface',
        undefined
      );

      const redirect = new URL(response.redirect.mock.calls[0][0]);
      expect(redirect.searchParams.get('redirect_uri')).toBe(
        'https://optimistic-tanuki.example/api/oauth/callback/google'
      );
    });

    it('uses the app-scoped gateway callback when config omits redirect URI', async () => {
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
        'google',
        'https://optimistic-tanuki.example/login',
        'client-interface',
        undefined
      );

      const redirect = new URL(response.redirect.mock.calls[0][0]);
      expect(redirect.searchParams.get('redirect_uri')).toBe(
        'https://optimistic-tanuki.example/api/oauth/callback/google'
      );
    });
  });

  describe('age-checked OAuth initiation', () => {
    const oauthConfig = {
      enabled: true,
      clientId: 'client-id',
      scopes: ['openid'],
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    };

    beforeEach(() => {
      configGet.mockImplementation((key: string) =>
        key === 'oauth.google' ? oauthConfig : undefined
      );
    });

    it.each([
      [{ dateOfBirth: '2016-01-01' }, HttpStatus.FORBIDDEN],
      [{ dateOfBirth: '2010-01-01' }, HttpStatus.FORBIDDEN],
    ])(
      'rejects an underage OAuth registration context',
      async (body, status) => {
        await expect(
          controller.startAgeCheckedOAuth(
            { params: { provider: 'google' }, cookies: {} } as any,
            { cookie: jest.fn() } as any,
            'google',
            {
              returnTo: 'https://optimistic-tanuki.example/register',
              ...body,
            } as any
          )
        ).rejects.toMatchObject({ status });
        expect(authClient.send).not.toHaveBeenCalled();
      }
    );

    it('starts existing-account-only OAuth when DOB is omitted', async () => {
      const response = { cookie: jest.fn() } as any;
      const result = await controller.startAgeCheckedOAuth(
        { params: { provider: 'google' }, cookies: {} } as any,
        response,
        'google',
        {
          returnTo: 'https://optimistic-tanuki.example/login',
          appScope: 'client-interface',
        } as any
      );

      const stateId = new URL(result.authorizationUrl).searchParams
        .get('state')!
        .split('.')[0];
      const stored = await (controller as any).oauthStateStore.consume(stateId);
      expect(stored.payload).toMatchObject({
        appScope: 'client-interface',
        registrationAllowed: false,
      });
      expect(stored.payload.ageEligibilityStatus).toBeUndefined();
    });

    it('keeps adult DOB out of the redirect URL and retains only the server assessment', async () => {
      const dateOfBirth = new Date();
      dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 30);
      const response = { cookie: jest.fn() } as any;

      const result = await controller.startAgeCheckedOAuth(
        { params: { provider: 'google' }, cookies: {} } as any,
        response,
        'google',
        {
          returnTo: 'https://optimistic-tanuki.example/register',
          appScope: 'client-interface',
          dateOfBirth: dateOfBirth.toISOString().slice(0, 10),
        } as any
      );

      const authorizationUrl = new URL(result.authorizationUrl);
      expect(authorizationUrl.searchParams.has('dateOfBirth')).toBe(false);
      expect(authorizationUrl.searchParams.has('guardianResumeToken')).toBe(
        false
      );
      const stateId = authorizationUrl.searchParams.get('state')!.split('.')[0];
      const stored = await (controller as any).oauthStateStore.consume(stateId);
      expect(stored.payload).toMatchObject({
        appScope: 'client-interface',
        ageEligibilityStatus: 'adult',
      });
      expect(stored.payload).not.toHaveProperty('dateOfBirth');
    });

    it('binds an approved teen resume token to server state without exposing it to the provider', async () => {
      const resumeToken = 'opaque-private-resume-token';
      (authClient.send as jest.Mock).mockReturnValue(
        of({ valid: true, email: 'teen@example.invalid' })
      );
      const result = await controller.startAgeCheckedOAuth(
        { params: { provider: 'google' }, cookies: {} } as any,
        { cookie: jest.fn() } as any,
        'google',
        {
          returnTo: 'https://optimistic-tanuki.example/register',
          appScope: 'client-interface',
          guardianResumeToken: resumeToken,
        } as any
      );

      const authorizationUrl = new URL(result.authorizationUrl);
      expect(authorizationUrl.href).not.toContain(resumeToken);
      const stateId = authorizationUrl.searchParams.get('state')!.split('.')[0];
      const stored = await (controller as any).oauthStateStore.consume(stateId);
      expect(stored.payload).toMatchObject({
        guardianResumeToken: resumeToken,
        guardianApplicantEmail: 'teen@example.invalid',
      });
      expect(stored.payload).not.toHaveProperty('dateOfBirth');
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
    it('reuses Forge’s signed provider callback URI for the token exchange', async () => {
      process.env.CLIENT_INTERFACE_UI_BASE_URL = 'http://localhost:8080';
      process.env.APP_SCOPE_ORIGINS = JSON.stringify({
        forgeofwill: 'http://forgeofwill.localhost:8081',
      });
      jest.spyOn(controller as any, 'verifyAndConsumeState').mockResolvedValue({
        provider: 'google',
        returnTo: 'http://forgeofwill.localhost:8081/login',
        appScope: 'forgeofwill',
        providerRedirectUri:
          'http://forgeofwill.localhost:8081/api/oauth/callback/google',
        codeVerifier: 'a'.repeat(43),
        issuedAt: Date.now(),
      });
      const exchangeProviderCode = jest
        .spyOn(controller as any, 'exchangeProviderCode')
        .mockResolvedValue({
          providerUserId: ' ',
          email: 'person@example.test',
          emailVerified: true,
          displayName: 'Person',
          firstName: 'Person',
          lastName: 'Example',
        });
      const response = { redirect: jest.fn() } as any;

      await controller.oauthRedirectCallback(
        {
          params: { provider: 'google' },
          query: { code: 'provider-code', state: 'valid-state' },
          cookies: { oauth_state_nonce: '[]' },
        } as any,
        response,
        'google'
      );

      expect(exchangeProviderCode).toHaveBeenCalledWith(
        'google',
        'provider-code',
        'forgeofwill.localhost',
        'a'.repeat(43),
        'http://forgeofwill.localhost:8081/api/oauth/callback/google'
      );
    });

    it('rejects a callback state whose provider redirect URI does not match its signed app scope', async () => {
      process.env.CLIENT_INTERFACE_UI_BASE_URL = 'http://localhost:8080';
      process.env.APP_SCOPE_ORIGINS = JSON.stringify({
        forgeofwill: 'http://forgeofwill.localhost:8081',
      });
      jest.spyOn(controller as any, 'verifyAndConsumeState').mockResolvedValue({
        provider: 'google',
        returnTo: 'http://forgeofwill.localhost:8081/login',
        appScope: 'forgeofwill',
        providerRedirectUri: 'http://localhost:8080/api/oauth/callback/google',
        codeVerifier: 'a'.repeat(43),
        issuedAt: Date.now(),
      });
      const exchangeProviderCode = jest.spyOn(
        controller as any,
        'exchangeProviderCode'
      );
      const response = {
        redirect: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.oauthRedirectCallback(
        {
          params: { provider: 'google' },
          query: { code: 'provider-code', state: 'valid-state' },
          cookies: { oauth_state_nonce: '[]' },
        } as any,
        response,
        'google'
      );

      expect(exchangeProviderCode).not.toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'invalid_oauth_callback' })
      );
    });

    it('rejects a blank provider stable id before it can be linked or used to sign in', async () => {
      const issued = await (controller as any).signState({
        provider: 'google',
        returnTo: 'https://optimistic-tanuki.example/login',
        appScope: 'client-interface',
        issuedAt: Date.now(),
        linkUserId: '89275026-3642-5afe-be87-ca57f818b2c2',
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
        response,
        'google'
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
        cookieSession: true,
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
        response,
        'google'
      );

      expect(registerOAuthUser).not.toHaveBeenCalled();
      expect(
        new URL(response.redirect.mock.calls[0][0]).searchParams.get('error')
      ).toBe('oauth_callback_failed');
    });

    it('allows existing-account OAuth login from server-marked existing-only state', async () => {
      const issued = await (controller as any).signState({
        provider: 'google',
        returnTo: 'https://optimistic-tanuki.example/login',
        appScope: 'client-interface',
        issuedAt: Date.now(),
        cookieSession: true,
        registrationAllowed: false,
      });
      jest.spyOn(controller as any, 'exchangeProviderCode').mockResolvedValue({
        providerUserId: 'legacy-google-user',
        email: 'legacy@example.invalid',
        emailVerified: true,
        displayName: 'Legacy User',
        firstName: 'Legacy',
        lastName: 'User',
      });
      (authClient.send as jest.Mock).mockImplementation(
        (command: { cmd: string }) =>
          of(
            command.cmd === AuthCommands.OAuthLogin
              ? { data: { userId: 'a7a4941c-9ade-5cfb-87ae-a1a1753fc830' } }
              : command.cmd === AuthCommands.CreateOAuthCallbackSession
              ? {
                  data: {
                    sessionId: 'abababab-abab-4bab-8bab-abababababab',
                    userId: 'a7a4941c-9ade-5cfb-87ae-a1a1753fc830',
                    profileId: '4cca6fc8-1816-5afc-bb84-94f02a1bfbf3',
                    appId: 'client-interface',
                  },
                }
              : command.cmd === AuthCommands.ResolveOAuthCallbackSession
              ? { data: { token: 'legacy-platform-token' } }
              : { data: { id: 'oauth-legacy' } }
          )
      );
      const registerOAuthUser = jest.spyOn(
        controller as any,
        'registerOAuthUser'
      );
      jest
        .spyOn(controller as any, 'getOrCreateAppScopedProfile')
        .mockResolvedValue({
          id: '4cca6fc8-1816-5afc-bb84-94f02a1bfbf3',
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
        response,
        'google'
      );

      expect(registerOAuthUser).not.toHaveBeenCalled();
      expect(authClient.send).toHaveBeenCalledWith(
        { cmd: AuthCommands.OAuthLogin },
        expect.objectContaining({
          appId: 'client-interface',
          ageEligibilityStatus: undefined,
        })
      );
      expect(
        new URL(response.redirect.mock.calls[0][0]).searchParams.has(
          'callbackCode'
        )
      ).toBe(true);
    });

    it('issues a callback grant when newly registered OAuth user is verified by the platform', async () => {
      const issued = await (controller as any).signState({
        provider: 'microsoft',
        returnTo: 'https://optimistic-tanuki.example/login',
        appScope: 'client-interface',
        issuedAt: Date.now(),
        cookieSession: true,
        ageEligibilityStatus: 'adult',
      });
      jest.spyOn(controller as any, 'exchangeProviderCode').mockResolvedValue({
        providerUserId: 'microsoft-user',
        email: 'newuser@example.com',
        emailVerified: false,
        displayName: 'New User',
        firstName: 'New',
        lastName: 'User',
      });
      const registerBootstrap = (controller as any).registerBootstrap;
      registerBootstrap.register.mockResolvedValue({
        data: {
          user: {
            id: '61d9334f-61bd-5af6-882d-7d63bbbf046c',
            emailVerifiedAt: new Date('2026-08-03T15:14:11.083Z'),
          },
        },
      });
      (authClient.send as jest.Mock).mockImplementation(
        (command: { cmd: string }) =>
          of(
            command.cmd === AuthCommands.OAuthLogin
              ? { data: { needsRegistration: true } }
              : command.cmd === AuthCommands.CreateOAuthCallbackSession
              ? {
                  data: {
                    sessionId: '22222222-2222-4222-8222-222222222222',
                    userId: '61d9334f-61bd-5af6-882d-7d63bbbf046c',
                    profileId: 'eeb3151e-e115-5418-941a-1f01caa76d52',
                    appId: 'client-interface',
                  },
                }
              : command.cmd === AuthCommands.ResolveOAuthCallbackSession
              ? { data: { token: 'platform-token' } }
              : { data: { id: 'oauth-1' } }
          )
      );
      const profileClient = (controller as any).profileClient;
      profileClient.send.mockReturnValue(
        of([
          {
            id: 'eeb3151e-e115-5418-941a-1f01caa76d52',
            userId: '61d9334f-61bd-5af6-882d-7d63bbbf046c',
            appScope: 'client-interface',
          },
        ])
      );
      const response = { redirect: jest.fn() } as any;

      await controller.oauthRedirectCallback(
        {
          params: { provider: 'microsoft' },
          query: { code: 'provider-code', state: issued.state },
          cookies: {
            oauth_state_nonce: JSON.stringify([
              { id: issued.stateId, nonce: issued.nonce },
            ]),
          },
        } as any,
        response,
        'microsoft'
      );

      const callbackUrl = new URL(response.redirect.mock.calls[0][0]);
      expect(callbackUrl.searchParams.get('callbackCode')).toEqual(
        expect.any(String)
      );
      expect(callbackUrl.searchParams.has('error')).toBe(false);
      expect(registerBootstrap.register).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'newuser@example.com' }),
        'client-interface',
        'adult'
      );
    });

    it('blocks a new OAuth registration without server age context before profile creation', async () => {
      const issued = await (controller as any).signState({
        provider: 'google',
        returnTo: 'https://optimistic-tanuki.example/register',
        appScope: 'client-interface',
        issuedAt: Date.now(),
      });
      jest.spyOn(controller as any, 'exchangeProviderCode').mockResolvedValue({
        providerUserId: 'google-new-user',
        email: 'teen@example.invalid',
        emailVerified: true,
        displayName: 'Teen User',
        firstName: 'Teen',
        lastName: 'User',
      });
      (authClient.send as jest.Mock).mockReturnValue(
        of({ data: { needsRegistration: true } })
      );
      const registerBootstrap = (controller as any).registerBootstrap;
      const profileClient = (controller as any).profileClient;
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
        response,
        'google'
      );

      expect(registerBootstrap.register).not.toHaveBeenCalled();
      expect(profileClient.send).not.toHaveBeenCalled();
      expect(authClient.send).toHaveBeenCalledWith(
        { cmd: AuthCommands.OAuthLogin },
        expect.objectContaining({ appId: 'client-interface' })
      );
      expect(
        new URL(response.redirect.mock.calls[0][0]).searchParams.get('error')
      ).toBe('oauth_callback_failed');
    });

    it('continues a teen OAuth callback only with the matching approved applicant resume state', async () => {
      const resumeToken = 'one-use-applicant-resume';
      const issued = await (controller as any).signState({
        provider: 'google',
        returnTo: 'https://optimistic-tanuki.example/register',
        appScope: 'client-interface',
        issuedAt: Date.now(),
        guardianResumeToken: resumeToken,
        guardianApplicantEmail: 'teen@example.invalid',
      });
      jest.spyOn(controller as any, 'exchangeProviderCode').mockResolvedValue({
        providerUserId: 'google-teen',
        email: 'teen@example.invalid',
        emailVerified: true,
        displayName: 'Teen User',
        firstName: 'Teen',
        lastName: 'User',
      });
      (authClient.send as jest.Mock).mockImplementation(
        (command: { cmd: string }) =>
          of(
            command.cmd === AuthCommands.OAuthLogin
              ? { data: { needsRegistration: true } }
              : command.cmd === AuthCommands.CreateOAuthCallbackSession
              ? {
                  data: {
                    sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                    userId: '6a3faa03-a70c-5359-8bda-e64569149ca3',
                    profileId: 'e76dfce8-5e9f-5889-958d-7a3b39696a63',
                    appId: 'client-interface',
                  },
                }
              : command.cmd === AuthCommands.ResolveOAuthCallbackSession
              ? { data: { token: 'platform-token' } }
              : { data: { id: 'oauth-test' } }
          )
      );
      const registerOAuthUser = jest
        .spyOn(controller as any, 'registerOAuthUser')
        .mockResolvedValue({
          userId: '6a3faa03-a70c-5359-8bda-e64569149ca3',
          emailVerified: true,
        });
      jest
        .spyOn(controller as any, 'getOrCreateAppScopedProfile')
        .mockResolvedValue({ id: 'e76dfce8-5e9f-5889-958d-7a3b39696a63' });
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
        response,
        'google'
      );

      expect(authClient.send).toHaveBeenCalledWith(
        { cmd: AuthCommands.OAuthLogin },
        expect.objectContaining({
          appId: 'client-interface',
          guardianResumeToken: resumeToken,
        })
      );
      expect(registerOAuthUser).toHaveBeenCalledWith(
        'client-interface',
        'google',
        expect.objectContaining({ email: 'teen@example.invalid' }),
        undefined,
        resumeToken
      );
      expect(
        new URL(response.redirect.mock.calls[0][0]).searchParams.has(
          'callbackCode'
        )
      ).toBe(true);
    });

    it('rejects an existing OAuth user without a global owner role from Owner Console', async () => {
      const statePayload = {
        provider: 'google',
        returnTo: 'https://owner.example/login',
        appScope: 'owner-console',
        issuedAt: Date.now(),
      };
      jest
        .spyOn(controller as any, 'verifyAndConsumeState')
        .mockResolvedValue(statePayload);
      jest.spyOn(controller as any, 'exchangeProviderCode').mockResolvedValue({
        providerUserId: 'google-member',
        email: 'member@example.com',
        emailVerified: true,
        displayName: 'Member User',
        firstName: 'Member',
        lastName: 'User',
      });
      (authClient.send as jest.Mock).mockImplementation(
        (command: { cmd: string }) =>
          of(
            command.cmd === AuthCommands.OAuthLogin
              ? { data: { userId: 'member-user' } }
              : { data: { newToken: 'should-not-be-issued' } }
          )
      );
      const profileClient = (controller as any).profileClient;
      profileClient.send.mockReturnValue(
        of([
          {
            id: 'member-global-profile',
            userId: 'member-user',
            appScope: 'global',
          },
        ])
      );
      const response = { redirect: jest.fn() } as any;

      await controller.oauthRedirectCallback(
        {
          params: { provider: 'google' },
          query: { code: 'provider-code', state: 'state.signature' },
          cookies: {},
        } as any,
        response,
        'google'
      );

      expect(
        new URL(response.redirect.mock.calls[0][0]).searchParams.get('error')
      ).toBe('oauth_callback_failed');
      expect(authClient.send).not.toHaveBeenCalledWith(
        { cmd: AuthCommands.Issue },
        expect.anything()
      );
    });

    it('rejects an expired callback grant', async () => {
      const store = (controller as any).oauthStateStore as LocalOAuthStateStore;
      await store.createCallbackGrant('state-1.secret', {
        sessionId: '33333333-3333-4333-8333-333333333333',
        userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        profileId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        appId: 'client-interface',
        returnOrigin: 'https://optimistic-tanuki.example',
        redemptionOrigin: 'https://client-interface.example',
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

    it('redeems a cookie callback on the initiating app origin and returns the verified opener origin', async () => {
      const store = (controller as any).oauthStateStore as LocalOAuthStateStore;
      const stateId = 'state_2_callback_grant_identifier';
      const secret = 'callback_secret_for_cookie_grant';
      const callbackCode = `${stateId}.${secret}`;
      await store.createCallbackGrant(callbackCode, {
        sessionId: '44444444-4444-4444-8444-444444444444',
        userId: '55555555-5555-4555-8555-555555555555',
        profileId: '66666666-6666-4666-8666-666666666666',
        appId: 'client-interface',
        returnOrigin: 'https://forge.example',
        redemptionOrigin: 'https://optimistic-tanuki.example',
        cookieSession: true,
        stateId,
        nonceHash: (controller as any).hashNonce('nonce'),
        expiresAt: Date.now() + 60_000,
      });
      (authClient.send as jest.Mock).mockReturnValue(
        of({ data: { token: 'platform-token' } })
      );

      const targetResponse = { cookie: jest.fn() } as any;
      await expect(
        controller.redeemCallbackCode(
          { callbackCode },
          {
            headers: { origin: 'https://forge.example' },
            cookies: {
              oauth_state_nonce: JSON.stringify([
                { id: stateId, nonce: 'nonce' },
              ]),
            },
          } as any,
          targetResponse
        )
      ).resolves.toEqual({
        session: true,
        returnOrigin: 'https://forge.example',
      });
      expect(targetResponse.cookie).toHaveBeenCalledWith(
        'ot_session',
        'platform-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        })
      );
    });

    it('marks an OAuth browser session Secure in production', async () => {
      const previousNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const store = (controller as any).oauthStateStore as LocalOAuthStateStore;
      const stateId = 'production_cookie_callback_grant';
      const callbackCode = `${stateId}.callback_secret_for_production_cookie`;
      await store.createCallbackGrant(callbackCode, {
        sessionId: '77777777-7777-4777-8777-777777777777',
        userId: '88888888-8888-4888-8888-888888888888',
        profileId: '99999999-9999-4999-8999-999999999999',
        appId: 'client-interface',
        returnOrigin: 'https://optimistic-tanuki.example',
        redemptionOrigin: 'https://optimistic-tanuki.example',
        cookieSession: true,
        stateId,
        nonceHash: (controller as any).hashNonce('nonce'),
        expiresAt: Date.now() + 60_000,
      });
      (authClient.send as jest.Mock).mockReturnValue(
        of({ data: { token: 'platform-token' } })
      );
      const targetResponse = { cookie: jest.fn() } as any;

      try {
        await controller.redeemCallbackCode(
          { callbackCode },
          {
            headers: { origin: 'https://optimistic-tanuki.example' },
            cookies: {
              oauth_state_nonce: JSON.stringify([
                { id: stateId, nonce: 'nonce' },
              ]),
            },
          } as any,
          targetResponse
        );

        expect(targetResponse.cookie).toHaveBeenCalledWith(
          'ot_session',
          'platform-token',
          expect.objectContaining({
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
          })
        );
      } finally {
        if (previousNodeEnv === undefined) {
          delete process.env.NODE_ENV;
        } else {
          process.env.NODE_ENV = previousNodeEnv;
        }
      }
    });

    it('links the provider identity returned by the provider to the authenticated link-flow user', async () => {
      const issued = await (controller as any).signState({
        provider: 'google',
        returnTo: 'https://optimistic-tanuki.example/login',
        appScope: 'client-interface',
        issuedAt: Date.now(),
        cookieSession: true,
        linkUserId: '89275026-3642-5afe-be87-ca57f818b2c2',
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
        response,
        'google'
      );

      expect(authClient.send).toHaveBeenCalledWith(
        { cmd: AuthCommands.LinkProvider },
        {
          userId: '89275026-3642-5afe-be87-ca57f818b2c2',
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
        cookieSession: true,
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
              ? { data: { userId: '89275026-3642-5afe-be87-ca57f818b2c2' } }
              : command.cmd === AuthCommands.CreateOAuthCallbackSession
              ? {
                  data: {
                    sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                    userId: '89275026-3642-5afe-be87-ca57f818b2c2',
                    profileId: 'eeb3151e-e115-5418-941a-1f01caa76d52',
                    appId: 'client-interface',
                  },
                }
              : command.cmd === AuthCommands.ResolveOAuthCallbackSession
              ? { data: { token: 'platform-token' } }
              : { data: {} }
          )
      );
      const profileClient = (controller as any).profileClient;
      profileClient.send.mockReturnValue(
        of([
          {
            id: 'eeb3151e-e115-5418-941a-1f01caa76d52',
            userId: '89275026-3642-5afe-be87-ca57f818b2c2',
            appScope: 'client-interface',
          },
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
        response,
        'google'
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
      const cookieResponse = { cookie: jest.fn() } as any;
      await expect(
        controller.redeemCallbackCode(
          { callbackCode: callbackCode! },
          {
            headers: { origin: 'https://optimistic-tanuki.example' },
            cookies: {
              oauth_state_nonce: JSON.stringify([
                { id: issued.stateId, nonce: issued.nonce },
              ]),
            },
          } as any,
          cookieResponse
        )
      ).resolves.toEqual({
        session: true,
        returnOrigin: 'https://optimistic-tanuki.example',
      });
      expect(cookieResponse.cookie).toHaveBeenCalledWith(
        'ot_session',
        'platform-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        })
      );
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
        replayResponse,
        'google'
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
        response,
        'google'
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
    it('does not treat a Facebook email as a verified-email auto-link signal', async () => {
      jest.spyOn(controller as any, 'fetchProvider').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 'facebook-user',
          email: 'person@example.com',
          name: 'Person Example',
        }),
      });

      await expect(
        (controller as any).fetchProviderIdentity('facebook', 'access-token', {
          userInfoEndpoint: 'https://graph.facebook.com/v18.0/me',
        })
      ).resolves.toMatchObject({
        email: 'person@example.com',
        emailVerified: false,
      });
    });

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
        (controller as any).exchangeProviderCode(
          'google',
          'provider-code',
          undefined,
          'a'.repeat(43)
        )
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
        response,
        'google'
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
    it('advertises Forge’s exact callback origin so popup postMessage filtering matches its callback page', async () => {
      process.env.CLIENT_INTERFACE_UI_BASE_URL = 'http://localhost:8080';
      process.env.APP_SCOPE_ORIGINS = JSON.stringify({
        forgeofwill: 'http://forgeofwill.localhost:8081',
      });
      configGet.mockImplementation((key: string) =>
        key === 'oauth.google'
          ? {
              enabled: true,
              clientId: 'public-client-id',
              authorizationEndpoint:
                'https://accounts.google.com/o/oauth2/v2/auth',
            }
          : undefined
      );

      const result = await controller.getOAuthConfig(
        { headers: { origin: 'http://forgeofwill.localhost:8081' } } as any,
        undefined
      );

      expect((result as any).google.callbackOrigin).toBe(
        'http://forgeofwill.localhost:8081'
      );
    });

    it('advertises the neutral client-interface callback origin for localhost', async () => {
      process.env.CLIENT_INTERFACE_UI_BASE_URL = 'http://localhost:8080';
      process.env.APP_SCOPE_ORIGINS = JSON.stringify({
        forgeofwill: 'http://forgeofwill.localhost:8081',
      });
      configGet.mockImplementation((key: string) =>
        key === 'oauth.google'
          ? {
              enabled: true,
              clientId: 'public-client-id',
              authorizationEndpoint:
                'https://accounts.google.com/o/oauth2/v2/auth',
            }
          : undefined
      );

      const result = await controller.getOAuthConfig(
        { headers: { origin: 'http://localhost:8080' } } as any,
        undefined
      );

      expect((result as any).google.callbackOrigin).toBe(
        'http://localhost:8080'
      );
    });

    // An app's own login page fetches this config with a same-origin GET, which
    // carries no Origin header. Resolving that to client-interface told Forge to
    // accept popup messages only from client-interface's origin.
    describe('without an Origin header', () => {
      const enableGoogle = () => {
        process.env.CLIENT_INTERFACE_UI_BASE_URL = 'http://127.0.0.1:8080';
        process.env.APP_SCOPE_ORIGINS = JSON.stringify({
          forgeofwill: 'http://127.0.0.1:8081',
          finance: 'http://127.0.0.1:8089',
        });
        configGet.mockImplementation((key: string) =>
          key === 'oauth.google'
            ? {
                enabled: true,
                clientId: 'public-client-id',
                authorizationEndpoint:
                  'https://accounts.google.com/o/oauth2/v2/auth',
              }
            : undefined
        );
      };

      it('uses the Referer of a same-origin request', async () => {
        enableGoogle();
        const result = await controller.getOAuthConfig(
          {
            headers: {
              host: '127.0.0.1:8081',
              referer: 'http://127.0.0.1:8081/login',
            },
          } as any,
          undefined
        );

        expect((result as any).google.callbackOrigin).toBe(
          'http://127.0.0.1:8081'
        );
        expect((result as any).google.redirectUri).toBe(
          'http://127.0.0.1:8081/api/oauth/callback/google'
        );
      });

      it('falls back to the proxied Host when there is no Referer', async () => {
        enableGoogle();
        const result = await controller.getOAuthConfig(
          { headers: { host: '127.0.0.1:8089' }, protocol: 'http' } as any,
          undefined
        );

        expect((result as any).google.callbackOrigin).toBe(
          'http://127.0.0.1:8089'
        );
      });

      it('ignores a Host or Referer that is not a known app origin', async () => {
        enableGoogle();
        const result = await controller.getOAuthConfig(
          {
            headers: {
              host: 'evil.example',
              referer: 'https://evil.example/login',
            },
          } as any,
          undefined
        );

        expect((result as any).google.callbackOrigin).toBe(
          'http://127.0.0.1:8080'
        );
      });

      it('still prefers an explicit Origin header', async () => {
        enableGoogle();
        const result = await controller.getOAuthConfig(
          {
            headers: {
              origin: 'http://127.0.0.1:8089',
              referer: 'http://127.0.0.1:8081/login',
            },
          } as any,
          undefined
        );

        expect((result as any).google.callbackOrigin).toBe(
          'http://127.0.0.1:8089'
        );
      });
    });

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
          callbackOrigin: 'https://optimistic-tanuki.example',
          redirectUri:
            'https://optimistic-tanuki.example/api/oauth/callback/google',
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
        {
          params: { provider: 'google' },
          user: { userId: '89275026-3642-5afe-be87-ca57f818b2c2' },
        } as any,
        response,
        'google',
        'https://optimistic-tanuki.example/login',
        'client-interface',
        undefined
      );

      const state = new URL(
        response.redirect.mock.calls[0][0]
      ).searchParams.get('state')!;
      expect(state).not.toContain('89275026-3642-5afe-be87-ca57f818b2c2');
      const stateId = state.split('.')[0];
      const nonce = JSON.parse(response.cookie.mock.calls[0][1])[0].nonce;
      await expect(
        (controller as any).verifyAndConsumeState(state, 'google', nonce)
      ).resolves.toMatchObject({
        linkUserId: '89275026-3642-5afe-be87-ca57f818b2c2',
      });
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
        userId: '89275026-3642-5afe-be87-ca57f818b2c2',
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
        { ...unlinkRequest, userId: '89275026-3642-5afe-be87-ca57f818b2c2' }
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw HttpException on error', async () => {
      (authClient.send as jest.Mock).mockImplementation(() => {
        throw new Error('unlink error');
      });

      const user = {
        userId: '89275026-3642-5afe-be87-ca57f818b2c2',
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
        userId: '89275026-3642-5afe-be87-ca57f818b2c2',
        email: 'test@test.com',
        name: 'Test',
        profileId: 'p1',
        exp: 0,
        iat: 0,
      };
      const result = await controller.getLinkedProviders({ user });

      expect(authClient.send).toHaveBeenCalledWith(
        { cmd: AuthCommands.GetLinkedProviders },
        { userId: '89275026-3642-5afe-be87-ca57f818b2c2' }
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw HttpException on error', async () => {
      (authClient.send as jest.Mock).mockImplementation(() => {
        throw new Error('providers error');
      });

      const user = {
        userId: '89275026-3642-5afe-be87-ca57f818b2c2',
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

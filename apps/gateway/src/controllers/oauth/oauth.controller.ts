import { sessionCookieOptions } from '../../auth/session-policy';
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  HttpException,
  HttpStatus,
  Logger,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  AppRegistration,
  AppRegistry,
  isApprovedAuthEmailSender,
} from '@optimistic-tanuki/app-registry-backend';
import {
  CreateProfileDto,
  OAuthProvider,
  ProfileDto,
  RegisterRequest,
  UnlinkProviderRequest,
} from '@optimistic-tanuki/models';
import { firstValueFrom, timeout } from 'rxjs';
import {
  AuthCommands,
  ProfileCommands,
  RoleCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { Public } from '../../decorators/public.decorator';
import { AuthGuard } from '../../auth/auth.guard';
import {
  RoleInitBuilder,
  RoleInitService,
} from '@optimistic-tanuki/permission-lib';
import { Request, Response } from 'express';
import { RegisterAccountBootstrapService } from '@optimistic-tanuki/auth-feature-account-bootstrap';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import validator from 'validator';
import { GATEWAY_APP_REGISTRY } from '../registry/registry.controller';
import {
  OAUTH_STATE_STORE,
  OAuthStateStore,
  PendingOAuthBinding,
  PendingOAuthKind,
  StoredPendingOAuthIntent,
} from './oauth-state.store';
import { emitSafeDiagnostic } from '@optimistic-tanuki/logger';
import {
  DEFAULT_CODE_FOR_STEP,
  isDeletionFenceError,
  OAUTH_ERROR_DESCRIPTIONS,
  OAUTH_ERROR_STATUS,
  OAuthErrorCode,
  OAuthFlowError,
  OAuthStep,
  guardianReturnPathFor,
  isAgeGatedApp,
} from './oauth-flow-error';

type GatewayOAuthProviderConfig = {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  scopes?: string[];
  enabled?: boolean;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  userInfoEndpoint?: string;
};

type OAuthStatePayload = {
  provider: string;
  returnTo: string;
  appScope: string;
  /** Exact provider callback selected during initiation and retained server-side. */
  providerRedirectUri?: string;
  issuedAt: number;
  /** Server-held PKCE verifier; never serialized into the browser state. */
  codeVerifier: string;
  cookieSession?: boolean;
  /** Present only in the server-side one-time state record for link flows. */
  linkUserId?: string;
  /** Gateway-validated age result or applicant resume secret, held only in server-side state. */
  ageEligibilityStatus?: 'adult';
  /** False means this flow may authenticate an existing account but never bootstrap a new one. */
  registrationAllowed?: boolean;
  guardianResumeToken?: string;
  guardianApplicantEmail?: string;
};

/** What a sign-in needs once the provider identity is known. */
type OAuthSignInContext = {
  provider: string;
  identity: OAuthIdentity;
  appScope: string;
  returnTo: string;
  stateId: string;
  nonce: string;
  cookieSession: boolean;
};

type OAuthIdentity = {
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  firstName: string;
  lastName: string;
};

@ApiTags('oauth')
@Controller('oauth')
export class OAuthController {
  private readonly providers = ['google', 'github', 'microsoft', 'facebook'];
  private readonly oauthStateTtlMs = 10 * 60 * 1000;
  private readonly callbackGrantTtlMs = 60 * 1000;
  private readonly pendingMaxAttempts = 5;
  private readonly linkCodeCooldownMs = 60 * 1000;
  private readonly providerRequestTimeoutMs = 10 * 1000;
  private readonly ownerCheckTimeoutMs = 3 * 1000;

  constructor(
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE)
    private readonly authClient: ClientProxy,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileClient: ClientProxy,
    @Inject(ServiceTokens.PERMISSIONS_SERVICE)
    private readonly permissionsClient: ClientProxy,
    @Inject(GATEWAY_APP_REGISTRY)
    private readonly registry: AppRegistry,
    private readonly logger: Logger,
    private readonly roleInit: RoleInitService,
    private readonly configService: ConfigService,
    private readonly registerBootstrap: RegisterAccountBootstrapService,
    @Inject(OAUTH_STATE_STORE)
    private readonly oauthStateStore: OAuthStateStore
  ) {
    this.authClient
      .connect()
      .then(() => {
        this.logger.log('OAuthController connected to authClient');
      })
      .catch((e) => this.logger.error('OAuthController connection error:', e));
  }

  @Get('start/:provider')
  @Public()
  @Throttle({ short: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Initiate shared OAuth login',
    description:
      'Starts server-owned OAuth flow and redirects the popup to the provider. The provider callback always lands on client-interface first.',
  })
  async startOAuth(
    @Req() request: Request,
    @Res() response: Response,
    // Declared for OpenAPI (orval validates path params); runtime reads
    // request.params directly — do not remove.
    @Param('provider') _provider: string,
    @Query('returnTo') returnTo: string | undefined,
    @Query('appScope') requestedAppScope: string | undefined,
    @Query('domain') queryDomain: string | undefined,
    @Query('sessionMode') sessionMode?: string
  ) {
    return this.beginOAuthFlow(
      request,
      response,
      returnTo,
      requestedAppScope,
      queryDomain,
      undefined,
      true,
      sessionMode === 'cookie'
    );
  }

  @Post('start/:provider')
  @Public()
  @Throttle({ short: { limit: 20, ttl: 60_000 } })
  async startAgeCheckedOAuth(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Param('provider') _provider: string,
    @Body()
    body: {
      returnTo: string;
      appScope?: string;
      sessionMode?: string;
      dateOfBirth?: string;
      guardianResumeToken?: string;
    }
  ): Promise<{ authorizationUrl: string }> {
    const returnTo = this.validateReturnTo(body.returnTo);
    const appId = this.resolveAppScopeForReturnTo(returnTo);
    let ageEligibilityStatus: 'adult' | undefined;
    let guardianApplicantEmail: string | undefined;
    let registrationAllowed = true;
    if (appId === 'client-interface' || appId === 'local-hub') {
      if (body.guardianResumeToken) {
        const resumed = (await firstValueFrom(
          this.authClient.send(
            { cmd: AuthCommands.ValidateGuardianResume },
            { token: body.guardianResumeToken }
          )
        )) as { valid: true; email: string };
        guardianApplicantEmail = resumed.email;
      } else {
        const age = this.ageAtRegistration(body.dateOfBirth);
        if (age === null) {
          registrationAllowed = false;
        } else {
          if (age < 13)
            throw new HttpException(
              'OAuth sign-in is unavailable under age 13.',
              HttpStatus.FORBIDDEN
            );
          if (age < 18)
            throw new HttpException(
              'A parent or guardian must record permission before OAuth registration.',
              HttpStatus.FORBIDDEN
            );
          ageEligibilityStatus = 'adult';
        }
      }
    }
    const authorizationUrl = await this.beginOAuthFlow(
      request,
      response,
      returnTo,
      body.appScope,
      undefined,
      undefined,
      false,
      body.sessionMode === 'cookie',
      ageEligibilityStatus,
      body.guardianResumeToken,
      guardianApplicantEmail,
      registrationAllowed
    );
    return { authorizationUrl };
  }

  /**
   * Starts a provider-owned authorization flow to link an identity to the
   * guard-authenticated account. The provider identity is never accepted from
   * a client request; it is derived only after the callback code exchange.
   */
  @UseGuards(AuthGuard)
  @Get('link/:provider')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate a verified OAuth provider link' })
  async startOAuthLink(
    @Req() request: Request & { user?: { userId?: string } },
    @Res() response: Response,
    // Declared for OpenAPI (orval validates path params); runtime reads
    // request.params directly — do not remove.
    @Param('provider') _provider: string,
    @Query('returnTo') returnTo: string | undefined,
    @Query('appScope') requestedAppScope: string | undefined,
    @Query('domain') queryDomain: string | undefined
  ) {
    const userId = request.user?.userId;
    if (!userId) {
      throw new HttpException(
        'Authenticated user is required',
        HttpStatus.UNAUTHORIZED
      );
    }
    return this.beginOAuthFlow(
      request,
      response,
      returnTo,
      requestedAppScope,
      queryDomain,
      userId
    );
  }

  /**
   * Browser clients cannot attach an Authorization header to a popup GET.
   * This guarded endpoint creates the link transaction and returns the
   * provider URL that the already-authenticated application can open.
   */
  @UseGuards(AuthGuard)
  @Post('link/:provider')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an OAuth provider-link transaction' })
  async createOAuthLink(
    @Req() request: Request & { user?: { userId?: string } },
    @Res({ passthrough: true }) response: Response,
    // Declared for OpenAPI (orval validates path params); runtime reads
    // request.params directly — do not remove.
    @Param('provider') _provider: string,
    @Query('returnTo') returnTo: string | undefined,
    @Query('appScope') requestedAppScope: string | undefined,
    @Query('domain') queryDomain: string | undefined
  ): Promise<{ authorizationUrl: string }> {
    const userId = request.user?.userId;
    if (!userId) {
      throw new HttpException(
        'Authenticated user is required',
        HttpStatus.UNAUTHORIZED
      );
    }
    const authorizationUrl = await this.beginOAuthFlow(
      request,
      response,
      returnTo,
      requestedAppScope,
      queryDomain,
      userId,
      false
    );
    return { authorizationUrl };
  }

  private async beginOAuthFlow(
    request: Request,
    response: Response,
    returnTo: string | undefined,
    requestedAppScope: string | undefined,
    queryDomain: string | undefined,
    linkUserId?: string,
    redirect = true,
    cookieSession = false,
    ageEligibilityStatus?: 'adult',
    guardianResumeToken?: string,
    guardianApplicantEmail?: string,
    registrationAllowed = true
  ): Promise<string> {
    const provider = String(
      (request.params as { provider?: string }).provider || ''
    )
      .trim()
      .toLowerCase();
    if (!this.providers.includes(provider)) {
      throw new HttpException(
        `Unsupported OAuth provider: ${provider}`,
        HttpStatus.BAD_REQUEST
      );
    }

    if (!returnTo?.trim()) {
      throw new HttpException('returnTo is required', HttpStatus.BAD_REQUEST);
    }

    const validatedReturnTo = this.validateReturnTo(returnTo);
    const resolvedAppScope = this.resolveAppScopeForReturnTo(validatedReturnTo);
    if (
      requestedAppScope?.trim() &&
      this.canonicalAppIdForScope(requestedAppScope.trim()) !== resolvedAppScope
    ) {
      throw new HttpException(
        'appScope must match the registered returnTo application',
        HttpStatus.BAD_REQUEST
      );
    }
    const appScope = resolvedAppScope;
    if (!appScope) {
      throw new HttpException(
        'Unable to resolve app scope for OAuth request',
        HttpStatus.BAD_REQUEST
      );
    }

    const domain = new URL(validatedReturnTo).hostname;
    if (queryDomain?.trim() && queryDomain.trim() !== domain) {
      throw new HttpException(
        'domain must match the returnTo host',
        HttpStatus.BAD_REQUEST
      );
    }
    const config = this.getProviderConfig(provider, domain);
    if (!config.enabled || !config.clientId || !config.authorizationEndpoint) {
      throw new HttpException(
        `${provider} OAuth is not configured`,
        HttpStatus.BAD_REQUEST
      );
    }

    const providerRedirectUri = this.resolveProviderRedirectUri(
      provider,
      config,
      appScope
    );
    const { state, stateId, nonce, codeChallenge } = await this.signState({
      provider,
      returnTo: validatedReturnTo,
      appScope,
      providerRedirectUri,
      issuedAt: Date.now(),
      linkUserId,
      cookieSession,
      ageEligibilityStatus,
      registrationAllowed,
      guardianResumeToken,
      guardianApplicantEmail,
    } as Omit<OAuthStatePayload, 'codeVerifier'>);

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: providerRedirectUri,
      response_type: 'code',
      scope: (config.scopes || []).join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    if (provider === 'google') {
      params.set('access_type', 'offline');
      params.set('prompt', 'consent');
    }

    const existingNonces = this.parseNonceCookie(
      request.cookies?.oauth_state_nonce
    );
    const nonceCookie = [
      ...existingNonces.filter((entry) => entry.id !== stateId),
      { id: stateId, nonce },
    ].slice(-4);
    response.cookie('oauth_state_nonce', JSON.stringify(nonceCookie), {
      httpOnly: true,
      sameSite: 'lax',
      secure: !['development', 'test'].includes(process.env.NODE_ENV || ''),
      path: '/api/oauth',
      maxAge: this.oauthStateTtlMs,
    });
    const authorizationUrl = `${
      config.authorizationEndpoint
    }?${params.toString()}`;
    if (redirect) response.redirect(authorizationUrl);
    return authorizationUrl;
  }

  @Get('callback/:provider')
  @Public()
  @ApiOperation({
    summary: 'Complete shared OAuth login',
    description:
      'Exchanges the provider code using instance-owned secrets, bootstraps the account, issues an app-scoped token, and redirects back to the originating app callback.',
  })
  async oauthRedirectCallback(
    @Req() request: Request,
    @Res() response: Response,
    // Declared for OpenAPI (orval validates path params); runtime reads
    // request.params directly — do not remove.
    @Param('provider') _provider: string
  ) {
    const provider = String(
      (request.params as { provider?: string }).provider || ''
    )
      .trim()
      .toLowerCase();
    if (!this.providers.includes(provider)) {
      throw new HttpException(
        `Unsupported OAuth provider: ${provider}`,
        HttpStatus.BAD_REQUEST
      );
    }

    const { code, state, error } = request.query as Record<
      string,
      string | undefined
    >;
    if (!state || state.length > 512 || (code && code.length > 4096)) {
      this.logger.warn('Rejected OAuth callback: missing state');
      this.emitCallbackFailure('state', 'state_invalid', provider);
      this.respondInvalidOAuthCallback(response);
      return;
    }

    const stateId = state.split('.')[0];
    const nonce = this.parseNonceCookie(
      request.cookies?.oauth_state_nonce
    ).find((entry) => entry.id === stateId)?.nonce;
    let statePayload: OAuthStatePayload;
    try {
      statePayload = await this.verifyAndConsumeState(state, provider, nonce);
    } catch {
      this.emitCallbackFailure('state', 'state_invalid', provider);
      this.respondInvalidOAuthCallback(response);
      return;
    }
    const finalCallbackUrl = this.buildFinalCallbackUrl(statePayload.appScope);
    const callbackDomain = new URL(statePayload.returnTo).hostname;
    const expectedProviderRedirectUri = this.resolveProviderRedirectUri(
      provider,
      this.getProviderConfig(provider, callbackDomain),
      statePayload.appScope
    );
    if (
      statePayload.providerRedirectUri &&
      statePayload.providerRedirectUri !== expectedProviderRedirectUri
    ) {
      this.emitCallbackFailure(
        'state',
        'state_invalid',
        provider,
        statePayload.appScope
      );
      this.respondInvalidOAuthCallback(response);
      return;
    }
    const providerRedirectUri =
      statePayload.providerRedirectUri || expectedProviderRedirectUri;

    const redirectError = (errorCode: OAuthErrorCode) =>
      response.redirect(
        this.withQuery(finalCallbackUrl, {
          error: errorCode,
          error_description: OAUTH_ERROR_DESCRIPTIONS[errorCode],
          returnTo: statePayload.returnTo,
        })
      );

    if (error || !code) {
      // Only an explicit user refusal is "denied"; anything else the provider
      // reports, or a missing code, means the exchange could not happen.
      const errorCode: OAuthErrorCode =
        error === 'access_denied'
          ? 'provider_denied'
          : 'provider_exchange_failed';
      this.emitCallbackFailure(
        'exchange',
        errorCode,
        provider,
        statePayload.appScope
      );
      redirectError(errorCode);
      return;
    }

    const tracker: { step: OAuthStep } = { step: 'exchange' };
    try {
      let identity: OAuthIdentity;
      try {
        identity = this.validateProviderIdentity(
          await this.exchangeProviderCode(
            provider,
            code,
            callbackDomain,
            statePayload.codeVerifier,
            providerRedirectUri
          )
        );
      } catch (exchangeError) {
        throw new OAuthFlowError('provider_exchange_failed', 'exchange', {
          cause: exchangeError,
        });
      }
      tracker.step = 'login';
      if (statePayload.linkUserId) {
        await firstValueFrom(
          this.authClient.send(
            { cmd: AuthCommands.LinkProvider },
            {
              userId: statePayload.linkUserId,
              provider,
              providerUserId: identity.providerUserId,
              providerEmail: identity.email,
              providerDisplayName: identity.displayName,
            }
          )
        );
        response.redirect(
          this.withQuery(finalCallbackUrl, {
            linked: provider,
            returnTo: statePayload.returnTo,
          })
        );
        return;
      }
      const loginResult = await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.OAuthLogin },
          {
            provider,
            providerUserId: identity.providerUserId,
            email: identity.email,
            emailVerified: identity.emailVerified,
            displayName: identity.displayName,
            appId: statePayload.appScope,
            ageEligibilityStatus: statePayload.ageEligibilityStatus,
            guardianResumeToken: statePayload.guardianResumeToken,
          }
        )
      );

      const pendingContext = {
        provider,
        identity,
        appScope: statePayload.appScope,
        returnTo: statePayload.returnTo,
        stateId,
        nonce: nonce!,
        cookieSession: statePayload.cookieSession === true,
      };

      // D-O1: a matching local account is never linked automatically.
      if (loginResult?.data?.needsLink) {
        const matchedUserId = loginResult.data.userId;
        if (typeof matchedUserId !== 'string' || !matchedUserId) {
          throw new Error('OAuth login did not resolve a link target');
        }
        const pendingCode = await this.createPendingIntent({
          ...pendingContext,
          kind: 'link_account',
          userId: matchedUserId,
          hasPassword: loginResult.data.hasPassword === true,
        });
        response.redirect(
          this.withQuery(finalCallbackUrl, {
            pending: 'link_account',
            pendingCode,
            provider,
            email: this.maskEmail(identity.email),
            returnTo: statePayload.returnTo,
          })
        );
        return;
      }

      let userId = loginResult?.data?.userId as string | undefined;
      if (loginResult?.data?.verificationRequired) {
        await this.sendOAuthVerificationEmail(
          statePayload.appScope,
          identity.email,
          statePayload.returnTo
        );
        redirectError('email_verification_required');
        return;
      }
      let callbackCode: string | undefined;
      if (!userId && loginResult?.data?.needsRegistration) {
        tracker.step = 'register';
        this.requireUsableOAuthEmail(identity.email);
        const ageGateApp = isAgeGatedApp(statePayload.appScope);
        if (
          ageGateApp &&
          (statePayload.registrationAllowed === false ||
            (!statePayload.ageEligibilityStatus &&
              !statePayload.guardianResumeToken))
        ) {
          // D-O2: resume with an age check instead of failing.
          const pendingCode = await this.createPendingIntent({
            ...pendingContext,
            kind: 'age_verification',
          });
          response.redirect(
            this.withQuery(finalCallbackUrl, {
              pending: 'age_verification',
              pendingCode,
              provider,
              email: this.maskEmail(identity.email),
              returnTo: statePayload.returnTo,
            })
          );
          return;
        }
        if (
          statePayload.guardianResumeToken &&
          statePayload.guardianApplicantEmail?.trim().toLowerCase() !==
            identity.email.trim().toLowerCase()
        ) {
          throw new OAuthFlowError('guardian_mismatch', 'register');
        }
        const completed = await this.completeRegistration(
          pendingContext,
          statePayload.ageEligibilityStatus,
          statePayload.guardianResumeToken,
          tracker
        );
        if ('verificationRequired' in completed) {
          redirectError('email_verification_required');
          return;
        }
        callbackCode = completed.callbackCode;
      }

      if (!callbackCode) {
        if (!userId) {
          throw new Error('OAuth login did not resolve a user id');
        }
        callbackCode = await this.finishSignIn(
          { ...pendingContext, userId },
          tracker
        );
      }
      response.redirect(
        this.withQuery(finalCallbackUrl, {
          callbackCode,
          returnTo: statePayload.returnTo,
        })
      );
    } catch (failure: unknown) {
      // Provider and RPC errors can carry response details or credentials, so
      // they are never logged or matched on; only the typed code and step are.
      const flow = this.toFlowError(failure, tracker.step);
      this.emitCallbackFailure(
        flow.step,
        flow.code,
        provider,
        statePayload.appScope
      );
      if (flow.code === 'oauth_callback_failed') {
        emitSafeDiagnostic(
          this.logger,
          'oauth.callback.unexpected',
          { step: flow.step, provider, appScope: statePayload.appScope },
          'error'
        );
      }
      redirectError(flow.code);
    }
  }

  @Post('callback')
  @Public()
  @ApiOperation({
    summary: 'Retired legacy OAuth callback endpoint',
    description:
      'OAuth callbacks must use the server-owned GET /oauth/callback/:provider flow.',
  })
  @ApiResponse({
    status: 410,
    description: 'Legacy callback retired; use the server-owned OAuth flow.',
  })
  async oauthCallback() {
    throw new HttpException(
      'This OAuth callback endpoint has been retired. Start OAuth with GET /oauth/start/:provider.',
      HttpStatus.GONE
    );
  }

  @Post('callback/redeem')
  @Public()
  @Throttle({ short: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Redeem a one-time OAuth callback code' })
  async redeemCallbackCode(
    @Body() data: { callbackCode?: unknown },
    @Req() request: Request,
    @Res({ passthrough: true }) response?: Response
  ): Promise<
    | { token: string; returnOrigin: string }
    | { session: true; returnOrigin: string }
  > {
    const callbackCode =
      typeof data?.callbackCode === 'string' ? data.callbackCode : '';
    const [stateId, secret] = callbackCode.split('.');
    const origin = request.headers.origin;
    const nonce = this.parseNonceCookie(
      request.cookies?.oauth_state_nonce
    ).find((entry) => entry.id === stateId)?.nonce;
    if (
      callbackCode.length > 512 ||
      !/^[A-Za-z0-9_-]{32,128}$/.test(stateId) ||
      !/^[A-Za-z0-9_-]{32,128}$/.test(secret) ||
      !nonce ||
      typeof origin !== 'string'
    ) {
      throw new HttpException(
        'Invalid OAuth callback code',
        HttpStatus.UNAUTHORIZED
      );
    }
    const grant = await this.oauthStateStore.consumeCallbackGrant(
      callbackCode,
      origin,
      stateId,
      this.hashNonce(nonce)
    );
    if (!grant) {
      throw new HttpException(
        'Invalid OAuth callback code',
        HttpStatus.UNAUTHORIZED
      );
    }
    let resolveResult: unknown;
    try {
      resolveResult = await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.ResolveOAuthCallbackSession },
          {
            sessionId: grant.sessionId,
            userId: grant.userId,
            profileId: grant.profileId,
            appId: grant.appId,
          }
        )
      );
    } catch {
      throw new HttpException(
        'OAuth session is unavailable',
        HttpStatus.UNAUTHORIZED
      );
    }
    const token =
      (resolveResult as any)?.data?.token || (resolveResult as any)?.token;
    if (typeof token !== 'string' || !token.trim()) {
      throw new HttpException(
        'Invalid OAuth callback code',
        HttpStatus.UNAUTHORIZED
      );
    }
    if (
      (grant.cookieSession ||
        request.headers['x-ot-session-mode'] === 'cookie') &&
      response
    ) {
      response.cookie('ot_session', token, sessionCookieOptions(grant.appId));
      return { session: true, returnOrigin: grant.returnOrigin };
    }
    return { token, returnOrigin: grant.returnOrigin };
  }

  @Get('pending/:code')
  @Public()
  @Throttle({ short: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Describe a pending OAuth intent without consuming it',
  })
  async getPendingOAuth(
    @Req() request: Request,
    @Param('code') code: string
  ): Promise<{
    kind: PendingOAuthKind;
    provider: string;
    maskedEmail: string;
    appScope: string;
    methods: Array<'password' | 'email_code'>;
  }> {
    const { intent } = await this.requirePending(request, code);
    return {
      kind: intent.kind,
      provider: intent.provider,
      maskedEmail: this.maskEmail(intent.email),
      appScope: intent.appScope,
      methods: intent.kind === 'link_account' ? this.linkMethods(intent) : [],
    };
  }

  @Post('pending/:code/link/email-code')
  @Public()
  @Throttle({ short: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Email a 6-digit code to confirm an account link' })
  async sendPendingLinkCode(
    @Req() request: Request,
    @Param('code') code: string
  ): Promise<{ sent: true }> {
    const { intent, binding } = await this.requirePending(
      request,
      code,
      'link_account'
    );
    if (!this.linkMethods(intent).includes('email_code')) {
      throw this.oauthHttpError('link_method_unavailable');
    }
    const existing = await this.oauthStateStore.getPendingLinkCode(
      code,
      binding
    );
    if (
      existing &&
      existing.expiresAt - this.oauthStateTtlMs + this.linkCodeCooldownMs >
        Date.now()
    ) {
      throw this.oauthHttpError('link_code_cooldown');
    }
    const tracker: { step: OAuthStep } = { step: 'link' };
    try {
      const issued = (await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.SendOAuthLinkCode },
          { userId: intent.userId, appName: this.appDisplayName(intent) }
        )
      )) as { data?: { sent?: boolean; codeHash?: string } };
      const codeHash = issued?.data?.codeHash;
      if (!issued?.data?.sent || typeof codeHash !== 'string') {
        throw new OAuthFlowError('email_code_send_failed', 'link');
      }
      const stored = await this.oauthStateStore.setPendingLinkCode(
        code,
        binding,
        { codeHash, expiresAt: Date.now() + this.oauthStateTtlMs }
      );
      if (!stored) throw this.oauthHttpError('state_invalid');
      return { sent: true };
    } catch (failure) {
      return this.failPending(
        failure,
        tracker,
        intent,
        'email_code_send_failed'
      );
    }
  }

  @Post('pending/:code/link')
  @Public()
  @Throttle({ short: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Prove ownership of the matched account and link the provider',
  })
  async linkPendingOAuth(
    @Req() request: Request,
    @Param('code') code: string,
    @Body() body: { password?: unknown; emailCode?: unknown; mfa?: unknown }
  ): Promise<
    { callbackCode: string; returnTo: string } | { verificationRequired: true }
  > {
    const { intent, binding, nonce } = await this.requirePending(
      request,
      code,
      'link_account'
    );
    const password =
      typeof body?.password === 'string' && body.password.length <= 1024
        ? body.password
        : undefined;
    const emailCode =
      typeof body?.emailCode === 'string' ? body.emailCode.trim() : undefined;
    if (!!password === !!emailCode) {
      throw this.oauthHttpError('link_credentials_invalid');
    }
    const method = password ? 'password' : 'email_code';
    if (!this.linkMethods(intent).includes(method)) {
      throw this.oauthHttpError('link_method_unavailable');
    }

    const tracker: { step: OAuthStep } = { step: 'link' };
    try {
      let valid: boolean;
      try {
        valid = await this.verifyLinkCredential(
          code,
          binding,
          intent,
          password,
          emailCode,
          typeof body?.mfa === 'string' ? body.mfa : undefined
        );
      } catch (credentialError) {
        if (isDeletionFenceError(credentialError)) {
          await this.oauthStateStore.consumePendingIntent(code, binding);
          throw new OAuthFlowError('account_deleted', 'link');
        }
        valid = false;
      }
      if (!valid) {
        const attempts = await this.oauthStateStore.recordPendingAttempt(
          code,
          binding,
          this.pendingMaxAttempts
        );
        if (attempts === undefined) throw this.oauthHttpError('state_invalid');
        if (attempts >= this.pendingMaxAttempts) {
          throw this.oauthHttpError('link_attempts_exhausted');
        }
        throw this.oauthHttpError('link_credentials_invalid', {
          attemptsRemaining: this.pendingMaxAttempts - attempts,
        });
      }

      const consumed = await this.oauthStateStore.consumePendingIntent(
        code,
        binding
      );
      if (!consumed?.userId) throw this.oauthHttpError('state_invalid');
      await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.LinkProvider },
          {
            userId: consumed.userId,
            provider: consumed.provider,
            providerUserId: consumed.providerUserId,
            providerEmail: consumed.email,
            providerDisplayName: consumed.displayName,
            providerEmailVerified: consumed.emailVerified,
          }
        )
      );
      // The provider is now linked, so this resolves the user through the
      // normal linked-account path (age eligibility, verification state).
      tracker.step = 'login';
      const context = this.contextFromIntent(consumed, nonce);
      const loginResult = await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.OAuthLogin },
          {
            provider: consumed.provider,
            providerUserId: consumed.providerUserId,
            email: consumed.email,
            emailVerified: consumed.emailVerified,
            displayName: consumed.displayName,
            appId: consumed.appScope,
          }
        )
      );
      if (loginResult?.data?.verificationRequired) {
        await this.sendOAuthVerificationEmail(
          consumed.appScope,
          consumed.email,
          consumed.returnTo
        );
        return { verificationRequired: true };
      }
      const userId = loginResult?.data?.userId as string | undefined;
      if (!userId) throw new Error('OAuth login did not resolve a user id');
      const callbackCode = await this.finishSignIn(
        { ...context, userId },
        tracker
      );
      emitSafeDiagnostic(
        this.logger,
        'oauth.pending.completed',
        {
          kind: 'link_account',
          provider: consumed.provider,
          appScope: consumed.appScope,
        },
        'log'
      );
      return { callbackCode, returnTo: consumed.returnTo };
    } catch (failure) {
      return this.failPending(failure, tracker, intent);
    }
  }

  @Post('pending/:code/cancel')
  @Public()
  @Throttle({ short: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Abandon a pending OAuth intent' })
  async cancelPendingOAuth(
    @Req() request: Request,
    @Param('code') code: string
  ): Promise<{ cancelled: true }> {
    const { binding } = this.pendingBinding(request, code);
    const removed = await this.oauthStateStore.consumePendingIntent(
      code,
      binding
    );
    if (removed) {
      emitSafeDiagnostic(
        this.logger,
        'oauth.pending.cancelled',
        { kind: removed.kind },
        'log'
      );
    }
    return { cancelled: true };
  }

  @Post('pending/:code/age')
  @Public()
  @Throttle({ short: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Run the age check for a pending OAuth sign-up and finish it',
  })
  async completePendingAge(
    @Req() request: Request,
    @Param('code') code: string,
    @Body()
    body: {
      dateOfBirth?: unknown;
      guardianResumeToken?: unknown;
      guardianEmail?: unknown;
    }
  ): Promise<
    { callbackCode: string; returnTo: string } | { verificationRequired: true }
  > {
    const { intent, binding, nonce } = await this.requirePending(
      request,
      code,
      'age_verification'
    );
    const tracker: { step: OAuthStep } = { step: 'age' };
    try {
      let ageEligibilityStatus: 'adult' | undefined;
      let guardianResumeToken: string | undefined;
      if (
        typeof body?.guardianResumeToken === 'string' &&
        body.guardianResumeToken
      ) {
        let resumedEmail: string;
        try {
          const resumed = (await firstValueFrom(
            this.authClient.send(
              { cmd: AuthCommands.ValidateGuardianResume },
              { token: body.guardianResumeToken }
            )
          )) as { valid: true; email: string };
          resumedEmail = resumed.email;
        } catch {
          throw this.oauthHttpError('guardian_token_invalid');
        }
        if (
          resumedEmail.trim().toLowerCase() !==
          intent.email.trim().toLowerCase()
        ) {
          throw new OAuthFlowError('guardian_mismatch', 'age');
        }
        guardianResumeToken = body.guardianResumeToken;
      } else {
        // Same evaluation as password sign-up in the authentication controller.
        const age = this.ageAtRegistration(
          typeof body?.dateOfBirth === 'string' ? body.dateOfBirth : undefined
        );
        if (age === null) throw this.oauthHttpError('age_invalid');
        if (age < 13) throw this.oauthHttpError('age_ineligible');
        if (age < 18) {
          const guardianEmail =
            typeof body?.guardianEmail === 'string' ? body.guardianEmail : '';
          if (!guardianEmail || !validator.isEmail(guardianEmail)) {
            throw this.oauthHttpError('age_ineligible');
          }
          const returnPath = guardianReturnPathFor(intent.appScope);
          const app = this.resolveAuthEmailApp(intent.appScope);
          const requested = await firstValueFrom(
            this.authClient.send(
              { cmd: AuthCommands.RequestGuardianPermission },
              {
                dateOfBirth: body.dateOfBirth,
                applicantEmail: intent.email,
                guardianEmail,
                context: {
                  appId: app.appId,
                  appName: app.name,
                  uiBaseUrl: app.uiBaseUrl,
                  from: app.authEmail!.from,
                  replyTo: app.authEmail!.replyTo,
                  returnPath,
                },
              }
            )
          );
          throw this.oauthHttpError('guardian_consent_required', {
            message:
              (requested as { sent?: boolean })?.sent === false
                ? 'Guardian permission request is pending, but the email could not be sent.'
                : 'Guardian permission request sent.',
            data: { guardianConsentPending: true, request: requested },
          });
        }
        ageEligibilityStatus = 'adult';
      }

      const consumed = await this.oauthStateStore.consumePendingIntent(
        code,
        binding
      );
      if (!consumed) throw this.oauthHttpError('state_invalid');
      tracker.step = 'register';
      const completed = await this.completeRegistration(
        this.contextFromIntent(consumed, nonce),
        ageEligibilityStatus,
        guardianResumeToken,
        tracker
      );
      emitSafeDiagnostic(
        this.logger,
        'oauth.pending.completed',
        {
          kind: 'age_verification',
          provider: consumed.provider,
          appScope: consumed.appScope,
        },
        'log'
      );
      if ('verificationRequired' in completed) {
        return { verificationRequired: true };
      }
      return {
        callbackCode: completed.callbackCode,
        returnTo: consumed.returnTo,
      };
    } catch (failure) {
      return this.failPending(failure, tracker, intent);
    }
  }

  // Not @Public(): this mutates account state, so AuthGuard MUST reject an
  // anonymous or invalid-signature request before the handler runs. The
  // acting identity is read from the guard-verified `request.user` — never
  // from the `@User()` decorator, which decodes the token WITHOUT verifying
  // its signature and would let a forged userId link a provider onto an
  // arbitrary victim's account.
  @UseGuards(AuthGuard)
  @Post('link')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retired direct OAuth provider link endpoint' })
  @ApiResponse({ status: 410, description: 'Use GET /oauth/link/:provider.' })
  async linkProvider() {
    throw new HttpException(
      'Direct provider linking is retired. Start a verified link flow with GET /oauth/link/:provider.',
      HttpStatus.GONE
    );
  }

  // Not @Public(): this mutates account state, so AuthGuard MUST reject an
  // anonymous or invalid-signature request before the handler runs. See
  // linkProvider above for why identity comes from `request.user`, not
  // `@User()`.
  @UseGuards(AuthGuard)
  @Post('unlink')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Unlink an OAuth provider from the current user account',
    description:
      "Removes a linked OAuth provider from the authenticated user's account.",
  })
  @ApiResponse({ status: 201, description: 'Provider unlinked successfully.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async unlinkProvider(
    @Body() data: Omit<UnlinkProviderRequest, 'userId'>,
    @Req() req: { user: { userId: string } }
  ) {
    try {
      const userId = req.user.userId;
      this.logger.debug(
        `Unlinking provider=${data.provider} from userId=${userId}`
      );
      return await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.UnlinkProvider },
          { ...data, userId }
        )
      );
    } catch (error) {
      this.logger.error('Error in unlinkProvider:', error?.message || error);
      throw new HttpException(
        `Unlink provider failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Not @Public(): reveals which providers are linked to an account, so
  // AuthGuard MUST reject an anonymous or invalid-signature request before
  // the handler runs. See linkProvider above for why identity comes from
  // `request.user`, not `@User()`.
  @UseGuards(AuthGuard)
  @Get('providers')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get linked OAuth providers for the current user',
    description:
      "Returns a list of all OAuth providers linked to the authenticated user's account.",
  })
  @ApiResponse({
    status: 200,
    description: 'Linked providers retrieved successfully.',
  })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async getLinkedProviders(@Req() req: { user: { userId: string } }) {
    try {
      const userId = req.user.userId;
      this.logger.debug(`Getting linked providers for userId=${userId}`);
      return await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.GetLinkedProviders },
          { userId }
        )
      );
    } catch (error) {
      this.logger.error(
        'Error in getLinkedProviders:',
        error?.message || error
      );
      throw new HttpException(
        `Get linked providers failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('config')
  @Public()
  @ApiOperation({
    summary: 'Get OAuth provider configurations',
    description:
      'Returns the OAuth client configuration for all enabled providers. This is safe to expose publicly as it only contains client IDs and endpoints.',
  })
  @ApiResponse({
    status: 200,
    description: 'OAuth configuration retrieved successfully.',
  })
  async getOAuthConfig(
    @Req() request: Request,
    @Query('domain') queryDomain?: string
  ) {
    try {
      const origin = (request.headers as Record<string, string | undefined>)[
        'origin'
      ];
      const host = (request.headers as Record<string, string | undefined>)[
        'host'
      ];
      const domain =
        queryDomain ||
        (origin ? new URL(origin).hostname : host?.split(':')[0]);

      this.logger.debug(`Getting OAuth configuration for domain=${domain}`);
      const appScope = this.resolveAppScopeForConfigRequest(request);
      const result: Record<string, unknown> = {};

      for (const provider of this.providers) {
        const config = this.getProviderConfig(provider, domain);
        if (!config.enabled || !config.clientId) {
          continue;
        }

        result[provider] = {
          clientId: config.clientId,
          redirectUri: this.resolveProviderRedirectUri(
            provider,
            config,
            appScope
          ),
          callbackOrigin: new URL(this.resolveCallbackBase(appScope)).origin,
          scopes: config.scopes || [],
          authorizationEndpoint: config.authorizationEndpoint,
          enabled: true,
        };
      }

      return result;
    } catch (error) {
      this.logger.error('Error in getOAuthConfig:', error?.message || error);
      throw new HttpException(
        `Failed to retrieve OAuth configuration: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private validateReturnTo(returnTo: string): string {
    let parsed: URL;
    try {
      parsed = new URL(returnTo);
    } catch {
      throw new HttpException('Invalid returnTo URL', HttpStatus.BAD_REQUEST);
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new HttpException(
        'returnTo must use http or https',
        HttpStatus.BAD_REQUEST
      );
    }

    const knownOrigin = this.resolveAppScopeForReturnTo(parsed.toString());
    const isLocalhost =
      ['localhost', '127.0.0.1'].includes(parsed.hostname) ||
      parsed.hostname.endsWith('.localhost');

    if (!knownOrigin && !isLocalhost) {
      throw new HttpException(
        'returnTo must target a registered app origin',
        HttpStatus.BAD_REQUEST
      );
    }

    return parsed.toString();
  }

  private emitCallbackFailure(
    step: OAuthStep,
    code: OAuthErrorCode,
    provider: string,
    appScope?: string
  ): void {
    emitSafeDiagnostic(
      this.logger,
      'oauth.callback.failed',
      { step, code, provider, appScope },
      'warn'
    );
  }

  private toFlowError(failure: unknown, step: OAuthStep): OAuthFlowError {
    if (failure instanceof OAuthFlowError) return failure;
    if (isDeletionFenceError(failure)) {
      return new OAuthFlowError('account_deleted', step, { cause: failure });
    }
    return new OAuthFlowError(DEFAULT_CODE_FOR_STEP[step], step, {
      cause: failure,
    });
  }

  private oauthHttpError(
    code: OAuthErrorCode,
    extra: Record<string, unknown> = {}
  ): HttpException {
    return new HttpException(
      {
        error: code,
        error_description: OAUTH_ERROR_DESCRIPTIONS[code],
        ...extra,
      },
      OAUTH_ERROR_STATUS[code]
    );
  }

  /** Rethrows deliberate HTTP errors; maps anything else to a named code. */
  private failPending(
    failure: unknown,
    tracker: { step: OAuthStep },
    intent: StoredPendingOAuthIntent,
    fallback?: OAuthErrorCode
  ): never {
    if (failure instanceof HttpException) throw failure;
    const flow = this.toFlowError(failure, tracker.step);
    const code =
      fallback && flow.code === DEFAULT_CODE_FOR_STEP[flow.step]
        ? fallback
        : flow.code;
    emitSafeDiagnostic(
      this.logger,
      'oauth.pending.failed',
      {
        kind: intent.kind,
        step: flow.step,
        code,
        provider: intent.provider,
        appScope: intent.appScope,
      },
      'warn'
    );
    if (code === 'oauth_callback_failed') {
      emitSafeDiagnostic(
        this.logger,
        'oauth.callback.unexpected',
        {
          step: flow.step,
          provider: intent.provider,
          appScope: intent.appScope,
        },
        'error'
      );
    }
    throw this.oauthHttpError(code);
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***';
    return `${local[0]}***@${domain}`;
  }

  private linkMethods(
    intent: StoredPendingOAuthIntent
  ): Array<'password' | 'email_code'> {
    // OAuth-registered users hold a random password hash, so a password is
    // offered only as a convenience; the emailed code always works.
    return intent.hasPassword ? ['password', 'email_code'] : ['email_code'];
  }

  private appDisplayName(intent: StoredPendingOAuthIntent): string | undefined {
    return this.registry.apps.find((entry) => entry.appId === intent.appScope)
      ?.name;
  }

  private contextFromIntent(
    intent: StoredPendingOAuthIntent,
    nonce: string
  ): OAuthSignInContext {
    return {
      provider: intent.provider,
      identity: {
        providerUserId: intent.providerUserId,
        email: intent.email,
        emailVerified: intent.emailVerified,
        displayName: intent.displayName,
        firstName: intent.firstName,
        lastName: intent.lastName,
      },
      appScope: intent.appScope,
      returnTo: intent.returnTo,
      stateId: intent.stateId,
      nonce,
      cookieSession: intent.cookieSession === true,
    };
  }

  private async createPendingIntent(
    context: OAuthSignInContext & {
      kind: PendingOAuthKind;
      userId?: string;
      hasPassword?: boolean;
    }
  ): Promise<string> {
    if (
      context.kind === 'age_verification' &&
      !isAgeGatedApp(context.appScope)
    ) {
      // Only age-gated apps have a guardian flow; anything else is a bug.
      throw new OAuthFlowError('registration_closed', 'register');
    }
    const code = `${context.stateId}.${randomBytes(32).toString('base64url')}`;
    await this.oauthStateStore.createPendingIntent(code, {
      kind: context.kind,
      provider: context.provider,
      providerUserId: context.identity.providerUserId,
      email: context.identity.email,
      emailVerified: context.identity.emailVerified,
      displayName: context.identity.displayName,
      firstName: context.identity.firstName,
      lastName: context.identity.lastName,
      appScope: context.appScope,
      returnTo: context.returnTo,
      cookieSession: context.cookieSession,
      ...(context.userId
        ? { userId: context.userId, hasPassword: context.hasPassword === true }
        : {}),
      stateId: context.stateId,
      nonceHash: this.hashNonce(context.nonce),
      expiresAt: Date.now() + this.oauthStateTtlMs,
    });
    emitSafeDiagnostic(
      this.logger,
      'oauth.pending.created',
      {
        kind: context.kind,
        provider: context.provider,
        appScope: context.appScope,
      },
      'log'
    );
    return code;
  }

  /** Same binding as callback grants: id prefix selects the nonce cookie entry. */
  private pendingBinding(
    request: Request,
    code: string
  ): { binding: PendingOAuthBinding; nonce: string } {
    const [stateId, secret] = typeof code === 'string' ? code.split('.') : [];
    const nonce = stateId
      ? this.parseNonceCookie(request.cookies?.oauth_state_nonce).find(
          (entry) => entry.id === stateId
        )?.nonce
      : undefined;
    if (
      code.length > 512 ||
      !/^[A-Za-z0-9_-]{32,128}$/.test(stateId || '') ||
      !/^[A-Za-z0-9_-]{32,128}$/.test(secret || '') ||
      !nonce
    ) {
      throw this.oauthHttpError('state_invalid');
    }
    return { binding: { stateId, nonceHash: this.hashNonce(nonce) }, nonce };
  }

  private async requirePending(
    request: Request,
    code: string,
    kind?: PendingOAuthKind
  ): Promise<{
    intent: StoredPendingOAuthIntent;
    binding: PendingOAuthBinding;
    nonce: string;
  }> {
    const { binding, nonce } = this.pendingBinding(request, code);
    const intent = await this.oauthStateStore.getPendingIntent(code, binding);
    if (!intent || (kind && intent.kind !== kind)) {
      throw this.oauthHttpError('state_invalid');
    }
    if (intent.kind === 'age_verification' && !isAgeGatedApp(intent.appScope)) {
      throw this.oauthHttpError('state_invalid');
    }
    return { intent, binding, nonce };
  }

  private async verifyLinkCredential(
    code: string,
    binding: PendingOAuthBinding,
    intent: StoredPendingOAuthIntent,
    password: string | undefined,
    emailCode: string | undefined,
    mfa: string | undefined
  ): Promise<boolean> {
    if (password) {
      const result = (await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.VerifyUserPassword },
          { userId: intent.userId, password, ...(mfa ? { mfa } : {}) }
        )
      )) as { data?: { valid?: boolean } };
      return result?.data?.valid === true;
    }
    const stored = await this.oauthStateStore.getPendingLinkCode(code, binding);
    if (!stored || stored.expiresAt <= Date.now() || !emailCode) return false;
    const result = (await firstValueFrom(
      this.authClient.send(
        { cmd: AuthCommands.VerifyOAuthLinkCode },
        { userId: intent.userId, code: emailCode, codeHash: stored.codeHash }
      )
    )) as { data?: { valid?: boolean } };
    return result?.data?.valid === true;
  }

  /** Profile, access check, session and grant: shared by every sign-in path. */
  private async finishSignIn(
    context: OAuthSignInContext & { userId: string },
    tracker: { step: OAuthStep }
  ): Promise<string> {
    const { userId, identity } = context;
    tracker.step = 'profile';
    const profile = await this.getOrCreateAppScopedProfile(
      userId,
      context.appScope,
      identity.displayName || identity.email,
      identity.email
    );
    tracker.step = 'access';
    await this.assertOwnerConsoleAccess(context.appScope, profile.id);
    tracker.step = 'session';
    const callbackSession = await firstValueFrom(
      this.authClient.send(
        { cmd: AuthCommands.CreateOAuthCallbackSession },
        { userId, profileId: profile.id, appId: context.appScope }
      )
    );
    const session = callbackSession?.data || callbackSession;
    const isUUID = (value: unknown): value is string =>
      typeof value === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      );
    if (
      !isUUID(session?.sessionId) ||
      session.userId !== userId ||
      session.profileId !== profile.id ||
      session.appId !== context.appScope
    ) {
      throw new Error(
        'Authentication service returned an invalid callback session'
      );
    }
    tracker.step = 'grant';
    return this.createCallbackGrant(
      session,
      context.returnTo,
      context.appScope,
      context.stateId,
      context.nonce,
      context.cookieSession
    );
  }

  private async completeRegistration(
    context: OAuthSignInContext,
    ageEligibilityStatus: 'adult' | undefined,
    guardianResumeToken: string | undefined,
    tracker: { step: OAuthStep }
  ): Promise<{ callbackCode: string } | { verificationRequired: true }> {
    tracker.step = 'register';
    const registered = await this.registerOAuthUser(
      context.appScope,
      context.provider,
      context.identity,
      ageEligibilityStatus,
      guardianResumeToken
    );
    if (!registered.emailVerified) {
      await this.sendOAuthVerificationEmail(
        context.appScope,
        context.identity.email,
        context.returnTo
      );
      return { verificationRequired: true };
    }
    return {
      callbackCode: await this.finishSignIn(
        { ...context, userId: registered.userId },
        tracker
      ),
    };
  }

  private resolveAuthEmailApp(appId: string): AppRegistration {
    const canonicalAppId =
      (
        {
          'leads-app': 'opportunity-compass',
          finance: 'fin-commander',
          'video-client': 'video-platform',
        } as Record<string, string>
      )[appId] || appId;
    const app = this.registry.apps.find(
      (entry) => entry.appId === canonicalAppId
    );
    if (!app?.authEmail?.enabled || !app.authEmail.from) {
      throw new Error(`Email verification is not configured for ${appId}`);
    }
    if (!isApprovedAuthEmailSender(app.authEmail.from)) {
      throw new Error(
        `Email sender for ${appId} must use an approved root domain`
      );
    }
    return app;
  }

  private async sendOAuthVerificationEmail(
    appId: string,
    email: string,
    returnTo: string
  ): Promise<void> {
    const app = this.resolveAuthEmailApp(appId);
    const parsedReturn = new URL(returnTo);
    await firstValueFrom(
      this.authClient.send(
        { cmd: AuthCommands.RequestEmailAuthAction },
        {
          purpose: 'verification',
          email,
          context: {
            appId: app.appId,
            appName: app.name || app.appId,
            uiBaseUrl: app.uiBaseUrl,
            from: app.authEmail.from,
            replyTo: app.authEmail.replyTo,
            returnPath: `${parsedReturn.pathname}${parsedReturn.search}`,
          },
        }
      )
    );
  }

  /**
   * The app scope of the page asking for OAuth config. Browsers omit `Origin`
   * on same-origin GETs, which is how an app's own login page fetches
   * /api/oauth/config through its SSR proxy. Without a fallback every such
   * request resolved to the client-interface callback base, so forgeofwill was
   * told to accept popup messages only from client-interface's origin and
   * dropped its own callback's postMessage. Referer and the proxied Host still
   * identify the page; either only counts if it maps to a configured or
   * registered app origin, so a forged header can only pick a known app.
   */
  private resolveAppScopeForConfigRequest(
    request: Request
  ): string | undefined {
    const headers = (request?.headers ?? {}) as Record<
      string,
      string | string[] | undefined
    >;
    const header = (name: string): string | undefined => {
      const value = headers[name];
      return (Array.isArray(value) ? value[0] : value)?.split(',')[0]?.trim();
    };

    const origin = header('origin');
    if (origin) return this.resolveAppScopeForReturnTo(origin) ?? undefined;

    const host = header('x-forwarded-host') || header('host');
    const proto =
      header('x-forwarded-proto') ||
      (request as { protocol?: string } | undefined)?.protocol ||
      'http';
    const candidates = [
      header('referer'),
      host ? `${proto}://${host}` : undefined,
    ];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const appScope = this.resolveAppScopeForReturnTo(candidate);
      if (appScope) return appScope;
    }
    return undefined;
  }

  private resolveAppScopeForReturnTo(returnTo: string): string | null {
    const origin = this.safeOrigin(returnTo);
    if (!origin) return null;

    const configuredScope = [...this.configuredAppScopeOrigins()].find(
      ([, configuredOrigin]) => configuredOrigin === origin
    )?.[0];
    if (configuredScope) return this.canonicalAppIdForScope(configuredScope);

    if (origin === this.safeOrigin(this.resolveClientInterfaceCallbackBase())) {
      return 'client-interface';
    }

    const app = this.registry.apps.find(
      (entry) => this.safeOrigin(entry.uiBaseUrl) === origin
    );
    return app?.appId ?? null;
  }

  private canonicalAppIdForScope(scope: string): string {
    return (
      (
        {
          finance: 'fin-commander',
          'leads-app': 'opportunity-compass',
          'video-client': 'video-platform',
          D6: 'd6',
        } as Record<string, string>
      )[scope] || scope
    );
  }

  private profileScopeForApp(appId: string): string {
    return (
      (
        {
          'fin-commander': 'finance',
          'opportunity-compass': 'leads-app',
          'video-platform': 'video-platform',
          d6: 'D6',
        } as Record<string, string>
      )[appId] || appId
    );
  }

  private configuredAppScopeOrigins(): Map<string, string> {
    const rawOrigins = process.env.APP_SCOPE_ORIGINS?.trim();
    if (!rawOrigins) return new Map();

    try {
      const configuredOrigins = JSON.parse(rawOrigins) as Record<
        string,
        unknown
      >;
      if (!configuredOrigins || Array.isArray(configuredOrigins)) {
        return new Map();
      }

      return new Map(
        Object.entries(configuredOrigins).flatMap(([scope, origin]) => {
          if (typeof origin !== 'string') return [];
          const normalizedOrigin = this.safeOrigin(origin);
          return normalizedOrigin === origin.replace(/\/$/, '')
            ? [[scope, normalizedOrigin]]
            : [];
        })
      );
    } catch {
      return new Map();
    }
  }

  private resolveClientInterfaceCallbackBase(): string {
    const configuredUrl = process.env.CLIENT_INTERFACE_UI_BASE_URL?.trim();
    if (configuredUrl) {
      return configuredUrl.replace(/\/$/, '');
    }

    if (process.env.CLIENT_INTERFACE_DOMAIN?.trim()) {
      const rawDomain = process.env.CLIENT_INTERFACE_DOMAIN.trim();
      if (rawDomain.startsWith('http://') || rawDomain.startsWith('https://')) {
        return rawDomain.replace(/\/$/, '');
      }
      return `https://${rawDomain}`;
    }

    const app =
      this.registry.apps.find((entry) => entry.appId === 'client-interface') ??
      this.findRegistryAppByDomain(process.env.CLIENT_INTERFACE_DOMAIN);

    if (app?.uiBaseUrl) {
      return app.uiBaseUrl.replace(/\/$/, '');
    }

    throw new HttpException(
      'client-interface callback host is not configured',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }

  private resolveCallbackBase(appScope?: string): string {
    const configuredOrigins = this.configuredAppScopeOrigins();
    const configuredOrigin = appScope
      ? configuredOrigins.get(appScope) ||
        [...configuredOrigins].find(
          ([scope]) => this.canonicalAppIdForScope(scope) === appScope
        )?.[1]
      : undefined;

    if (configuredOrigin) return configuredOrigin;

    const registeredApp = appScope
      ? this.registry.apps.find((app) => app.appId === appScope)
      : undefined;
    if (registeredApp?.uiBaseUrl && appScope !== 'client-interface') {
      return registeredApp.uiBaseUrl.replace(/\/$/, '');
    }

    return this.resolveClientInterfaceCallbackBase();
  }

  private resolveProviderRedirectUri(
    provider: string,
    config: GatewayOAuthProviderConfig,
    appScope?: string
  ): string {
    if (appScope) {
      return `${this.resolveCallbackBase(
        appScope
      )}/api/oauth/callback/${provider}`;
    }

    const configuredRedirectUri = config.redirectUri?.trim();
    if (configuredRedirectUri) {
      return configuredRedirectUri;
    }

    return `${this.resolveClientInterfaceCallbackBase()}/oauth/callback/${provider}`;
  }

  private findRegistryAppByDomain(
    domain?: string
  ): AppRegistration | undefined {
    if (!domain) {
      return undefined;
    }
    return this.registry.apps.find(
      (entry) =>
        entry.domain === domain || entry.uiBaseUrl.includes(`://${domain}`)
    );
  }

  private getProviderConfig(
    provider: string,
    domain?: string
  ): GatewayOAuthProviderConfig {
    const global =
      this.configService.get<GatewayOAuthProviderConfig>(`oauth.${provider}`) ||
      {};
    const appEntries =
      this.configService.get<Array<Record<string, unknown>>>('oauth.apps') ||
      [];
    const domainEntry = domain
      ? appEntries.find((entry) => entry?.domain === domain)
      : undefined;
    const domainOverride = (domainEntry?.[provider] ||
      {}) as GatewayOAuthProviderConfig;

    return {
      ...global,
      ...domainOverride,
      scopes: domainOverride.scopes || global.scopes || [],
      enabled: Boolean(
        (domainOverride.enabled ?? global.enabled) &&
          (domainOverride.clientId || global.clientId)
      ),
    };
  }

  private async signState(
    payload: Omit<OAuthStatePayload, 'codeVerifier'>
  ): Promise<{
    state: string;
    stateId: string;
    nonce: string;
    codeChallenge: string;
  }> {
    const stateId = randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    const nonceHash = this.hashNonce(nonce);
    const signature = this.signStateArtifact(stateId, nonce);
    await this.oauthStateStore.create(stateId, {
      payload: { ...payload, codeVerifier },
      nonceHash,
      expiresAt: Date.now() + this.oauthStateTtlMs,
    });
    return {
      state: `${stateId}.${signature}`,
      stateId,
      nonce,
      codeChallenge,
    };
  }

  private async createCallbackGrant(
    session: {
      sessionId: string;
      userId: string;
      profileId: string;
      appId: string;
    },
    returnTo: string,
    appScope: string,
    stateId: string,
    nonce: string,
    cookieSession: boolean
  ): Promise<string> {
    const callbackCode = `${stateId}.${randomBytes(32).toString('base64url')}`;
    await this.oauthStateStore.createCallbackGrant(callbackCode, {
      ...session,
      returnOrigin: new URL(returnTo).origin,
      redemptionOrigin: new URL(this.resolveCallbackBase(appScope)).origin,
      cookieSession,
      stateId,
      nonceHash: this.hashNonce(nonce),
      expiresAt: Date.now() + this.callbackGrantTtlMs,
    });
    return callbackCode;
  }

  private async verifyAndConsumeState(
    state: string,
    provider: string,
    nonce: string | undefined
  ): Promise<OAuthStatePayload> {
    const [stateId, signature] = state.split('.');
    if (
      state.length > 512 ||
      !/^[A-Za-z0-9_-]{32,128}$/.test(stateId) ||
      !/^[A-Za-z0-9_-]{32,128}$/.test(signature) ||
      !nonce
    ) {
      throw new HttpException('Invalid OAuth state', HttpStatus.BAD_REQUEST);
    }

    // The state signature is bound to the browser-only nonce. Validate it
    // before looking up or consuming the one-time state so an attacker with a
    // valid callback URL but no nonce cannot invalidate a real login attempt.
    const expectedSignature = this.signStateArtifact(stateId, nonce);
    if (signature.length !== expectedSignature.length) {
      throw new HttpException('Invalid OAuth state', HttpStatus.BAD_REQUEST);
    }
    const signatureMatches = timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
    if (!signatureMatches) {
      throw new HttpException('Invalid OAuth state', HttpStatus.BAD_REQUEST);
    }

    const storedState = await this.oauthStateStore.consume(stateId);
    if (!storedState || storedState.expiresAt <= Date.now()) {
      throw new HttpException(
        'OAuth state has expired',
        HttpStatus.BAD_REQUEST
      );
    }
    if (!this.valuesMatch(this.hashNonce(nonce), storedState.nonceHash)) {
      throw new HttpException('Invalid OAuth state', HttpStatus.BAD_REQUEST);
    }

    const payload = storedState.payload;
    if (payload.provider !== provider) {
      throw new HttpException('Invalid OAuth state', HttpStatus.BAD_REQUEST);
    }
    payload.returnTo = this.validateReturnTo(payload.returnTo);
    return payload;
  }

  private oauthStateSecret(): string {
    const secret = process.env.OAUTH_STATE_SECRET?.trim();
    if (!secret) {
      throw new HttpException(
        'OAuth state is not configured',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
    return secret;
  }

  private respondInvalidOAuthCallback(response: Response): void {
    response.status(HttpStatus.BAD_REQUEST).json({
      error: 'invalid_oauth_callback',
      error_description:
        'This sign-in attempt has expired or was already used. Close this window and start sign-in again.',
    });
  }

  private signStateArtifact(stateId: string, nonce: string): string {
    return createHmac('sha256', this.oauthStateSecret())
      .update(`${stateId}.${nonce}`)
      .digest('base64url');
  }

  private hashNonce(nonce: string): string {
    return createHash('sha256').update(nonce).digest('base64url');
  }

  private parseNonceCookie(
    value: unknown
  ): Array<{ id: string; nonce: string }> {
    if (typeof value !== 'string' || value.length > 4096) return [];
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(
          (entry): entry is { id: string; nonce: string } =>
            typeof entry?.id === 'string' &&
            entry.id.length <= 128 &&
            typeof entry?.nonce === 'string' &&
            entry.nonce.length <= 128
        )
        .slice(-4);
    } catch {
      return [];
    }
  }

  private valuesMatch(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private safeOrigin(url: string): string {
    try {
      return new URL(url).origin;
    } catch {
      return '';
    }
  }

  private buildFinalCallbackUrl(appScope?: string): string {
    return `${this.resolveCallbackBase(appScope)}/oauth/callback`;
  }

  private withQuery(
    baseUrl: string,
    params: Record<string, string | undefined>
  ): string {
    const url = new URL(baseUrl);
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  private async exchangeProviderCode(
    provider: string,
    code: string,
    domain?: string,
    codeVerifier?: string,
    providerRedirectUri?: string
  ): Promise<OAuthIdentity> {
    const config = this.getProviderConfig(provider, domain);
    if (
      !config.clientId ||
      !config.clientSecret ||
      !config.tokenEndpoint ||
      !config.userInfoEndpoint
    ) {
      throw new Error(`${provider} OAuth credentials are incomplete`);
    }

    const redirectUri =
      providerRedirectUri || this.resolveProviderRedirectUri(provider, config);
    const tokenParams = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
    });
    if (!codeVerifier || !/^[A-Za-z0-9_-]{43,128}$/.test(codeVerifier)) {
      throw new Error('OAuth PKCE verifier is invalid');
    }
    tokenParams.set('code_verifier', codeVerifier);

    if (provider !== 'github') {
      tokenParams.set('grant_type', 'authorization_code');
    }

    const tokenResponse = await this.fetchProvider(config.tokenEndpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });
    if (!tokenResponse.ok) {
      throw new Error('OAuth provider request failed');
    }

    const tokenPayload = (await tokenResponse.json()) as Record<
      string,
      string | undefined
    >;
    const accessToken = tokenPayload.access_token;
    if (!accessToken) {
      throw new Error('OAuth provider request failed');
    }

    return this.fetchProviderIdentity(provider, accessToken, config);
  }

  private async fetchProviderIdentity(
    provider: string,
    accessToken: string,
    config: GatewayOAuthProviderConfig
  ): Promise<OAuthIdentity> {
    const userInfoUrl =
      provider === 'facebook'
        ? `${config.userInfoEndpoint}?fields=id,name,email,first_name,last_name`
        : config.userInfoEndpoint!;
    const userInfoResponse = await this.fetchProvider(userInfoUrl, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(provider === 'github'
          ? { 'User-Agent': 'optimistic-tanuki-gateway' }
          : {}),
      },
    });

    if (!userInfoResponse.ok) {
      throw new Error('OAuth provider request failed');
    }

    const profile = (await userInfoResponse.json()) as Record<string, unknown>;
    switch (provider) {
      case 'google':
        return {
          providerUserId: String(profile.sub || ''),
          email: String(profile.email || ''),
          // Google returns the standard OIDC email_verified claim (may be a
          // boolean or the string "true" depending on serialization).
          emailVerified:
            profile.email_verified === true ||
            profile.email_verified === 'true',
          displayName: String(profile.name || profile.email || ''),
          firstName: String(profile.given_name || ''),
          lastName: String(profile.family_name || ''),
        };
      case 'github': {
        const githubEmailInfo = await this.fetchGithubEmail(accessToken);
        const githubEmail =
          String(profile.email || '') || githubEmailInfo.email;
        // GitHub does not expose a verified flag on the /user profile; trust
        // verification only from the /user/emails API, and only when it maps
        // to the address we ultimately use.
        const emailVerified =
          !!githubEmail &&
          githubEmail === githubEmailInfo.email &&
          githubEmailInfo.verified;
        return {
          providerUserId: String(profile.id || ''),
          email: githubEmail,
          emailVerified,
          displayName: String(profile.name || profile.login || githubEmail),
          firstName: '',
          lastName: '',
        };
      }
      case 'microsoft':
        return {
          providerUserId: String(profile.id || ''),
          email: String(
            profile.mail || profile.userPrincipalName || profile.id || ''
          ),
          // Microsoft Graph /me exposes no email verification claim, so we
          // cannot assert ownership. Treat as unverified: existing accounts
          // must link Microsoft manually from account settings.
          emailVerified: false,
          displayName: String(
            profile.displayName || profile.userPrincipalName || ''
          ),
          firstName: String(profile.givenName || ''),
          lastName: String(profile.surname || ''),
        };
      case 'facebook':
        return {
          providerUserId: String(profile.id || ''),
          email: String(profile.email || ''),
          // Facebook's profile response does not carry a standards-based
          // verification assertion. A returned address remains usable for
          // new-account verification, but never authorizes auto-linking.
          emailVerified: false,
          displayName: String(profile.name || profile.email || ''),
          firstName: String(profile.first_name || ''),
          lastName: String(profile.last_name || ''),
        };
      default:
        throw new Error(`Unsupported provider ${provider}`);
    }
  }

  private async fetchGithubEmail(
    accessToken: string
  ): Promise<{ email: string; verified: boolean }> {
    let response: globalThis.Response;
    try {
      response = await this.fetchProvider(
        'https://api.github.com/user/emails',
        {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
            'User-Agent': 'optimistic-tanuki-gateway',
          },
        }
      );
    } catch {
      return { email: '', verified: false };
    }
    if (!response.ok) {
      return { email: '', verified: false };
    }

    const emails = (await response.json()) as Array<{
      email?: string;
      primary?: boolean;
      verified?: boolean;
    }>;
    const primary =
      emails.find((entry) => entry.primary && entry.verified) ||
      emails.find((entry) => entry.primary) ||
      emails.find((entry) => entry.verified) ||
      emails[0];
    return {
      email: primary?.email || '',
      verified: Boolean(primary?.verified),
    };
  }

  private async fetchProvider(
    url: string,
    init: RequestInit
  ): Promise<globalThis.Response> {
    try {
      return await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(this.providerRequestTimeoutMs),
      });
    } catch {
      throw new Error('OAuth provider request failed');
    }
  }

  private validateProviderIdentity(identity: OAuthIdentity): OAuthIdentity {
    const providerUserId = identity.providerUserId.trim();
    if (
      !providerUserId ||
      providerUserId.length > 512 ||
      /\p{Cc}/u.test(providerUserId) ||
      ['null', 'undefined'].includes(providerUserId.toLowerCase())
    ) {
      throw new Error('OAuth provider identity is invalid');
    }
    return {
      ...identity,
      providerUserId,
      email: identity.email.trim().toLowerCase(),
    };
  }

  private requireUsableOAuthEmail(email: string): void {
    if (!email || !validator.isEmail(email)) {
      throw new OAuthFlowError('provider_email_missing', 'register');
    }
  }

  private async registerOAuthUser(
    appScope: string,
    provider: string,
    identity: OAuthIdentity,
    ageEligibilityStatus?: 'adult',
    guardianResumeToken?: string
  ): Promise<{ userId: string; emailVerified: boolean }> {
    if (appScope === 'owner-console' && process.env.NODE_ENV === 'production') {
      throw new OAuthFlowError(
        (await this.ownerNotProvisioned())
          ? 'owner_not_provisioned'
          : 'registration_closed',
        'register'
      );
    }

    this.requireUsableOAuthEmail(identity.email);

    const { firstName, lastName } = this.splitDisplayName(
      identity.firstName,
      identity.lastName,
      identity.displayName,
      identity.email
    );
    const generatedPassword = this.generateOAuthPassword();
    const registerRequest: RegisterRequest = {
      fn: firstName,
      ln: lastName,
      email: identity.email,
      password: generatedPassword,
      confirm: generatedPassword,
      bio: '',
      ...(guardianResumeToken ? { guardianResumeToken } : {}),
    };

    const registerResult = await this.registerBootstrap.register(
      registerRequest,
      appScope,
      ageEligibilityStatus
    );
    const user = registerResult?.data?.user as
      | { id?: string; emailVerifiedAt?: unknown }
      | undefined;
    const userId = user?.id;
    if (!userId) {
      throw new Error('OAuth registration did not return a user id');
    }

    await firstValueFrom(
      this.authClient.send(
        { cmd: AuthCommands.LinkProvider },
        {
          userId,
          provider,
          providerUserId: identity.providerUserId,
          providerEmail: identity.email,
          providerDisplayName: identity.displayName,
          providerEmailVerified: identity.emailVerified,
        }
      )
    );

    return {
      userId,
      emailVerified: Boolean(user.emailVerifiedAt),
    };
  }

  private async assertOwnerConsoleAccess(
    appScope: string,
    profileId: string
  ): Promise<void> {
    if (appScope !== 'owner-console') {
      return;
    }

    const roles = (await firstValueFrom(
      this.permissionsClient.send(
        { cmd: RoleCommands.GetUserRoles },
        { profileId, appScope: 'global' }
      )
    )) as Array<{ role?: { name?: string } }>;
    const allowedRoleNames = new Set([
      'owner_console_owner',
      'owner',
      'global_admin',
      'system_admin',
    ]);

    if (
      !roles.some((assignment) =>
        allowedRoleNames.has(assignment.role?.name || '')
      )
    ) {
      throw new OAuthFlowError(
        (await this.ownerNotProvisioned(profileId))
          ? 'owner_not_provisioned'
          : 'not_authorized_for_app',
        'access'
      );
    }
  }

  /**
   * True only when the owner console provably has no owner yet: no global
   * profile exists other than `exceptProfileId`. This is the same signal that
   * closes owner-console registration (RegisterAccountBootstrapService), so the
   * two can never disagree. A failed or slow check returns false so the
   * original failure code is reported unchanged.
   */
  private async ownerNotProvisioned(
    exceptProfileId?: string
  ): Promise<boolean> {
    try {
      const global = (await firstValueFrom(
        this.profileClient
          .send(
            { cmd: ProfileCommands.GetAll },
            { where: [{ appScope: 'global' }, { appScope: null }] }
          )
          .pipe(timeout(this.ownerCheckTimeoutMs))
      )) as Array<{ id?: string }>;
      if (!Array.isArray(global)) return false;
      return global.every((profile) => profile.id === exceptProfileId);
    } catch {
      return false;
    }
  }

  private splitDisplayName(
    firstName: string,
    lastName: string,
    displayName: string,
    email: string
  ): { firstName: string; lastName: string } {
    if (firstName || lastName) {
      return {
        firstName: firstName || 'OAuth',
        lastName: lastName || 'User',
      };
    }

    const trimmed = displayName.trim();
    if (!trimmed) {
      return { firstName: email.split('@')[0] || 'OAuth', lastName: 'User' };
    }

    const parts = trimmed.split(/\s+/);
    return {
      firstName: parts[0] || 'OAuth',
      lastName: parts.slice(1).join(' ') || 'User',
    };
  }

  private generateOAuthPassword(): string {
    return `Oauth!${randomBytes(18).toString('base64url')}9`;
  }

  private ageAtRegistration(dateOfBirth?: string): number | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth || '')) return null;
    const dob = new Date(`${dateOfBirth}T00:00:00.000Z`);
    if (
      Number.isNaN(dob.getTime()) ||
      dob.toISOString().slice(0, 10) !== dateOfBirth
    )
      return null;
    const today = new Date();
    if (
      dob.getTime() >
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    )
      return null;
    let age = today.getUTCFullYear() - dob.getUTCFullYear();
    if (
      today.getUTCMonth() < dob.getUTCMonth() ||
      (today.getUTCMonth() === dob.getUTCMonth() &&
        today.getUTCDate() < dob.getUTCDate())
    )
      age--;
    return age;
  }

  private async getOrCreateAppScopedProfile(
    userId: string,
    targetAppId: string,
    displayName: string,
    email: string
  ): Promise<ProfileDto> {
    const effectiveAppScope =
      targetAppId === 'owner-console'
        ? 'global'
        : this.profileScopeForApp(targetAppId);
    const profiles = (await firstValueFrom(
      this.profileClient.send(
        { cmd: ProfileCommands.GetAll },
        { where: { userId } }
      )
    )) as ProfileDto[];
    const appScopedProfile = profiles.find(
      (profile) => profile.appScope === effectiveAppScope
    );
    if (appScopedProfile) {
      return appScopedProfile;
    }

    const globalProfile = profiles.find(
      (profile) => !profile.appScope || profile.appScope === 'global'
    );
    const seedProfile = globalProfile || profiles[0] || null;
    if (!seedProfile) {
      throw new Error('No profile available for user');
    }

    const newProfile: CreateProfileDto & {
      appScope: string;
      copyPermissionsFromGlobalProfile?: boolean;
    } = {
      userId: seedProfile.userId,
      name: seedProfile.profileName || displayName || email,
      description: '',
      profilePic: seedProfile.avatarUrl || '',
      coverPic: '',
      bio: seedProfile.bio || '',
      location: '',
      occupation: '',
      interests: '',
      skills: '',
      appScope: effectiveAppScope,
      copyPermissionsFromGlobalProfile: false,
    };

    const createdProfile = (await firstValueFrom(
      this.profileClient.send({ cmd: ProfileCommands.Create }, newProfile)
    )) as ProfileDto;
    const roleInitOptions = new RoleInitBuilder()
      .setScopeName(effectiveAppScope)
      .setProfile(createdProfile.id)
      .addDefaultProfileOwner(createdProfile.id, effectiveAppScope)
      .addAppScopeDefaults()
      .addAssetOwnerPermissions()
      .build();

    await this.roleInit.processNow(roleInitOptions);
    return createdProfile;
  }
}

import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  HttpException,
  HttpStatus,
  Logger,
  Query,
  Req,
  Res,
} from '@nestjs/common';
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
} from '@optimistic-tanuki/app-registry-backend';
import {
  CreateProfileDto,
  LinkProviderRequest,
  OAuthCallbackRequest,
  OAuthProvider,
  ProfileDto,
  RegisterRequest,
  UnlinkProviderRequest,
} from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import {
  AuthCommands,
  ProfileCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { Public } from '../../decorators/public.decorator';
import { User, UserDetails } from '../../decorators/user.decorator';
import {
  RoleInitBuilder,
  RoleInitService,
} from '@optimistic-tanuki/permission-lib';
import { Request, Response } from 'express';
import { RegisterAccountBootstrapService } from '@optimistic-tanuki/auth-feature-account-bootstrap';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { GATEWAY_APP_REGISTRY } from '../registry/registry.controller';

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
  issuedAt: number;
};

type OAuthIdentity = {
  providerUserId: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  accessToken?: string;
  refreshToken?: string;
};

@ApiTags('oauth')
@Controller('oauth')
export class OAuthController {
  private readonly providers = ['google', 'github', 'microsoft', 'facebook'];
  private readonly oauthStateTtlMs = 10 * 60 * 1000;

  constructor(
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE)
    private readonly authClient: ClientProxy,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileClient: ClientProxy,
    @Inject(GATEWAY_APP_REGISTRY)
    private readonly registry: AppRegistry,
    private readonly logger: Logger,
    private readonly roleInit: RoleInitService,
    private readonly configService: ConfigService,
    private readonly registerBootstrap: RegisterAccountBootstrapService
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
  @ApiOperation({
    summary: 'Initiate shared OAuth login',
    description:
      'Starts server-owned OAuth flow and redirects the popup to the provider. The provider callback always lands on client-interface first.',
  })
  async startOAuth(
    @Req() request: Request,
    @Res() response: Response,
    @Query('returnTo') returnTo: string | undefined,
    @Query('appScope') requestedAppScope: string | undefined,
    @Query('domain') queryDomain: string | undefined
  ) {
    const provider = String((request.params as { provider?: string }).provider || '')
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
    const appScope =
      requestedAppScope?.trim() || this.resolveAppScopeForReturnTo(validatedReturnTo);
    if (!appScope) {
      throw new HttpException(
        'Unable to resolve app scope for OAuth request',
        HttpStatus.BAD_REQUEST
      );
    }

    const domain =
      queryDomain?.trim() || new URL(validatedReturnTo).hostname || undefined;
    const config = this.getProviderConfig(provider, domain);
    if (!config.enabled || !config.clientId || !config.authorizationEndpoint) {
      throw new HttpException(
        `${provider} OAuth is not configured`,
        HttpStatus.BAD_REQUEST
      );
    }

    const state = this.signState({
      provider,
      returnTo: validatedReturnTo,
      appScope,
      issuedAt: Date.now(),
    });

    const redirectUri =
      this.resolveClientInterfaceCallbackBase() + `/oauth/callback/${provider}`;
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: (config.scopes || []).join(' '),
      state,
    });

    if (provider === 'google') {
      params.set('access_type', 'offline');
      params.set('prompt', 'consent');
    }

    response.redirect(`${config.authorizationEndpoint}?${params.toString()}`);
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
    @Res() response: Response
  ) {
    const provider = String((request.params as { provider?: string }).provider || '')
      .trim()
      .toLowerCase();
    if (!this.providers.includes(provider)) {
      throw new HttpException(
        `Unsupported OAuth provider: ${provider}`,
        HttpStatus.BAD_REQUEST
      );
    }

    const { code, state, error, error_description: errorDescription } =
      request.query as Record<string, string | undefined>;
    if (!state) {
      throw new HttpException('Missing OAuth state', HttpStatus.BAD_REQUEST);
    }

    const statePayload = this.verifyState(state, provider);
    const finalCallbackUrl = this.buildFinalCallbackUrl(statePayload.returnTo);

    if (error) {
      response.redirect(
        this.withQuery(finalCallbackUrl, {
          error,
          error_description: errorDescription || error,
          returnTo: statePayload.returnTo,
        })
      );
      return;
    }

    if (!code) {
      response.redirect(
        this.withQuery(finalCallbackUrl, {
          error: 'missing_code',
          error_description: 'No authorization code received',
          returnTo: statePayload.returnTo,
        })
      );
      return;
    }

    try {
      const identity = await this.exchangeProviderCode(
        provider,
        code,
        new URL(statePayload.returnTo).hostname
      );
      const loginResult = await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.OAuthLogin },
          {
            provider,
            providerUserId: identity.providerUserId,
            email: identity.email,
            displayName: identity.displayName,
            accessToken: identity.accessToken,
            refreshToken: identity.refreshToken,
          }
        )
      );

      let userId = loginResult?.data?.userId as string | undefined;
      if (!userId && loginResult?.data?.needsRegistration) {
        userId = await this.registerOAuthUser(statePayload.appScope, provider, identity);
      }

      if (!userId) {
        throw new Error('OAuth login did not resolve a user id');
      }

      const profile = await this.getOrCreateAppScopedProfile(
        userId,
        statePayload.appScope,
        identity.displayName || identity.email,
        identity.email
      );
      const issueResult = await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.Issue },
          { userId, profileId: profile.id }
        )
      );
      const token =
        issueResult?.data?.newToken ||
        issueResult?.newToken ||
        issueResult?.token;
      if (!token) {
        throw new Error('Authentication service did not return a token');
      }

      response.redirect(
        this.withQuery(finalCallbackUrl, {
          token,
          returnTo: statePayload.returnTo,
        })
      );
    } catch (error: any) {
      this.logger.error(
        'Error in oauthRedirectCallback:',
        error?.message || error
      );
      response.redirect(
        this.withQuery(finalCallbackUrl, {
          error: 'oauth_callback_failed',
          error_description:
            error?.message || 'OAuth authentication could not be completed',
          returnTo: statePayload.returnTo,
        })
      );
    }
  }

  @Post('callback')
  @Public()
  @ApiOperation({
    summary: 'Handle OAuth provider callback',
    description:
      'Legacy app-owned callback endpoint. Shared server-owned OAuth should use GET /oauth/start/:provider and GET /oauth/callback/:provider instead.',
  })
  @ApiResponse({
    status: 201,
    description: 'OAuth callback processed successfully.',
  })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async oauthCallback(@Body() data: OAuthCallbackRequest) {
    try {
      this.logger.debug(`OAuth callback for provider=${data.provider}`);
      return await firstValueFrom(
        this.authClient.send({ cmd: AuthCommands.OAuthLogin }, data)
      );
    } catch (error) {
      this.logger.error('Error in oauthCallback:', error?.message || error);
      throw new HttpException(
        `OAuth callback failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('link')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Link an OAuth provider to the current user account',
    description:
      "Links a new OAuth provider (Google, GitHub, etc.) to the authenticated user's account.",
  })
  @ApiResponse({ status: 201, description: 'Provider linked successfully.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async linkProvider(
    @Body() data: Omit<LinkProviderRequest, 'userId'>,
    @User() user: UserDetails
  ) {
    try {
      this.logger.debug(
        `Linking provider=${data.provider} to userId=${user.userId}`
      );
      return await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.LinkProvider },
          { ...data, userId: user.userId }
        )
      );
    } catch (error) {
      this.logger.error('Error in linkProvider:', error?.message || error);
      throw new HttpException(
        `Link provider failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

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
    @User() user: UserDetails
  ) {
    try {
      this.logger.debug(
        `Unlinking provider=${data.provider} from userId=${user.userId}`
      );
      return await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.UnlinkProvider },
          { ...data, userId: user.userId }
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
  async getLinkedProviders(@User() user: UserDetails) {
    try {
      this.logger.debug(`Getting linked providers for userId=${user.userId}`);
      return await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.GetLinkedProviders },
          { userId: user.userId }
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

      return await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.GetOAuthConfig },
          { domain }
        )
      );
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

    const origin = parsed.origin;
    const knownOrigin = this.registry.apps.some(
      (app) => this.safeOrigin(app.uiBaseUrl) === origin
    );
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

  private resolveAppScopeForReturnTo(returnTo: string): string | null {
    const origin = this.safeOrigin(returnTo);
    const app = this.registry.apps.find(
      (entry) => this.safeOrigin(entry.uiBaseUrl) === origin
    );
    return app?.appId ?? null;
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
      this.registry.apps.find(
        (entry) => entry.appId === 'client-interface'
      ) ??
      this.findRegistryAppByDomain(process.env.CLIENT_INTERFACE_DOMAIN);

    if (app?.uiBaseUrl) {
      return app.uiBaseUrl.replace(/\/$/, '');
    }

    throw new HttpException(
      'client-interface callback host is not configured',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }

  private findRegistryAppByDomain(domain?: string): AppRegistration | undefined {
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
      this.configService.get<Array<Record<string, unknown>>>('oauth.apps') || [];
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

  private signState(payload: OAuthStatePayload): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      'base64url'
    );
    const signature = createHmac('sha256', this.oauthStateSecret())
      .update(encodedPayload)
      .digest('base64url');
    return `${encodedPayload}.${signature}`;
  }

  private verifyState(state: string, provider: string): OAuthStatePayload {
    const [encodedPayload, signature] = state.split('.');
    if (!encodedPayload || !signature) {
      throw new HttpException('Invalid OAuth state', HttpStatus.BAD_REQUEST);
    }

    const expectedSignature = createHmac('sha256', this.oauthStateSecret())
      .update(encodedPayload)
      .digest('base64url');
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

    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as OAuthStatePayload;
    if (payload.provider !== provider) {
      throw new HttpException('Invalid OAuth state', HttpStatus.BAD_REQUEST);
    }
    if (Date.now() - payload.issuedAt > this.oauthStateTtlMs) {
      throw new HttpException('OAuth state has expired', HttpStatus.BAD_REQUEST);
    }

    payload.returnTo = this.validateReturnTo(payload.returnTo);
    return payload;
  }

  private oauthStateSecret(): string {
    return (
      process.env.JWT_SECRET ||
      this.configService.get<string>('auth.jwtSecret') ||
      this.configService.get<string>('auth.jwt_secret') ||
      'default_oauth_state_secret'
    );
  }

  private safeOrigin(url: string): string {
    try {
      return new URL(url).origin;
    } catch {
      return '';
    }
  }

  private buildFinalCallbackUrl(returnTo: string): string {
    const parsed = new URL(returnTo);
    return `${parsed.origin}/oauth/callback`;
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
    domain?: string
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
      this.resolveClientInterfaceCallbackBase() + `/oauth/callback/${provider}`;
    const tokenParams = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    if (provider !== 'github') {
      tokenParams.set('grant_type', 'authorization_code');
    }

    const tokenResponse = await fetch(config.tokenEndpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });
    if (!tokenResponse.ok) {
      throw new Error(
        `${provider} token exchange failed with ${tokenResponse.status}`
      );
    }

    const tokenPayload = (await tokenResponse.json()) as Record<
      string,
      string | undefined
    >;
    const accessToken = tokenPayload.access_token;
    if (!accessToken) {
      throw new Error(`${provider} token exchange did not return an access token`);
    }

    return this.fetchProviderIdentity(provider, accessToken, tokenPayload, config);
  }

  private async fetchProviderIdentity(
    provider: string,
    accessToken: string,
    tokenPayload: Record<string, string | undefined>,
    config: GatewayOAuthProviderConfig
  ): Promise<OAuthIdentity> {
    const userInfoUrl =
      provider === 'facebook'
        ? `${config.userInfoEndpoint}?fields=id,name,email,first_name,last_name`
        : config.userInfoEndpoint!;
    const userInfoResponse = await fetch(userInfoUrl, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(provider === 'github'
          ? { 'User-Agent': 'optimistic-tanuki-gateway' }
          : {}),
      },
    });

    if (!userInfoResponse.ok) {
      throw new Error(
        `${provider} user info request failed with ${userInfoResponse.status}`
      );
    }

    const profile = (await userInfoResponse.json()) as Record<string, unknown>;
    switch (provider) {
      case 'google':
        return {
          providerUserId: String(profile.sub || ''),
          email: String(profile.email || ''),
          displayName: String(profile.name || profile.email || ''),
          firstName: String(profile.given_name || ''),
          lastName: String(profile.family_name || ''),
          accessToken,
          refreshToken: tokenPayload.refresh_token,
        };
      case 'github': {
        const githubEmail =
          String(profile.email || '') || (await this.fetchGithubEmail(accessToken));
        return {
          providerUserId: String(profile.id || ''),
          email: githubEmail,
          displayName: String(profile.name || profile.login || githubEmail),
          firstName: '',
          lastName: '',
          accessToken,
          refreshToken: tokenPayload.refresh_token,
        };
      }
      case 'microsoft':
        return {
          providerUserId: String(profile.id || ''),
          email: String(
            profile.mail || profile.userPrincipalName || profile.id || ''
          ),
          displayName: String(
            profile.displayName || profile.userPrincipalName || ''
          ),
          firstName: String(profile.givenName || ''),
          lastName: String(profile.surname || ''),
          accessToken,
          refreshToken: tokenPayload.refresh_token,
        };
      case 'facebook':
        return {
          providerUserId: String(profile.id || ''),
          email: String(profile.email || ''),
          displayName: String(profile.name || profile.email || ''),
          firstName: String(profile.first_name || ''),
          lastName: String(profile.last_name || ''),
          accessToken,
          refreshToken: tokenPayload.refresh_token,
        };
      default:
        throw new Error(`Unsupported provider ${provider}`);
    }
  }

  private async fetchGithubEmail(accessToken: string): Promise<string> {
    const response = await fetch('https://api.github.com/user/emails', {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'optimistic-tanuki-gateway',
      },
    });
    if (!response.ok) {
      return '';
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
    return primary?.email || '';
  }

  private async registerOAuthUser(
    appScope: string,
    provider: string,
    identity: OAuthIdentity
  ): Promise<string> {
    if (!identity.email) {
      throw new Error(
        `${provider} OAuth did not return an email address required for registration`
      );
    }

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
    };

    const registerResult = await this.registerBootstrap.register(
      registerRequest,
      appScope
    );
    const userId = registerResult?.data?.user?.id as string | undefined;
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
          accessToken: identity.accessToken,
          refreshToken: identity.refreshToken,
          providerEmail: identity.email,
          providerDisplayName: identity.displayName,
        }
      )
    );

    return userId;
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

  private async getOrCreateAppScopedProfile(
    userId: string,
    targetAppId: string,
    displayName: string,
    email: string
  ): Promise<ProfileDto> {
    const effectiveAppScope =
      targetAppId === 'owner-console' ? 'global' : targetAppId;
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

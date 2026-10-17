import {
  CanActivate,
  ForbiddenException,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ClientProxy } from '@nestjs/microservices';
import {
  AuthCommands,
  RoleCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { UserContext } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { UserDetails } from '../decorators/user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AppRegistry } from '@optimistic-tanuki/app-registry-backend';
import { GATEWAY_APP_REGISTRY } from '../controllers/registry/registry.tokens';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE)
    private authService: ClientProxy,
    private reflector: Reflector,
    private readonly jwt: JwtService,
    @Inject(ServiceTokens.PERMISSIONS_SERVICE)
    private readonly permissionsClient: ClientProxy,
    @Inject(GATEWAY_APP_REGISTRY) private readonly appRegistry: AppRegistry
  ) {}

  private async assertPrivilegedScopeAccess(
    appScope: unknown,
    profileId: string | undefined
  ): Promise<void> {
    const scope = Array.isArray(appScope) ? appScope[0] : appScope;
    if (scope !== 'owner-console' && scope !== 'global') {
      return;
    }

    if (!profileId) {
      throw new ForbiddenException(
        'A global owner profile is required for this app scope.'
      );
    }

    const roleScope = scope === 'owner-console' ? 'owner-console' : 'global';
    let roles: Array<{ role?: { name?: string } }>;

    try {
      roles = (await firstValueFrom(
        this.permissionsClient.send(
          { cmd: RoleCommands.GetUserRoles },
          { profileId, appScope: roleScope }
        )
      )) as Array<{ role?: { name?: string } }>;
    } catch {
      throw new ForbiddenException(
        'Unable to verify privileged app scope access.'
      );
    }

    const allowedRoleNames = new Set(
      scope === 'owner-console'
        ? ['owner_console_owner', 'owner', 'global_admin', 'system_admin']
        : ['owner', 'global_admin', 'system_admin']
    );

    if (
      !roles?.some((assignment) =>
        allowedRoleNames.has(assignment.role?.name || '')
      )
    ) {
      throw new ForbiddenException(
        'This account is not authorized for Owner Console access.'
      );
    }
  }

  private async introspectToken(
    token: string,
    userId: string,
    appId?: string
  ): Promise<{ isValid: boolean; emailVerified: boolean }> {
    const response = (await firstValueFrom(
      this.authService.send(
        { cmd: AuthCommands.Validate },
        { token, userId, appId }
      )
    )) as { isValid?: boolean; emailVerified?: boolean };
    return {
      isValid: Boolean(response?.isValid),
      emailVerified: response?.emailVerified === true,
    };
  }

  private registeredHostAppId(host: string | undefined): string | undefined {
    if (!host) return undefined;
    let normalizedHost: string;
    try {
      normalizedHost = new URL(`http://${host.trim()}`).host.toLowerCase();
    } catch {
      return undefined;
    }
    const matches = this.appRegistry.apps.filter((app) => {
      try {
        return [app.uiBaseUrl, app.apiBaseUrl].some(
          (baseUrl) => new URL(baseUrl).host.toLowerCase() === normalizedHost
        );
      } catch {
        return false;
      }
    });
    return matches.length === 1 ? matches[0].appId : undefined;
  }

  private requestAppId(request: {
    headers?: Record<string, string | undefined>;
  }): string | undefined {
    const origin = request.headers?.origin;
    const hostAppId = this.registeredHostAppId(request.headers?.host);
    if (!origin) return hostAppId;
    try {
      const normalized = new URL(origin).origin;
      const originAppId = this.appRegistry.apps.find((app) => {
        try {
          return new URL(app.uiBaseUrl).origin === normalized;
        } catch {
          return false;
        }
      })?.appId;
      // Origin is caller-controlled. When the gateway can identify the app
      // from its actual Host header, require both signals to identify it.
      if (hostAppId && hostAppId !== originAppId) return undefined;
      return originAppId;
    } catch {
      return undefined;
    }
  }

  async parseToken(token: string): Promise<UserDetails> {
    return await this.jwt.verifyAsync<UserDetails>(token);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    const bearerToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length).trim()
        : '';
    const cookieToken =
      typeof request.cookies?.ot_session === 'string'
        ? request.cookies.ot_session
        : '';
    const credential = bearerToken || cookieToken;

    // Try to attach user if token exists, even for public routes. Signature
    // verification alone is not sufficient here: a revoked session still
    // carries a structurally valid JWT. Optional identities must pass the same
    // authentication-service introspection as protected requests before they
    // can influence membership-aware responses.
    if (credential) {
      try {
        const user = await this.jwt.verifyAsync<UserDetails>(credential);
        const origin = request.headers?.origin;
        const hostAppId = this.registeredHostAppId(request.headers?.host);
        const originAppId = this.requestAppId(request);
        const signedAppId =
          typeof (user as UserDetails & { appId?: unknown }).appId === 'string'
            ? (user as UserDetails & { appId: string }).appId
            : undefined;
        if (
          (origin && !originAppId) ||
          (origin &&
            !hostAppId &&
            (!signedAppId || signedAppId !== originAppId)) ||
          (signedAppId && originAppId && signedAppId !== originAppId) ||
          (signedAppId && hostAppId && signedAppId !== hostAppId)
        ) {
          throw new UnauthorizedException(
            'Session application scope does not match request origin.'
          );
        }
        const authentication = await this.introspectToken(
          credential,
          user.userId,
          signedAppId || originAppId
        );
        if (!authentication.isValid) {
          throw new UnauthorizedException(
            'Unauthorized: Token Invalid (Introspection failed).'
          );
        }

        const userContext: UserContext = {
          userId: user.userId,
          email: user.email,
          name: user.name,
          profileId: user.profileId,
          appId: signedAppId || originAppId,
          scopes: [],
          roles: [],
        };
        userContext.emailVerified = authentication.emailVerified;
        request.user = userContext;
        // The credential itself, whichever way it arrived.
        //
        // The browser signs in with a cookie rather than a bearer header, so a
        // route needing to act as the caller downstream, against the MCP
        // server for instance, cannot read one off the headers. Anything
        // taking a token from the request has to take it from here.
        request.credential = credential;
      } catch (e) {
        // A public endpoint remains anonymously accessible when an optional
        // credential is malformed, expired, revoked, or unavailable to the
        // introspection service. In that case request.user must stay empty so
        // downstream resolvers cannot treat the caller as a member.
        if (!isPublic) {
          if (e instanceof UnauthorizedException) {
            throw e;
          }
          throw new UnauthorizedException(
            'Unauthorized: Token Invalid or Expired.'
          );
        }
      }
    }

    if (isPublic) {
      return true;
    }

    if (!request.user) {
      if (!credential) {
        throw new UnauthorizedException(
          'Unauthorized: No session credential provided.'
        );
      }
      // If we reached here, auth header existed but parsing failed and caught above
      throw new UnauthorizedException('Unauthorized: Token Invalid.');
    }

    await this.assertPrivilegedScopeAccess(
      request.headers['x-ot-appscope'],
      request.user.profileId
    );

    return true;
  }
}

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

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE)
    private authService: ClientProxy,
    private reflector: Reflector,
    private readonly jwt: JwtService,
    @Inject(ServiceTokens.PERMISSIONS_SERVICE)
    private readonly permissionsClient: ClientProxy
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
    userId: string
  ): Promise<{ isValid: boolean; emailVerified: boolean }> {
    const response = (await firstValueFrom(
      this.authService.send({ cmd: AuthCommands.Validate }, { token, userId })
    )) as { isValid?: boolean; emailVerified?: boolean };
    return {
      isValid: Boolean(response?.isValid),
      emailVerified: response?.emailVerified === true,
    };
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
        const authentication = await this.introspectToken(
          credential,
          user.userId
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

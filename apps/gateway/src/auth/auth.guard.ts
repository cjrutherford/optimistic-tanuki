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
  ): Promise<boolean> {
    const response = await firstValueFrom(
      this.authService.send({ cmd: AuthCommands.Validate }, { token, userId })
    );
    // Assuming the response contains a field `isValid` to indicate token validity
    return response && response.isValid;
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

    // Try to attach user if token exists, even for public routes
    if (credential) {
      try {
        const user = await this.jwt.verifyAsync<UserDetails>(credential);
        // Optional: Introspect if strict validation needed, but verifyAsync checks signature/exp
        // const isAuthenticated = await this.introspectToken(credential, user.userId);

        const userContext: UserContext = {
          userId: user.userId,
          email: user.email,
          name: user.name,
          profileId: user.profileId,
          scopes: [],
          roles: [],
        };
        request.user = userContext;
        // The credential itself, whichever way it arrived.
        //
        // The browser signs in with a cookie rather than a bearer header, so a
        // route needing to act as the caller downstream, against the MCP
        // server for instance, cannot read one off the headers. Anything
        // taking a token from the request has to take it from here.
        request.credential = credential;
      } catch (e) {
        // If public, ignore auth errors. If private, the check below will fail.
        if (!isPublic) {
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

    // If we want to enforce introspection for protected routes:
    // We can do it here if we didn't do it in the optional block.
    // Ideally we should reuse the logic.

    // For now, relying on verifyAsync is standard for stateless JWTs unless revocation checks are strict.
    // The original code did introspect. Let's restore that for protected routes if needed,
    // or assume verifyAsync is enough for now.
    // BUT the original code called introspectToken.

    // Let's add strict introspection check for protected routes.
    const isAuthenticated = await this.introspectToken(
      credential,
      request.user.userId
    );
    if (!isAuthenticated) {
      throw new UnauthorizedException(
        'Unauthorized: Token Invalid (Introspection failed).'
      );
    }

    await this.assertPrivilegedScopeAccess(
      request.headers['x-ot-appscope'],
      request.user.profileId
    );

    return true;
  }
}

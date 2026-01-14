import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ClientProxy } from '@nestjs/microservices';
import { AuthCommands, ServiceTokens } from '@optimistic-tanuki/constants';
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
    private readonly jwt: JwtService
  ) {}

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

    // Try to attach user if token exists, even for public routes
    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1];
        if (token) {
          const user = await this.jwt.verifyAsync<UserDetails>(token);
          // Optional: Introspect if strict validation needed, but verifyAsync checks signature/exp
          // const isAuthenticated = await this.introspectToken(token, user.userId);

          const userContext: UserContext = {
            userId: user.userId,
            email: user.email,
            name: user.name,
            profileId: user.profileId,
            scopes: [],
            roles: [],
          };
          request.user = userContext;
        }
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
      if (!authHeader) {
        throw new UnauthorizedException(
          'Unauthorized: No Auth Header Provided.'
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
    const token = authHeader.split(' ')[1];
    const isAuthenticated = await this.introspectToken(
      token,
      request.user.userId
    );
    if (!isAuthenticated) {
      throw new UnauthorizedException(
        'Unauthorized: Token Invalid (Introspection failed).'
      );
    }

    return true;
  }
}

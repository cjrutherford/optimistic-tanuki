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
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    if (!authHeader) {
      throw new UnauthorizedException('Unauthorized: No Auth Header Provided.');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException('Unauthorized: No Token Found.');
    }
    const user = await this.jwt.verifyAsync<UserDetails>(token);
    const isAuthenticated = await this.introspectToken(token, user.userId);

    if (!isAuthenticated) {
      throw new UnauthorizedException('Unauthorized: Token Invalid.');
    }

    const userContext: UserContext = {
      userId: user.userId,
      email: user.email,
      name: user.name,
      profileId: user.profileId,
      scopes: [],
      roles: [],
    };

    request.user = userContext;

    return true;
  }
}

import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClientProxy } from '@nestjs/microservices';
import { AuthCommands } from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject('AUTHENTICATION_SERVICE') private authService: ClientProxy, private reflector: Reflector) {}

  private async introspectToken(token: string) {
      const response = await firstValueFrom(this.authService.send({ cmd: AuthCommands.Validate }, { token }));
      // Assuming the response contains a field `isValid` to indicate token validity
      return response && response.isValid;
  }

  parseToken(token: string) {
      // Assuming the token is a JWT token
      const payload = Buffer.from(token.split('.')[1], 'base64').toString('utf-8');
      return JSON.parse(payload);
  }

  async canActivate(
      context: ExecutionContext,
  ): Promise<boolean> {
      const request = context.switchToHttp().getRequest();
      const authHeader = request.headers['authorization'];
      if (!authHeader) {
          console.log("😵 No Auth Header Provided")
          throw new UnauthorizedException('Unauthorized: No Auth Header Provided.');
      }

      const token = authHeader.split(' ')[1];
      if (!token) {
            console.log("😵 No Token Found");
          throw new UnauthorizedException('Unauthorized: No Token Found.');
      }
      const isAuthenticated = await this.introspectToken(token);

      if (!isAuthenticated) {
            console.log("😵 Token Invalid");
          throw new UnauthorizedException('Unauthorized: Token Invalid.');
      }

      const user = this.parseToken(token);
      request.user = user;

      return true;
  }
}

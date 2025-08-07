import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClientProxy } from '@nestjs/microservices';
import { AuthCommands } from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';

/**
 * A guard that checks for authentication and validates tokens.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  /**
   * Creates an instance of AuthGuard.
   * @param authService Client proxy for the authentication service.
   * @param reflector The Reflector instance.
   */
  constructor(
    @Inject('AUTHENTICATION_SERVICE') private authService: ClientProxy,
    private reflector: Reflector
  ) {}

  /**
   * Introspects the given token by sending it to the authentication service for validation.
   * @param token The token to introspect.
   * @param userId The ID of the user associated with the token.
   * @returns A Promise that resolves to a boolean indicating token validity.
   */
  private async introspectToken(token: string, userId: string): Promise<boolean> {
    const response = await firstValueFrom(
      this.authService.send({ cmd: AuthCommands.Validate }, { token, userId })
    );
    console.log(response);
    // Assuming the response contains a field `isValid` to indicate token validity
    return response && response.isValid;
  }

  /**
   * Parses a JWT token to extract its payload.
   * @param token The JWT token to parse.
   * @returns The parsed payload of the token.
   */
  parseToken(token: string) {
    // Assuming the token is a JWT token
    const payload = Buffer.from(token.split('.')[1], 'base64').toString(
      'utf-8'
    );
    const data = JSON.parse(payload);
    return data;
  }

  /**
   * Determines if the current request can be activated.
   * @param context The execution context.
   * @returns A Promise that resolves to a boolean indicating whether the request can be activated.
   * @throws UnauthorizedException if authentication fails.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    if (!authHeader) {
      throw new UnauthorizedException('Unauthorized: No Auth Header Provided.');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException('Unauthorized: No Token Found.');
    }
    const user = this.parseToken(token);
    const isAuthenticated = await this.introspectToken(token, user.userId);
    console.log("🚀 ~ AuthGuard ~ canActivate ~ isAuthenticated:", isAuthenticated)

    if (!isAuthenticated) {
      throw new UnauthorizedException('Unauthorized: Token Invalid.');
    }

    request.user = user;

    return true;
  }
}

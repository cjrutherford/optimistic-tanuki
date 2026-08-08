import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClientProxy } from '@nestjs/microservices';
import { AuthCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';
import { Socket } from 'socket.io';
import { UserDetails } from '../decorators/user.decorator';

export type SocketSessionUser = Pick<UserDetails, 'profileId' | 'userId'>;

/**
 * Authenticates Socket.IO clients with the same HttpOnly session used by the
 * HTTP gateway. A bearer token remains a temporary compatibility fallback for
 * non-browser clients while they migrate to cookie sessions.
 */
@Injectable()
export class SocketSessionAuthService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE)
    private readonly authenticationService: ClientProxy
  ) {}

  async authenticate(socket: Socket): Promise<SocketSessionUser> {
    const credential = this.getCredential(socket);
    if (!credential) {
      throw new UnauthorizedException('Unauthorized socket connection');
    }

    try {
      const tokenPayload = await this.jwt.verifyAsync<UserDetails>(credential);
      const validation = await firstValueFrom(
        this.authenticationService.send(
          { cmd: AuthCommands.Validate },
          { token: credential, userId: tokenPayload.userId }
        )
      );

      if (!validation?.isValid || !tokenPayload.profileId) {
        throw new UnauthorizedException('Unauthorized socket connection');
      }

      const user = {
        userId: tokenPayload.userId,
        profileId: tokenPayload.profileId,
      };
      socket.data.user = user;
      return user;
    } catch {
      throw new UnauthorizedException('Unauthorized socket connection');
    }
  }

  getUser(socket: Socket): SocketSessionUser {
    const user = socket.data.user as SocketSessionUser | undefined;
    if (!user?.userId || !user.profileId) {
      throw new UnauthorizedException('Unauthorized socket connection');
    }
    return user;
  }

  assertProfile(
    socket: Socket,
    requestedProfileId?: string
  ): SocketSessionUser {
    const user = this.getUser(socket);
    if (requestedProfileId && requestedProfileId !== user.profileId) {
      throw new UnauthorizedException('Socket profile does not match session');
    }
    return user;
  }

  private getCredential(socket: Socket): string {
    const cookieToken = this.getCookie(socket.handshake.headers.cookie);
    if (cookieToken) {
      return cookieToken;
    }

    const authToken = socket.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.trim();
    }

    const authorization = socket.handshake.headers.authorization;
    const header = Array.isArray(authorization)
      ? authorization[0]
      : authorization;
    return typeof header === 'string' && header.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : '';
  }

  private getCookie(cookieHeader: string | undefined): string {
    const cookie = cookieHeader
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('ot_session='));
    if (!cookie) {
      return '';
    }

    try {
      return decodeURIComponent(cookie.slice('ot_session='.length));
    } catch {
      return '';
    }
  }
}

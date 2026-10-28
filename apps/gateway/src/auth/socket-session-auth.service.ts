import { verifySessionToken } from './session-policy';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClientProxy } from '@nestjs/microservices';
import { AuthCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { firstValueFrom, timeout } from 'rxjs';
import { createHash } from 'node:crypto';
import { Socket } from 'socket.io';
import { UserDetails } from '../decorators/user.decorator';
import type { AppRegistry } from '@optimistic-tanuki/app-registry-backend';
import { GATEWAY_APP_REGISTRY } from '../controllers/registry/registry.tokens';

export type SocketSessionUser = Pick<UserDetails, 'profileId' | 'userId'>;

/**
 * Authenticates Socket.IO clients with the same HttpOnly session used by the
 * HTTP gateway. A bearer token remains a temporary compatibility fallback for
 * non-browser clients while they migrate to cookie sessions.
 */
@Injectable()
export class SocketSessionAuthService {
  private readonly deletionFences = new Set<string>();
  private readonly authenticatedSockets = new Set<Socket>();
  private readonly closingSockets = new Map<Socket, string>();
  private readonly authenticating = new Set<Promise<SocketSessionUser>>();

  constructor(
    private readonly jwt: JwtService,
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE)
    private readonly authenticationService: ClientProxy,
    @Inject(GATEWAY_APP_REGISTRY) private readonly appRegistry: AppRegistry
  ) {}

  async authenticate(
    socket: Socket,
    activity = false
  ): Promise<SocketSessionUser> {
    const pending = this.authenticateSession(socket, activity);
    this.authenticating.add(pending);
    try {
      return await pending;
    } finally {
      this.authenticating.delete(pending);
    }
  }

  private async authenticateSession(
    socket: Socket,
    activity: boolean
  ): Promise<SocketSessionUser> {
    const credential = this.getCredential(socket);
    if (!credential) {
      throw new UnauthorizedException('Unauthorized socket connection');
    }

    let verifiedAccount: string | undefined;
    try {
      const tokenPayload = await verifySessionToken<UserDetails>(
        this.jwt,
        credential
      );
      verifiedAccount = tokenPayload.userId;
      this.rejectDeletedSession(socket, tokenPayload.userId);
      const origin = socket.handshake.headers.origin;
      const originAppId = this.requestAppId(origin);
      const signedAppId =
        typeof (tokenPayload as UserDetails & { appId?: unknown }).appId ===
        'string'
          ? (tokenPayload as UserDetails & { appId: string }).appId
          : undefined;
      if (
        (origin && !originAppId) ||
        (signedAppId && originAppId && signedAppId !== originAppId)
      ) {
        throw new UnauthorizedException('Unauthorized socket connection');
      }
      const validation = await firstValueFrom(
        this.authenticationService
          .send(
            { cmd: AuthCommands.Validate },
            {
              token: credential,
              userId: tokenPayload.userId,
              appId: signedAppId || originAppId,
              activity: activity === true,
            }
          )
          .pipe(timeout(3000))
      );

      if (!validation?.isValid || !tokenPayload.profileId) {
        throw new UnauthorizedException('Unauthorized socket connection');
      }

      const user = {
        userId: tokenPayload.userId,
        profileId: tokenPayload.profileId,
      };
      this.rejectDeletedSession(socket, user.userId);
      socket.data.user = user;
      if (!this.authenticatedSockets.has(socket)) {
        if (this.authenticatedSockets.size >= 10000) {
          delete socket.data.user;
          throw new UnauthorizedException('Socket session capacity exceeded');
        }
        this.authenticatedSockets.add(socket);
        socket.once?.('disconnect', () =>
          this.authenticatedSockets.delete(socket)
        );
      }
      return user;
    } catch {
      if (verifiedAccount && !socket.data.deletionPurged)
        this.rejectDeletedSession(socket, verifiedAccount);
      throw new UnauthorizedException('Unauthorized socket connection');
    }
  }

  getUser(socket: Socket): SocketSessionUser {
    const user = socket.data.user as SocketSessionUser | undefined;
    if (!user?.userId || !user.profileId || socket.data.deletionPurged) {
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

  /** Trusted deletion caller; ordinary logout does not install this permanent process fence. */
  async purgeAccount(accountId: string): Promise<{ remaining: 0 }> {
    const key = this.deletionKey(accountId, true);
    if (!this.deletionFences.has(key) && this.deletionFences.size >= 10000)
      throw Error('SOCKET_DELETION_FENCE_LIMIT');
    this.deletionFences.add(key);
    await this.drainAuthentication();
    for (const socket of new Set([
      ...this.authenticatedSockets,
      ...this.closingSockets.keys(),
    ])) {
      const user = socket.data.user as SocketSessionUser | undefined;
      if (
        this.closingSockets.get(socket) !== key &&
        user?.userId?.toLowerCase() !== accountId.toLowerCase()
      )
        continue;
      this.closingSockets.set(socket, key);
      socket.emit?.('account_deleted', { accountId: accountId.toLowerCase() });
      this.clearDeletedSession(socket);
      socket.disconnect(true);
      this.closingSockets.delete(socket);
      this.authenticatedSockets.delete(socket);
    }
    if ((await this.readbackAccount(accountId)) !== 0)
      throw Error('SOCKET_DELETION_READBACK');
    return { remaining: 0 };
  }

  async readbackAccount(accountId: string): Promise<number> {
    if (!this.deletionFences.has(this.deletionKey(accountId, true)))
      throw Error('SOCKET_DELETION_FENCE_REQUIRED');
    await this.drainAuthentication();
    const key = this.deletionKey(accountId, true);
    return [
      ...new Set([...this.authenticatedSockets, ...this.closingSockets.keys()]),
    ].filter(
      (socket) =>
        this.closingSockets.get(socket) === key ||
        (
          socket.data.user as SocketSessionUser | undefined
        )?.userId?.toLowerCase() === accountId.toLowerCase()
    ).length;
  }

  private deletionKey(accountId: string, validate = false): string {
    if (
      typeof accountId !== 'string' ||
      (validate &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          accountId
        ))
    )
      throw Error('SOCKET_DELETION_ACCOUNT_INVALID');
    return createHash('sha256')
      .update(`ot:socket-deletion:${accountId.toLowerCase()}`)
      .digest('hex');
  }

  private rejectDeletedSession(socket: Socket, accountId: string): void {
    if (this.deletionFences.has(this.deletionKey(accountId))) {
      const key = this.deletionKey(accountId);
      this.closingSockets.set(socket, key);
      this.clearDeletedSession(socket);
      socket.disconnect(true);
      this.closingSockets.delete(socket);
      throw new UnauthorizedException('Unauthorized socket connection');
    }
  }

  private clearDeletedSession(socket: Socket): void {
    socket.data.deletionPurged = true;
    delete socket.data.user;
    delete socket.handshake.auth?.token;
    delete socket.handshake.headers.cookie;
    delete socket.handshake.headers.authorization;
    if (socket.request?.headers) {
      delete socket.request.headers.cookie;
      delete socket.request.headers.authorization;
    }
  }

  private async drainAuthentication(): Promise<void> {
    const pending = [...this.authenticating];
    if (!pending.length) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.allSettled(pending),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(Error('SOCKET_DELETION_AUTH_DRAIN_TIMEOUT')),
            5000
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
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

  private requestAppId(origin?: string): string | undefined {
    if (!origin) return undefined;
    try {
      const normalized = new URL(origin).origin;
      return this.appRegistry.apps.find((app) => {
        try {
          return new URL(app.uiBaseUrl).origin === normalized;
        } catch {
          return false;
        }
      })?.appId;
    } catch {
      return undefined;
    }
  }
}

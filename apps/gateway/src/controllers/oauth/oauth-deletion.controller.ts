import { randomUUID } from 'node:crypto';
import { payloadFreeLoggingStatus } from '@optimistic-tanuki/logger';
import { CommunityInviteMailer } from '../social/community/community-invite.mailer';
import { PermissionsCacheService } from '../../auth/permissions-cache.service';
import { ChatGateway } from '../../app/chat-gateway/chat.gateway';
import {
  Body,
  Controller,
  ForbiddenException,
  Inject,
  Post,
  Optional,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { validateDeletionGrantShape } from '@optimistic-tanuki/models';
import { AccountDeletionAuthorityClient } from '@optimistic-tanuki/storage';
import { OAUTH_STATE_STORE, OAuthStateStore } from './oauth-state.store';
import { SocketSessionAuthService } from '../../auth/socket-session-auth.service';

/** Internal capability boundary: a revoked user's session cannot authorize cleanup. */
@Controller('internal/account-deletion/oauth')
export class OAuthDeletionController {
  private readonly authority: AccountDeletionAuthorityClient;
  constructor(
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE) auth: ClientProxy,
    @Inject(OAUTH_STATE_STORE) private readonly store: OAuthStateStore
  ) {
    this.authority = new AccountDeletionAuthorityClient(auth);
  }

  @Post('purge')
  async purge(@Body() value: unknown) {
    return this.execute(value, true);
  }

  @Post('readback')
  async readback(@Body() value: unknown) {
    return this.execute(value, false);
  }

  private execute(value: unknown, purge: boolean) {
    return executeDeletion(
      value,
      purge,
      this.authority,
      this.store,
      'oauth-callback-state'
    );
  }
}

@Controller('internal/account-deletion/sessions')
export class SocketSessionDeletionController {
  private readonly authority: AccountDeletionAuthorityClient;
  constructor(
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE) auth: ClientProxy,
    private readonly sessions: SocketSessionAuthService
  ) {
    this.authority = new AccountDeletionAuthorityClient(auth);
  }

  @Post('purge')
  purge(@Body() value: unknown) {
    return executeDeletion(
      value,
      true,
      this.authority,
      this.sessions,
      'socket-sessions'
    );
  }

  @Post('readback')
  readback(@Body() value: unknown) {
    return executeDeletion(
      value,
      false,
      this.authority,
      this.sessions,
      'socket-sessions'
    );
  }
}

@Controller('internal/account-deletion/permissions')
export class PermissionCacheDeletionController {
  private readonly authority: AccountDeletionAuthorityClient;
  constructor(
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE) auth: ClientProxy,
    private readonly cache: PermissionsCacheService,
    @Optional() private readonly chat?: ChatGateway
  ) {
    this.authority = new AccountDeletionAuthorityClient(auth);
  }
  @Post('purge') purge(@Body() value: unknown) {
    return this.execute(value, true);
  }
  @Post('readback') readback(@Body() value: unknown) {
    return this.execute(value, false);
  }
  private execute(value: unknown, purge: boolean) {
    return executeDeletion(
      value,
      purge,
      this.authority,
      {
        purgeAccount: async (accountId, profiles) => {
          if (!profiles) throw Error('DELETION_SCOPE_REQUIRED');
          await this.cache.purgeAccountProfiles(profiles);
          this.chat?.purgeAccountSecurityState(accountId);
          return { remaining: 0 };
        },
        readbackAccount: async (accountId, profiles) => {
          if (!profiles) throw Error('DELETION_SCOPE_REQUIRED');
          return (
            (await this.cache.readbackAccountProfiles(profiles)) +
            (this.chat?.readbackAccountSecurityState(accountId) ?? 0)
          );
        },
      },
      'permission-caches'
    );
  }
}

async function executeDeletion(
  value: unknown,
  purge: boolean,
  authority: AccountDeletionAuthorityClient,
  store: {
    purgeAccount(
      accountId: string,
      profileIds?: readonly string[]
    ): Promise<{ remaining: 0 }>;
    readbackAccount(
      accountId: string,
      profileIds?: readonly string[]
    ): Promise<number>;
  },
  kind:
    | 'oauth-callback-state'
    | 'socket-sessions'
    | 'permission-caches'
    | 'gateway-runtime'
) {
  if (
    !validateDeletionGrantShape(value) ||
    value.owner !== 'authentication' ||
    value.action !== 'readback'
  )
    throw new ForbiddenException('OAuth deletion capability required');
  try {
    const before = await authority.validate(
      value,
      'authentication',
      'readback'
    );
    if (!before.scope || before.scope.legacyProfileIds.length)
      throw Error('DELETION_SCOPE_REQUIRED');
    if (purge)
      await store.purgeAccount(value.accountId, before.scope.currentProfileIds);
    const remaining = await store.readbackAccount(
      value.accountId,
      before.scope.currentProfileIds
    );
    const after = await authority.validate(value, 'authentication', 'readback');
    if (
      remaining !== 0 ||
      JSON.stringify(before.scope) !== JSON.stringify(after.scope)
    )
      throw Error('OAUTH_DELETION_READBACK');
    return { store: kind, remaining: 0, fenced: true };
  } catch {
    // Never echo a signed capability, stored state, or a Redis error payload.
    throw new ForbiddenException('OAuth cleanup unverified');
  }
}

/** Each declared Gateway process drains its own courtesy-email producer. */
@Controller('internal/account-deletion/runtime')
export class GatewayRuntimeDeletionController {
  private readonly instanceId = randomUUID();
  private readonly authority: AccountDeletionAuthorityClient;
  constructor(
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE) auth: ClientProxy,
    private readonly invitations: CommunityInviteMailer
  ) {
    this.authority = new AccountDeletionAuthorityClient(auth);
  }
  @Post('purge') purge(@Body() value: unknown) {
    return this.execute(value, true);
  }
  @Post('readback') readback(@Body() value: unknown) {
    return this.execute(value, false);
  }
  private async execute(value: unknown, purge: boolean) {
    const result = await executeDeletion(
      value,
      purge,
      this.authority,
      {
        purgeAccount: async (accountId) => {
          await this.invitations.purgeAccount(accountId);
          return { remaining: 0 };
        },
        readbackAccount: async (accountId) =>
          this.invitations.readbackAccount(accountId),
      },
      'gateway-runtime'
    );
    return {
      ...result,
      instanceId: this.instanceId,
      logging: payloadFreeLoggingStatus(),
    };
  }
}

import {
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ChatCommands,
  PresenceCommands,
  ProfileCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { firstValueFrom, timeout } from 'rxjs';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RPC_TIMEOUT_MS = 3000;
const PRESENCE_STATUSES = new Set(['online', 'offline', 'away', 'busy']);

type Binding = { profileId: string; accountId: string };
export type ConversationPresence = { profileId: string; status: string };

const exactKeys = (
  value: unknown,
  keys: string[]
): value is Record<string, unknown> =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');

const canonicalUUID = (value: unknown): value is string =>
  typeof value === 'string' && UUID_PATTERN.test(value);

const forbiddenRpc = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const details = error as Record<string, unknown>;
  return details.status === 403 || details.statusCode === 403;
};

@Injectable()
export class GatewayPresenceAudienceService {
  constructor(
    @Inject(ServiceTokens.CHAT_COLLECTOR_SERVICE)
    private readonly chatClient: ClientProxy,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileClient: ClientProxy,
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy
  ) {}

  async resolveConversationPresence(
    accountId: string,
    selectedProfileId: string,
    conversationId: string,
    targetProfileIds: string[]
  ): Promise<ConversationPresence[]> {
    await this.assertSelectedProfileOwned(accountId, selectedProfileId);
    if (targetProfileIds.length === 0) return [];
    const allowedProfileIds = await this.resolveAudience(
      conversationId,
      selectedProfileId,
      targetProfileIds
    );
    const bindings = await this.resolveAccountBindings(allowedProfileIds);
    const result = await this.resolvePresence(selectedProfileId, bindings);
    return result;
  }

  private async assertSelectedProfileOwned(
    accountId: string,
    profileId: string
  ): Promise<void> {
    let reply: unknown;
    try {
      reply = await firstValueFrom(
        this.profileClient
          .send(
            { cmd: ProfileCommands.CheckAccountProfileOwnership },
            { accountId, profileId }
          )
          .pipe(timeout({ first: RPC_TIMEOUT_MS }))
      );
    } catch {
      throw new ServiceUnavailableException(
        'Presence ownership could not be verified.'
      );
    }
    if (
      !exactKeys(reply, ['accountId', 'profileId', 'owned']) ||
      reply.accountId !== accountId ||
      reply.profileId !== profileId ||
      typeof reply.owned !== 'boolean'
    ) {
      throw new ServiceUnavailableException(
        'Presence ownership response was invalid.'
      );
    }
    if (reply.owned !== true) {
      throw new ForbiddenException('Selected profile is not owned by account.');
    }
  }

  private async resolveAudience(
    conversationId: string,
    requestingProfileId: string,
    targetProfileIds: string[]
  ): Promise<string[]> {
    let reply: unknown;
    try {
      reply = await firstValueFrom(
        this.chatClient
          .send(
            { cmd: ChatCommands.GET_PRESENCE_AUDIENCE },
            { conversationId, requestingProfileId, targetProfileIds }
          )
          .pipe(timeout({ first: RPC_TIMEOUT_MS }))
      );
    } catch (error) {
      if (forbiddenRpc(error)) {
        throw new ForbiddenException('Conversation presence is not available.');
      }
      throw new ServiceUnavailableException(
        'Conversation audience could not be verified.'
      );
    }
    if (
      !exactKeys(reply, [
        'conversationId',
        'requestingProfileId',
        'allowedProfileIds',
      ]) ||
      reply.conversationId !== conversationId ||
      reply.requestingProfileId !== requestingProfileId ||
      !Array.isArray(reply.allowedProfileIds) ||
      !reply.allowedProfileIds.every(canonicalUUID)
    ) {
      throw new ServiceUnavailableException(
        'Conversation audience response was invalid.'
      );
    }
    const allowed = reply.allowedProfileIds.map((id) => id.toLowerCase());
    if (
      reply.allowedProfileIds.some((id) => id !== id.toLowerCase()) ||
      new Set(allowed).size !== allowed.length ||
      allowed.length !== targetProfileIds.length ||
      targetProfileIds.some((id) => !allowed.includes(id))
    ) {
      throw new ForbiddenException('Conversation presence is not available.');
    }
    return allowed;
  }

  private async resolveAccountBindings(
    profileIds: string[]
  ): Promise<Binding[]> {
    let reply: unknown;
    try {
      reply = await firstValueFrom(
        this.profileClient
          .send({ cmd: ProfileCommands.ResolveAccountBindings }, { profileIds })
          .pipe(timeout({ first: RPC_TIMEOUT_MS }))
      );
    } catch {
      throw new ServiceUnavailableException(
        'Presence account bindings could not be resolved.'
      );
    }
    if (
      !exactKeys(reply, ['profileIds', 'bindings']) ||
      !Array.isArray(reply.profileIds) ||
      !reply.profileIds.every(canonicalUUID) ||
      !Array.isArray(reply.bindings)
    ) {
      throw new ServiceUnavailableException(
        'Presence account binding response was invalid.'
      );
    }
    const echo = reply.profileIds.map((id) => id.toLowerCase());
    if (
      reply.profileIds.some((id) => id !== id.toLowerCase()) ||
      new Set(echo).size !== echo.length ||
      echo.length !== profileIds.length ||
      profileIds.some((id) => !echo.includes(id))
    ) {
      throw new ServiceUnavailableException(
        'Presence account binding scope was invalid.'
      );
    }
    const bindings: Binding[] = [];
    const seen = new Set<string>();
    for (const candidate of reply.bindings) {
      if (
        !exactKeys(candidate, ['profileId', 'accountId']) ||
        !canonicalUUID(candidate.profileId) ||
        !canonicalUUID(candidate.accountId)
      ) {
        throw new ServiceUnavailableException(
          'Presence account binding response was invalid.'
        );
      }
      const profileId = candidate.profileId.toLowerCase();
      if (
        candidate.profileId !== profileId ||
        candidate.accountId !== candidate.accountId.toLowerCase() ||
        !profileIds.includes(profileId) ||
        seen.has(profileId)
      ) {
        throw new ServiceUnavailableException(
          'Presence account binding scope was invalid.'
        );
      }
      seen.add(profileId);
      bindings.push({
        profileId,
        accountId: candidate.accountId.toLowerCase(),
      });
    }
    return bindings;
  }

  private async resolvePresence(
    actorProfileId: string,
    bindings: Binding[]
  ): Promise<ConversationPresence[]> {
    let reply: unknown;
    try {
      reply = await firstValueFrom(
        this.socialClient
          .send(
            { cmd: PresenceCommands.GET_CONVERSATION_PRESENCE },
            { actorProfileId, bindings }
          )
          .pipe(timeout({ first: RPC_TIMEOUT_MS }))
      );
    } catch {
      throw new ServiceUnavailableException(
        'Conversation presence could not be loaded.'
      );
    }
    if (!Array.isArray(reply)) {
      throw new ServiceUnavailableException(
        'Conversation presence response was invalid.'
      );
    }
    const allowed = new Set(bindings.map((binding) => binding.profileId));
    const seen = new Set<string>();
    const presence: ConversationPresence[] = [];
    for (const candidate of reply) {
      if (
        !exactKeys(candidate, ['profileId', 'status']) ||
        !canonicalUUID(candidate.profileId) ||
        typeof candidate.status !== 'string' ||
        !PRESENCE_STATUSES.has(candidate.status)
      ) {
        throw new ServiceUnavailableException(
          'Conversation presence response was invalid.'
        );
      }
      const profileId = candidate.profileId.toLowerCase();
      if (
        candidate.profileId !== profileId ||
        !allowed.has(profileId) ||
        seen.has(profileId)
      ) {
        throw new ServiceUnavailableException(
          'Conversation presence response scope was invalid.'
        );
      }
      seen.add(profileId);
      presence.push({ profileId, status: candidate.status });
    }
    return presence;
  }
}

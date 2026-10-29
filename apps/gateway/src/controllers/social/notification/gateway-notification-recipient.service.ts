import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ProfileCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { firstValueFrom, timeout } from 'rxjs';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validId = (value: unknown): value is string =>
  typeof value === 'string' && UUID_PATTERN.test(value);
const canonicalId = (value: string) => value.toLowerCase();
const exactOwnershipReply = (
  value: unknown
): value is { accountId: string; profileId: string; owned: boolean } =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype &&
  Object.keys(value).sort().join(',') === 'accountId,owned,profileId' &&
  typeof (value as any).accountId === 'string' &&
  typeof (value as any).profileId === 'string' &&
  typeof (value as any).owned === 'boolean';

@Injectable()
export class GatewayNotificationRecipientService {
  constructor(
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileClient: ClientProxy
  ) {}

  async assertSelected(
    user: { userId?: string; profileId?: string } | null | undefined,
    requestedProfileId?: string
  ): Promise<string> {
    if (!validId(user?.userId) || !validId(user?.profileId)) {
      throw new UnauthorizedException(
        'Authenticated account and profile are required.'
      );
    }
    const accountId = canonicalId(user.userId);
    const profileId = canonicalId(user.profileId);
    if (requestedProfileId !== undefined) {
      if (!validId(requestedProfileId)) {
        throw new BadRequestException('Profile id must be a UUID.');
      }
      if (canonicalId(requestedProfileId) !== profileId) {
        throw new ForbiddenException(
          'Cannot access another profile notification stream.'
        );
      }
    }
    try {
      const reply: unknown = await firstValueFrom(
        this.profileClient
          .send(
            { cmd: ProfileCommands.CheckAccountProfileOwnership },
            { accountId, profileId }
          )
          .pipe(timeout({ first: 3000 }))
      );
      if (
        !exactOwnershipReply(reply) ||
        reply.accountId !== accountId ||
        reply.profileId !== profileId
      ) {
        throw new ServiceUnavailableException(
          'Notification ownership response was invalid.'
        );
      }
      if (reply.owned !== true) {
        throw new ForbiddenException(
          'Selected profile is not owned by account.'
        );
      }
      return profileId;
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException ||
        error instanceof ServiceUnavailableException
      )
        throw error;
      throw new ServiceUnavailableException(
        'Notification ownership could not be verified.'
      );
    }
  }
}

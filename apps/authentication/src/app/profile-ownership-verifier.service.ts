import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import {
  AccountProfileOwnershipRequest,
  AccountProfileOwnershipResult,
  ProfileCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { firstValueFrom, timeout } from 'rxjs';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OWNERSHIP_ERROR = {
  code: 'SELECTED_PROFILE_OWNERSHIP_UNVERIFIED',
};

function canonicalUuid(value: unknown): string | undefined {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    return undefined;
  }
  return value.toLowerCase();
}

function isOwnershipResult(
  value: unknown
): value is AccountProfileOwnershipResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Object.keys(value).sort();
  return (
    keys.length === 3 &&
    keys[0] === 'accountId' &&
    keys[1] === 'owned' &&
    keys[2] === 'profileId'
  );
}

@Injectable()
export class ProfileOwnershipVerifier {
  constructor(
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileService: ClientProxy
  ) {}

  async resolveSelection(
    accountId: string,
    selectedProfile: unknown
  ): Promise<string | undefined> {
    if (
      selectedProfile === undefined ||
      selectedProfile === null ||
      selectedProfile === ''
    ) {
      return undefined;
    }

    const canonicalAccountId = canonicalUuid(accountId);
    const canonicalProfileId = canonicalUuid(selectedProfile);
    if (!canonicalAccountId || !canonicalProfileId) {
      throw new RpcException(OWNERSHIP_ERROR);
    }

    const request: AccountProfileOwnershipRequest = {
      accountId: canonicalAccountId,
      profileId: canonicalProfileId,
    };

    try {
      const response: unknown = await firstValueFrom(
        this.profileService
          .send<AccountProfileOwnershipResult, AccountProfileOwnershipRequest>(
            { cmd: ProfileCommands.CheckAccountProfileOwnership },
            request
          )
          .pipe(timeout({ first: 3_000 }))
      );

      if (
        isOwnershipResult(response) &&
        response.accountId === canonicalAccountId &&
        response.profileId === canonicalProfileId &&
        response.owned === true
      ) {
        return canonicalProfileId;
      }
    } catch {
      // RPC failures are intentionally reduced to a stable, credential-free error.
    }

    throw new RpcException(OWNERSHIP_ERROR);
  }
}

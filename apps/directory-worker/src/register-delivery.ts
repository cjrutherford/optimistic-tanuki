import type { DirectoryGeographyCurrent } from '../../../libs/social/contracts/src/lib/community';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { CommunityCommands } from '../../../libs/social/contracts/src/lib/social-commands';
import {
  RegisterIdentity,
  RegisterRead,
} from '../../directory/src/register-reconciliation';
import { SocialCommunitySnapshot } from '../../directory/src/social-eligibility';

export interface RegisterToken {
  communityId: string;
  changeToken: string;
  operation: 'changed' | 'deleted';
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const valid = (v: unknown): v is string =>
  typeof v === 'string' && uuid.test(v);

/** Separate credentials from the legacy delivery/ACK authority. */
export class RegisterDelivery {
  private readonly client: ClientProxy;
  constructor(host: string, port: number, private readonly secret: string) {
    if (Buffer.byteLength(secret) < 32)
      throw new Error('DIRECTORY_REGISTER_READ_SECRET is required');
    this.client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host, port },
    });
  }
  private request<T>(cmd: string, data: object): Promise<T> {
    return firstValueFrom(
      this.client
        .send<T>({ cmd }, { ...data, secret: this.secret })
        .pipe(timeout(5000))
    );
  }
  scan(
    sourceEpoch: string,
    afterCommunityId: string | null,
    limit: number
  ): Promise<RegisterToken[]> {
    if (
      !valid(sourceEpoch) ||
      (afterCommunityId !== null && !valid(afterCommunityId)) ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 200
    )
      throw new Error('Invalid register scan');
    return this.request(CommunityCommands.DIRECTORY_REGISTER_SCAN, {
      sourceEpoch,
      afterCommunityId,
      limit,
    });
  }
  read(identity: RegisterIdentity): Promise<RegisterRead> {
    if (
      ![identity.sourceEpoch, identity.communityId, identity.changeToken].every(
        valid
      )
    )
      throw new Error('Invalid register read');
    return this.request(CommunityCommands.DIRECTORY_REGISTER_READ, {
      sourceEpoch: identity.sourceEpoch,
      communityId: identity.communityId,
      changeToken: identity.changeToken,
    });
  }
  close(): void {
    this.client.close();
  }
}

/** One bounded page; callers restart at null after the end or on failure. */
export async function registerPage(
  source: Pick<RegisterDelivery, 'scan'>,
  sourceEpoch: string,
  after: string | null,
  limit: number,
  apply: (token: RegisterToken) => Promise<unknown>
): Promise<string | null> {
  if (
    !valid(sourceEpoch) ||
    (after !== null && !valid(after)) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 200
  )
    throw new Error('Invalid register scan');
  const rows = await source.scan(sourceEpoch, after, limit);
  if (!Array.isArray(rows) || rows.length > limit)
    throw new Error('Invalid register page');
  let cursor = after;
  for (const row of rows) {
    if (
      !row ||
      !valid(row.communityId) ||
      !valid(row.changeToken) ||
      (row.operation !== 'changed' && row.operation !== 'deleted') ||
      (cursor !== null && row.communityId <= cursor)
    )
      throw new Error('Invalid register page');
    cursor = row.communityId;
  }
  for (const row of rows) await apply(row);
  return rows.length === limit ? cursor : null;
}

/** Source incarnation is validated by Social; consumer authority is checked separately in Directory. */
export type RegisterSourceIdentity = {
  sourceEpoch: string;
  activationId: string;
  socialGeneration: string;
};
export type CurrentRegisterRead =
  | { status: 'absent' }
  | {
      status: 'current';
      changeToken: string;
      snapshot: SocialCommunitySnapshot | null;
    };
function sourceIdentity(
  identity: RegisterSourceIdentity
): RegisterSourceIdentity {
  if (
    !identity ||
    !valid(identity.sourceEpoch) ||
    !valid(identity.activationId) ||
    typeof identity.socialGeneration !== 'string' ||
    !/^[1-9][0-9]*$/.test(identity.socialGeneration) ||
    BigInt(identity.socialGeneration) > 9223372036854775807n
  )
    throw new Error('Invalid Social source incarnation');
  return {
    sourceEpoch: identity.sourceEpoch,
    activationId: identity.activationId,
    socialGeneration: identity.socialGeneration,
  };
}

/** Incarnation-bound RPC client; does not confer Directory serving or cleanup authority. */
export class RegisterDeliveryV2 {
  private readonly client: ClientProxy;
  constructor(
    host: string,
    port: number,
    private readonly secret: string,
    private readonly repairSecret?: string
  ) {
    if (
      !host ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535 ||
      typeof secret !== 'string' ||
      Buffer.byteLength(secret) < 32
    )
      throw new Error('Invalid register read configuration');
    if (
      repairSecret !== undefined &&
      (typeof repairSecret !== 'string' ||
        Buffer.byteLength(repairSecret) < 32 ||
        repairSecret === secret)
    )
      throw new Error('Invalid register repair configuration');
    this.client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host, port },
    });
  }
  private request<T>(
    cmd: string,
    data: object,
    secret = this.secret
  ): Promise<T> {
    return firstValueFrom(
      this.client.send<T>({ cmd }, { ...data, secret }).pipe(timeout(5000))
    );
  }
  scan(
    identity: RegisterSourceIdentity,
    afterCommunityId: string | null,
    limit: number
  ): Promise<RegisterToken[]> {
    if (
      (afterCommunityId !== null && !valid(afterCommunityId)) ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 200
    )
      throw new Error('Invalid register scan');
    return this.request(CommunityCommands.DIRECTORY_REGISTER_SCAN_V2, {
      identity: sourceIdentity(identity),
      afterCommunityId,
      limit,
    });
  }
  read(
    identity: RegisterSourceIdentity,
    communityId: string,
    changeToken: string
  ): Promise<RegisterRead> {
    if (!valid(communityId) || !valid(changeToken))
      throw new Error('Invalid register read');
    return this.request(CommunityCommands.DIRECTORY_REGISTER_READ_V2, {
      identity: sourceIdentity(identity),
      communityId,
      changeToken,
    });
  }
  current(
    identity: RegisterSourceIdentity,
    communityId: string
  ): Promise<CurrentRegisterRead> {
    if (!valid(communityId)) throw new Error('Invalid register read');
    return this.request(CommunityCommands.DIRECTORY_REGISTER_CURRENT_V2, {
      identity: sourceIdentity(identity),
      communityId,
    });
  }
  geography(
    identity: RegisterSourceIdentity,
    communityId: string
  ): Promise<DirectoryGeographyCurrent> {
    if (!valid(communityId)) throw new Error('Invalid geography read');
    return this.request(CommunityCommands.DIRECTORY_GEOGRAPHY_CURRENT_V2, {
      identity: sourceIdentity(identity),
      communityId,
    });
  }
  census(
    identity: RegisterSourceIdentity,
    afterCommunityId: string | null,
    limit: number
  ): Promise<string[]> {
    if (
      (afterCommunityId !== null && !valid(afterCommunityId)) ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 200
    )
      throw new Error('Invalid Social census');
    return this.request(CommunityCommands.DIRECTORY_SOURCE_CENSUS_V2, {
      identity: sourceIdentity(identity),
      afterCommunityId,
      limit,
    });
  }
  repair(
    identity: RegisterSourceIdentity,
    communityId: string
  ): Promise<{ status: 'unchanged' | 'repaired' }> {
    if (!this.repairSecret || !valid(communityId))
      throw new Error('Invalid Social repair configuration');
    return this.request(
      CommunityCommands.DIRECTORY_SOURCE_REPAIR_V2,
      { identity: sourceIdentity(identity), communityId },
      this.repairSecret
    );
  }
  close(): void {
    this.client.close();
  }
}

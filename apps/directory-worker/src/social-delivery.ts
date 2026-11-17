import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { CommunityCommands } from '../../../libs/social/contracts/src/lib/social-commands';
import { SocialCommunitySnapshot } from '../../directory/src/social-eligibility';
import { Delivery, DeliverySource } from './onboarding';

function sourceEpoch(value: string): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      value
    )
  )
    throw new Error('Invalid source epoch');
  return value;
}

export class SocialDelivery implements DeliverySource {
  private readonly client: ClientProxy;
  constructor(host: string, port: number, private readonly secret: string) {
    if (!secret) throw new Error('DIRECTORY_SOCIAL_SECRET is required');
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
  async membership(
    revision: string,
    communityId: string,
    expectedSourceEpoch: string,
    expectedEventNonce: string
  ): Promise<
    | { status: 'absent' }
    | {
        status: 'pending';
        sourceEpoch: string;
        eventNonce: string;
        snapshot: SocialCommunitySnapshot | null;
      }
  > {
    return this.request(CommunityCommands.DIRECTORY_MEMBERSHIP, {
      revision,
      communityId,
      expectedSourceEpoch: sourceEpoch(expectedSourceEpoch),
      expectedEventNonce: sourceEpoch(expectedEventNonce),
    });
  }
  unread(after?: string): Promise<Delivery[]> {
    return this.request(CommunityCommands.DIRECTORY_UNREAD, { after });
  }
  async snapshot(
    id: string,
    expectedSourceEpoch: string
  ): Promise<SocialCommunitySnapshot | null> {
    return this.request(CommunityCommands.FIND_DIRECTORY_SNAPSHOT, {
      id,
      expectedSourceEpoch: sourceEpoch(expectedSourceEpoch),
    });
  }
  async census(
    cursor: string | undefined,
    expectedSourceEpoch: string
  ): Promise<{
    communities: Array<{ id: string }>;
    nextCursor: string | null;
  }> {
    return this.request(CommunityCommands.FIND_DIRECTORY_CENSUS, {
      cursor,
      limit: 100,
      expectedSourceEpoch: sourceEpoch(expectedSourceEpoch),
    });
  }
  acknowledge(
    identity: {
      revision: string;
      communityId: string;
      eventNonce: string;
      sourceEpoch: string;
      recoveryEpoch: string;
    },
    attestation: string
  ): Promise<{ acknowledged: boolean; result: 'deleted' | 'already-absent' }> {
    return this.request(CommunityCommands.DIRECTORY_ACK, {
      ...identity,
      attestation,
    });
  }
  close(): void {
    this.client.close();
  }
}

export function requireAcknowledgedReceipt(
  ack: { acknowledged?: boolean; result?: string } | null | undefined
): void {
  if (
    !ack ||
    ack.acknowledged !== true ||
    (ack.result !== 'deleted' && ack.result !== 'already-absent')
  ) {
    throw new Error('Social did not acknowledge receipt');
  }
}

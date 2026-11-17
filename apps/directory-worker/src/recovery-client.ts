import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { CommunityCommands } from '../../../libs/social/contracts/src/lib/social-commands';
import { SocialCommunitySnapshot } from '../../directory/src/social-eligibility';

/** Dedicated recovery credential; this client exposes no delivery or ACK operations. */
export class RecoveryClient {
  private readonly client: ClientProxy;
  constructor(host: string, port: number, private readonly secret: string) {
    if (Buffer.byteLength(secret || '', 'utf8') < 32) throw Error('DIRECTORY_RECOVERY_READ_SECRET must contain at least 32 bytes');
    this.client = ClientProxyFactory.create({ transport: Transport.TCP, options: { host, port } });
  }
  census(cursor: string | undefined, expectedSourceEpoch: string): Promise<{ communities: Array<{id: string}>; nextCursor: string | null }> {
    return firstValueFrom(this.client.send<{ communities: Array<{id: string}>; nextCursor: string | null }>({cmd: CommunityCommands.RECOVERY_DIRECTORY_CENSUS}, {cursor, expectedSourceEpoch, limit: 100, secret: this.secret}).pipe(timeout(5000)));
  }
  snapshot(id: string, expectedSourceEpoch: string): Promise<SocialCommunitySnapshot | null> {
    return firstValueFrom(this.client.send<SocialCommunitySnapshot | null>({cmd: CommunityCommands.RECOVERY_DIRECTORY_SNAPSHOT}, {id, expectedSourceEpoch, secret: this.secret}).pipe(timeout(5000)));
  }
  close(): void { this.client.close(); }
}

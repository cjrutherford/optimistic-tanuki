import type { ClientProxy } from '@nestjs/microservices';
import { CommunityCommands } from '@optimistic-tanuki/social-contracts';
import { firstValueFrom, timeout } from 'rxjs';
import type { SocialCommunity } from './community-to-locality';

export const DEFAULT_SOCIAL_TIMEOUT_MS = 30_000;
/** Towne Square's communities are seeded under this appScope. */
export const DEFAULT_LOCALITY_APP_SCOPE = 'local-hub';

/** Social's address, from the environment (SOCIAL_HOST, SOCIAL_PORT). */
export function socialEndpoint(
  env: Record<string, string | undefined> = process.env
): { host: string; port: number } {
  const port = Number(env['SOCIAL_PORT']);
  return {
    host: env['SOCIAL_HOST'] || 'social',
    port: Number.isInteger(port) && port > 0 ? port : 3003,
  };
}

/** The seam the sync reads communities through; tests hand it a fake. */
export interface LocalityCommunitySource {
  listLocalityCommunities(): Promise<SocialCommunity[]>;
}

/**
 * Reads social's locality communities over TCP. One call with an appScope
 * and no localityType returns every seeded city, town, neighborhood, county
 * and region. A failure or timeout rejects; a reply that is not a list
 * (or `{ data: [...] }`) rejects too, so a bad reply never looks like "no
 * communities".
 */
export class SocialLocalityClient implements LocalityCommunitySource {
  constructor(
    private readonly proxy: Pick<ClientProxy, 'send'>,
    private readonly appScope: string = DEFAULT_LOCALITY_APP_SCOPE,
    private readonly timeoutMs: number = DEFAULT_SOCIAL_TIMEOUT_MS
  ) {}

  async listLocalityCommunities(): Promise<SocialCommunity[]> {
    const reply: unknown = await firstValueFrom(
      this.proxy
        .send(
          { cmd: CommunityCommands.LIST_LOCALITY },
          { appScope: this.appScope }
        )
        .pipe(timeout(this.timeoutMs))
    );
    const list = Array.isArray(reply)
      ? reply
      : Array.isArray((reply as { data?: unknown } | null)?.data)
      ? (reply as { data: unknown[] }).data
      : undefined;
    if (!list) throw new Error('social returned a non-list reply');
    return list.filter(
      (item): item is SocialCommunity =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as { id?: unknown }).id === 'string'
    );
  }
}

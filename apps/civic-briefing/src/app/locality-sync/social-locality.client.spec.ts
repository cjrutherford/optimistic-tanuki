import { CommunityCommands } from '@optimistic-tanuki/social-contracts';
import { NEVER, of } from 'rxjs';
import { SocialLocalityClient, socialEndpoint } from './social-locality.client';

describe('SocialLocalityClient', () => {
  it('asks for every community in the app scope, with no type filter', async () => {
    const send = jest.fn(() => of([{ id: 'a' }, { nope: true }]));
    const client = new SocialLocalityClient({ send } as never, 'local-hub', 50);
    expect(await client.listLocalityCommunities()).toEqual([{ id: 'a' }]);
    expect(send).toHaveBeenCalledWith(
      { cmd: CommunityCommands.LIST_LOCALITY },
      { appScope: 'local-hub' }
    );
  });

  it('accepts a { data } envelope and rejects anything else', async () => {
    const ok = new SocialLocalityClient({
      send: () => of({ data: [{ id: 'a' }] }),
    } as never);
    expect(await ok.listLocalityCommunities()).toEqual([{ id: 'a' }]);
    const bad = new SocialLocalityClient({ send: () => of('oops') } as never);
    await expect(bad.listLocalityCommunities()).rejects.toThrow('non-list');
  });

  it('times out', async () => {
    const client = new SocialLocalityClient(
      { send: () => NEVER } as never,
      'x',
      10
    );
    await expect(client.listLocalityCommunities()).rejects.toThrow();
  });

  it('reads the endpoint from the environment, defaulting to social:3003', () => {
    expect(socialEndpoint({})).toEqual({ host: 'social', port: 3003 });
    expect(socialEndpoint({ SOCIAL_HOST: 'h', SOCIAL_PORT: '9' })).toEqual({
      host: 'h',
      port: 9,
    });
  });
});

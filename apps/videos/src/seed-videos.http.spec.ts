import {
  createChannelThroughApi,
  createHttpClient,
  createVideoThroughApi,
  ensureSeedUserSession,
  listChannelsThroughApi,
  listChannelVideosThroughApi,
  listUserChannelsThroughApi,
  SeedRequestOptions,
  SeedUserCredentials,
  subscribeToChannelThroughApi,
  uploadAssetThroughApi,
} from './seed-videos.http';

describe('seed video HTTP helpers', () => {
  let httpClient: {
    get: jest.Mock<Promise<unknown>, [string, SeedRequestOptions?]>;
    post: jest.Mock<Promise<unknown>, [string, unknown, SeedRequestOptions?]>;
  };

  beforeEach(() => {
    httpClient = {
      post: jest.fn(),
      get: jest.fn(),
    };
  });

  it('creates an http client that uses fetch', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'ok' }),
    });
    const originalFetch = global.fetch;
    global.fetch = fetchMock as any;

    const client = createHttpClient('http://gateway:3000/api', {
      'Content-Type': 'application/json',
      'x-ot-appscope': 'video-client',
    });

    await client.post(
      '/videos',
      { title: 'Episode' },
      {
        headers: { Authorization: 'Bearer token-1' },
      },
    );

    expect(fetchMock).toHaveBeenCalledWith('http://gateway:3000/api/videos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ot-appscope': 'video-client',
        Authorization: 'Bearer token-1',
      },
      body: JSON.stringify({ title: 'Episode' }),
    });

    global.fetch = originalFetch;
  });

  it('registers and logs in a seed user through the gateway api', async () => {
    const credentials: SeedUserCredentials = {
      email: 'alice@example.com',
      password: 'TestPassword123!',
      firstName: 'Alice',
      lastName: 'Johnson',
      bio: 'Video seed user',
    };
    const token = createJwt({ userId: 'user-1', profileId: 'profile-1' });
    httpClient.post
      .mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })
      .mockResolvedValueOnce({ data: { newToken: token } });

    const session = await ensureSeedUserSession({
      gatewayUrl: 'http://gateway:3000/api',
      appScope: 'video-client',
      credentials,
      httpClient: httpClient as any,
    });

    expect(httpClient.post).toHaveBeenNthCalledWith(
      1,
      '/authentication/register',
      {
        email: 'alice@example.com',
        fn: 'Alice',
        ln: 'Johnson',
        password: 'TestPassword123!',
        confirm: 'TestPassword123!',
        bio: 'Video seed user',
      },
      {
        headers: {
          'x-ot-appscope': 'video-client',
        },
      },
    );
    expect(httpClient.post).toHaveBeenNthCalledWith(
      2,
      '/authentication/login',
      {
        email: 'alice@example.com',
        password: 'TestPassword123!',
      },
      undefined,
    );
    expect(session).toEqual({
      userId: 'user-1',
      profileId: 'profile-1',
      token,
      httpClient,
    });
  });

  it('uploads assets and creates channels and videos through gateway routes', async () => {
    httpClient.post
      .mockResolvedValueOnce({ id: 'asset-1' })
      .mockResolvedValueOnce({ id: 'channel-1' })
      .mockResolvedValueOnce({ id: 'video-1' });

    const asset = await uploadAssetThroughApi(httpClient as any, 'token-1', {
      name: 'episode.mp4',
      profileId: 'profile-1',
      type: 'video',
      fileExtension: 'mp4',
      contentBase64: 'ZmFrZQ==',
    });

    const channel = await createChannelThroughApi(
      httpClient as any,
      'token-1',
      {
        name: 'Imported TV',
        description:
          'Imported during bootstrap from the local TV media library.',
        userId: 'user-1',
        profileId: 'profile-1',
      },
    );

    const video = await createVideoThroughApi(httpClient as any, 'token-1', {
      title: 'Episode 01',
      description: 'Imported from local library: Imported TV/Episode 01.mp4',
      channelId: 'channel-1',
      assetId: 'asset-1',
      visibility: 'public',
    });

    expect(httpClient.post).toHaveBeenNthCalledWith(
      1,
      '/asset',
      {
        name: 'episode.mp4',
        profileId: 'profile-1',
        type: 'video',
        fileExtension: 'mp4',
        content: 'ZmFrZQ==',
      },
      { headers: { Authorization: 'Bearer token-1' } },
    );
    expect(httpClient.post).toHaveBeenNthCalledWith(
      2,
      '/videos/channels',
      {
        name: 'Imported TV',
        description:
          'Imported during bootstrap from the local TV media library.',
        userId: 'user-1',
        profileId: 'profile-1',
      },
      { headers: { Authorization: 'Bearer token-1' } },
    );
    expect(httpClient.post).toHaveBeenNthCalledWith(
      3,
      '/videos',
      {
        title: 'Episode 01',
        description: 'Imported from local library: Imported TV/Episode 01.mp4',
        channelId: 'channel-1',
        assetId: 'asset-1',
        visibility: 'public',
      },
      { headers: { Authorization: 'Bearer token-1' } },
    );
    expect(asset).toEqual({ id: 'asset-1' });
    expect(channel).toEqual({ id: 'channel-1' });
    expect(video).toEqual({ id: 'video-1' });
  });

  it('lists channels and videos and subscribes through gateway routes', async () => {
    httpClient.get
      .mockResolvedValueOnce([{ id: 'channel-0' }])
      .mockResolvedValueOnce([{ id: 'channel-1', userId: 'user-1' }])
      .mockResolvedValueOnce([{ id: 'video-1', channelId: 'channel-1' }]);
    httpClient.post.mockResolvedValueOnce({ id: 'subscription-1' });

    const allChannels = await listChannelsThroughApi(httpClient as any);
    const channels = await listUserChannelsThroughApi(
      httpClient as any,
      'token-1',
      'user-1',
    );
    const videos = await listChannelVideosThroughApi(
      httpClient as any,
      'channel-1',
    );
    const subscription = await subscribeToChannelThroughApi(
      httpClient as any,
      'token-1',
      {
        channelId: 'channel-1',
        userId: 'user-2',
        profileId: 'profile-2',
      },
    );

    expect(httpClient.get).toHaveBeenNthCalledWith(1, '/videos/channels');
    expect(httpClient.get).toHaveBeenNthCalledWith(
      2,
      '/videos/channels/user/user-1',
      {
        headers: { Authorization: 'Bearer token-1' },
      },
    );
    expect(httpClient.get).toHaveBeenNthCalledWith(
      3,
      '/videos/channel/channel-1',
    );
    expect(httpClient.post).toHaveBeenCalledWith(
      '/videos/subscriptions',
      {
        channelId: 'channel-1',
        userId: 'user-2',
        profileId: 'profile-2',
      },
      { headers: { Authorization: 'Bearer token-1' } },
    );
    expect(allChannels).toEqual([{ id: 'channel-0' }]);
    expect(channels).toEqual([{ id: 'channel-1', userId: 'user-1' }]);
    expect(videos).toEqual([{ id: 'video-1', channelId: 'channel-1' }]);
    expect(subscription).toEqual({ id: 'subscription-1' });
  });
});

function createJwt(payload: Record<string, string>): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');

  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.signature`;
}

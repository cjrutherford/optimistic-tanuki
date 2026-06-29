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
      }
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

  it('redacts large asset content from failed HTTP responses', async () => {
    const largeBase64 = Buffer.alloc(1024, 'x').toString('base64');
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({
        message: 'File validation failed',
        request: {
          content: largeBase64,
          nested: {
            sourcePath: '/mnt/valhalla/media/TV/show.mp4',
          },
        },
      }),
    });
    const originalFetch = global.fetch;
    global.fetch = fetchMock as any;

    const client = createHttpClient('http://gateway:3000/api', {
      'Content-Type': 'application/json',
    });

    await expect(
      client.post('/asset', {
        name: 'show.mp4',
        content: largeBase64,
      })
    ).rejects.toMatchObject({
      message: 'File validation failed',
      status: 400,
      data: {
        message: 'File validation failed',
        request: {
          content: '[redacted base64 content]',
          nested: {
            sourcePath: '/mnt/valhalla/media/TV/show.mp4',
          },
        },
      },
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
      }
    );
    expect(httpClient.post).toHaveBeenNthCalledWith(
      2,
      '/authentication/login',
      {
        email: 'alice@example.com',
        password: 'TestPassword123!',
      }
    );
    expect(session).toEqual({
      userId: 'user-1',
      profileId: 'profile-1',
      token,
      httpClient,
    });
  });

  it('uploads assets and creates channels and videos through gateway routes', async () => {
    const assetId = '11111111-1111-4111-8111-111111111111';
    const channelId = '22222222-2222-4222-8222-222222222222';
    const videoId = '33333333-3333-4333-8333-333333333333';

    httpClient.post
      .mockResolvedValueOnce({ id: assetId })
      .mockResolvedValueOnce({ id: channelId })
      .mockResolvedValueOnce({ id: videoId });

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
        anchorLat: 32.0809,
        anchorLng: -81.0912,
      }
    );

    const video = await createVideoThroughApi(httpClient as any, 'token-1', {
      title: 'Episode 01',
      description: 'Imported from local library: Imported TV/Episode 01.mp4',
      channelId,
      assetId,
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
      { headers: { Authorization: 'Bearer token-1' } }
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
        anchorLat: 32.0809,
        anchorLng: -81.0912,
      },
      { headers: { Authorization: 'Bearer token-1' } }
    );
    expect(httpClient.post).toHaveBeenNthCalledWith(
      3,
      '/videos',
      {
        title: 'Episode 01',
        description: 'Imported from local library: Imported TV/Episode 01.mp4',
        channelId,
        assetId,
        visibility: 'public',
      },
      { headers: { Authorization: 'Bearer token-1' } }
    );
    expect(asset).toEqual({ id: assetId });
    expect(channel).toEqual({ id: channelId });
    expect(video).toEqual({ id: videoId });
  });

  it('rejects asset uploads that do not return a UUID id', async () => {
    httpClient.post.mockResolvedValueOnce({ id: 'asset-1' });

    await expect(
      uploadAssetThroughApi(httpClient as any, 'token-1', {
        name: 'episode.mp4',
        profileId: 'profile-1',
        type: 'video',
        fileExtension: 'mp4',
        contentBase64: 'ZmFrZQ==',
      })
    ).rejects.toThrow('Asset upload did not return a valid UUID id');
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
      'user-1'
    );
    const videos = await listChannelVideosThroughApi(
      httpClient as any,
      'channel-1'
    );
    const subscription = await subscribeToChannelThroughApi(
      httpClient as any,
      'token-1',
      {
        channelId: 'channel-1',
        userId: 'user-2',
        profileId: 'profile-2',
      }
    );

    expect(httpClient.get).toHaveBeenNthCalledWith(1, '/videos/channels');
    expect(httpClient.get).toHaveBeenNthCalledWith(
      2,
      '/videos/channels/user/user-1',
      {
        headers: { Authorization: 'Bearer token-1' },
      }
    );
    expect(httpClient.get).toHaveBeenNthCalledWith(
      3,
      '/videos/channel/channel-1'
    );
    expect(httpClient.post).toHaveBeenCalledWith(
      '/videos/subscriptions',
      {
        channelId: 'channel-1',
        userId: 'user-2',
        profileId: 'profile-2',
      },
      { headers: { Authorization: 'Bearer token-1' } }
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

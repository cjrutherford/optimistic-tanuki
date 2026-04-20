export type SeedHttpClient = {
  get: (path: string, options?: SeedRequestOptions) => Promise<unknown>;
  post: (
    path: string,
    body: unknown,
    options?: SeedRequestOptions,
  ) => Promise<unknown>;
};

export type SeedRequestOptions = {
  headers?: Record<string, string>;
};

export type SeedUserCredentials = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  bio: string;
};

export type SeedUserSession = {
  userId: string;
  profileId: string;
  token: string;
  httpClient: SeedHttpClient;
};

export type SeedChannel = {
  id: string;
  name: string;
  profileId: string;
  userId: string;
  createdAt?: string;
};

export type SeedVideo = {
  id: string;
  title: string;
  channelId: string;
  createdAt?: string;
};

type UploadAssetInput = {
  name: string;
  profileId: string;
  type: 'video' | 'image' | 'audio' | 'document';
  fileExtension: string;
  contentBase64?: string;
  sourcePath?: string;
};

type CreateChannelInput = {
  name: string;
  description: string;
  userId: string;
  profileId: string;
};

type CreateVideoInput = {
  title: string;
  description: string;
  channelId: string;
  assetId: string;
  visibility: 'public' | 'private' | 'unlisted';
  thumbnailAssetId?: string;
};

export async function ensureSeedUserSession(params: {
  gatewayUrl: string;
  appScope: string;
  credentials: SeedUserCredentials;
  httpClient?: SeedHttpClient;
}): Promise<SeedUserSession> {
  const { gatewayUrl, appScope, credentials } = params;
  const httpClient =
    params.httpClient ||
    createHttpClient(gatewayUrl, {
      'Content-Type': 'application/json',
      'x-ot-appscope': appScope,
    });

  let userId: string | undefined;

  try {
    const registerResponse = unwrapResponse<{ user?: { id?: string } }>(
      await httpClient.post(
        '/authentication/register',
        {
          email: credentials.email,
          fn: credentials.firstName,
          ln: credentials.lastName,
          password: credentials.password,
          confirm: credentials.password,
          bio: credentials.bio,
        },
        {
          headers: { 'x-ot-appscope': appScope },
        },
      ),
    );

    userId = registerResponse.user?.id;
  } catch (error: any) {
    if (
      error?.status !== 409 &&
      !String(error?.message).includes('already exists')
    ) {
      throw error;
    }
  }

  const loginResponse = unwrapResponse<{ newToken?: string; token?: string }>(
    await httpClient.post('/authentication/login', {
      email: credentials.email,
      password: credentials.password,
    }),
  );
  const token = loginResponse.newToken || loginResponse.token;

  if (!token) {
    throw new Error(`Login did not return a token for ${credentials.email}`);
  }

  const tokenPayload = decodeJwtPayload(token);
  userId = userId || tokenPayload.userId;

  if (!userId) {
    throw new Error(`Could not resolve user ID for ${credentials.email}`);
  }

  if (!tokenPayload.profileId) {
    throw new Error(`Could not resolve profile for ${credentials.email}`);
  }

  return {
    userId,
    profileId: tokenPayload.profileId,
    token,
    httpClient,
  };
}

export async function uploadAssetThroughApi(
  httpClient: SeedHttpClient,
  token: string,
  input: UploadAssetInput,
): Promise<{ id: string }> {
  return unwrapResponse<{ id: string }>(
    await httpClient.post(
      '/asset',
      {
        name: input.name,
        profileId: input.profileId,
        type: input.type,
        fileExtension: input.fileExtension,
        ...(input.contentBase64 ? { content: input.contentBase64 } : {}),
        ...(input.sourcePath ? { sourcePath: input.sourcePath } : {}),
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    ),
  );
}

export async function createChannelThroughApi(
  httpClient: SeedHttpClient,
  token: string,
  input: CreateChannelInput,
): Promise<{ id: string }> {
  return unwrapResponse<{ id: string }>(
    await httpClient.post('/videos/channels', input, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
}

export async function createVideoThroughApi(
  httpClient: SeedHttpClient,
  token: string,
  input: CreateVideoInput,
): Promise<{ id: string }> {
  return unwrapResponse<{ id: string }>(
    await httpClient.post('/videos', input, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
}

export async function listUserChannelsThroughApi(
  httpClient: SeedHttpClient,
  token: string,
  userId: string,
): Promise<SeedChannel[]> {
  return unwrapArrayResponse<SeedChannel>(
    await httpClient.get(`/videos/channels/user/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
}

export async function listChannelsThroughApi(
  httpClient: SeedHttpClient,
): Promise<SeedChannel[]> {
  return unwrapArrayResponse<SeedChannel>(
    await httpClient.get('/videos/channels'),
  );
}

export async function listChannelVideosThroughApi(
  httpClient: SeedHttpClient,
  channelId: string,
): Promise<SeedVideo[]> {
  return unwrapArrayResponse<SeedVideo>(
    await httpClient.get(`/videos/channel/${channelId}`),
  );
}

export async function subscribeToChannelThroughApi(
  httpClient: SeedHttpClient,
  token: string,
  input: {
    channelId: string;
    userId: string;
    profileId: string;
  },
): Promise<{ id?: string }> {
  return unwrapResponse<{ id?: string }>(
    await httpClient.post('/videos/subscriptions', input, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
}

export function createHttpClient(
  baseUrl: string,
  defaultHeaders: Record<string, string>,
): SeedHttpClient {
  return {
    get: (path, options) =>
      request('GET', baseUrl, path, undefined, defaultHeaders, options),
    post: (path, body, options) =>
      request('POST', baseUrl, path, body, defaultHeaders, options),
  };
}

async function request(
  method: 'GET' | 'POST',
  baseUrl: string,
  path: string,
  body: unknown,
  defaultHeaders: Record<string, string>,
  options?: SeedRequestOptions,
): Promise<unknown> {
  const response = await fetch(`${trimTrailingSlash(baseUrl)}${path}`, {
    method,
    headers: {
      ...defaultHeaders,
      ...(options?.headers || {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && 'message' in data
        ? (data as { message?: unknown }).message
        : undefined) || response.statusText;
    const error = new Error(
      String(message || 'HTTP request failed'),
    ) as Error & {
      status?: number;
      data?: unknown;
    };
    error.status = response.status;
    error.data = redactLargePayloads(data);
    throw error;
  }

  return data;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function redactLargePayloads(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactLargePayloads(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const redacted: Record<string, unknown> = {};

  for (const [key, childValue] of Object.entries(value)) {
    if (shouldRedactPayloadField(key, childValue)) {
      redacted[key] = '[redacted base64 content]';
      continue;
    }

    redacted[key] = redactLargePayloads(childValue);
  }

  return redacted;
}

function shouldRedactPayloadField(key: string, value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const normalizedKey = key.toLowerCase();
  return (
    (normalizedKey === 'content' || normalizedKey === 'contentbase64') &&
    value.length > 256
  );
}

function decodeJwtPayload(token: string): {
  userId?: string;
  profileId?: string;
} {
  try {
    const [, payloadSegment] = token.split('.');
    if (!payloadSegment) {
      return {};
    }

    const payload = JSON.parse(
      Buffer.from(payloadSegment, 'base64url').toString('utf8'),
    ) as Record<string, unknown>;

    const userId = payload['userId'];
    const profileId = payload['profileId'];

    return {
      userId: typeof userId === 'string' ? userId : undefined,
      profileId: typeof profileId === 'string' ? profileId : undefined,
    };
  } catch {
    return {};
  }
}

function unwrapResponse<T>(value: unknown): T {
  if (value && typeof value === 'object' && 'data' in value) {
    return (value as { data: T }).data;
  }

  return value as T;
}

function unwrapArrayResponse<T>(value: unknown): T[] {
  const unwrapped = unwrapResponse<unknown>(value);
  return Array.isArray(unwrapped) ? (unwrapped as T[]) : [];
}

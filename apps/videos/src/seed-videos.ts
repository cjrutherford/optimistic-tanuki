import { Logger } from '@nestjs/common';
import { existsSync } from 'fs';
import { extname } from 'path';

import { VideoVisibility } from '@optimistic-tanuki/models';

import {
  assessVideoImport,
  deriveChannelName,
  deriveVideoTitle,
  discoverSeedVideoFiles,
  getRelativeImportPath,
} from './seed-videos.helpers';
import {
  createChannelThroughApi,
  createVideoThroughApi,
  ensureSeedUserSession,
  listChannelsThroughApi,
  listChannelVideosThroughApi,
  listUserChannelsThroughApi,
  SeedChannel,
  SeedUserCredentials,
  SeedUserSession,
  subscribeToChannelThroughApi,
  uploadAssetThroughApi,
} from './seed-videos.http';

const DEFAULT_VIDEO_SOURCE_DIR =
  process.env.VIDEO_SEED_SOURCE_DIR || '/mnt/valhalla/media/TV';
const DEFAULT_IMPORTED_CHANNEL_DESCRIPTION =
  'Imported during bootstrap from the local TV media library.';
const DEFAULT_VIDEO_SEED_MAX_FILES = 30;
const VIDEO_SEED_MAX_FILES = parseOptionalPositiveInt(
  process.env.VIDEO_SEED_MAX_FILES,
) ?? DEFAULT_VIDEO_SEED_MAX_FILES;
const GATEWAY_URL =
  process.env.GATEWAY_URL || process.env.API_URL || 'http://gateway:3000/api';
const APP_SCOPE = process.env.APP_SCOPE || 'video-client';

const SEED_USERS: SeedUserCredentials[] = [
  {
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Johnson',
    password: 'TestPassword123!',
    bio: 'Software developer and tech enthusiast',
  },
  {
    email: 'bob@example.com',
    firstName: 'Bob',
    lastName: 'Smith',
    password: 'TestPassword123!',
    bio: 'Full-stack developer | Open source contributor',
  },
  {
    email: 'charlie@example.com',
    firstName: 'Charlie',
    lastName: 'Brown',
    password: 'TestPassword123!',
    bio: 'UI/UX Designer passionate about accessibility',
  },
];

type AuthenticatedSeedUser = SeedUserSession & {
  email: string;
};

type SeedVideoRecord = {
  title: string;
  description: string;
  assetId: string;
  visibility: VideoVisibility;
  durationSeconds?: number;
  resolution?: string;
  encoding?: string;
};

async function bootstrap() {
  const logger = new Logger('VideoSeedScript-HTTP');

  logger.log('Seeding video database through gateway HTTP API...');

  const users = await authenticateSeedUsers(logger);

  if (users.length === 0) {
    throw new Error('No seed users could be authenticated for video seeding.');
  }

  const importedCount = await importVideosFromLibrary({ logger, users });

  if (importedCount === 0) {
    await seedFallbackCatalog({ logger, users });
  }

  await ensureSampleSubscriptions({ logger, users });

  logger.log('Video database seeding through HTTP API completed successfully.');
}

async function authenticateSeedUsers(
  logger: Logger,
): Promise<AuthenticatedSeedUser[]> {
  const users: AuthenticatedSeedUser[] = [];

  for (const credentials of SEED_USERS) {
    const session = await ensureSeedUserSession({
      gatewayUrl: GATEWAY_URL,
      appScope: APP_SCOPE,
      credentials,
    });

    users.push({
      ...session,
      email: credentials.email,
    });
    logger.log(
      `Authenticated seed user ${credentials.email} with profile ${session.profileId}.`,
    );
  }

  return users;
}

async function importVideosFromLibrary(params: {
  logger: Logger;
  users: AuthenticatedSeedUser[];
}): Promise<number> {
  const { logger, users } = params;

  if (!existsSync(DEFAULT_VIDEO_SOURCE_DIR)) {
    logger.warn(
      `Video source directory "${DEFAULT_VIDEO_SOURCE_DIR}" does not exist. Falling back to sample catalog.`,
    );
    return 0;
  }

  const filesToImport = await discoverSeedVideoFiles(DEFAULT_VIDEO_SOURCE_DIR, {
    maxFiles: VIDEO_SEED_MAX_FILES,
  });

  if (filesToImport.length === 0) {
    logger.warn(
      `No supported video files found in "${DEFAULT_VIDEO_SOURCE_DIR}". Falling back to sample catalog.`,
    );
    return 0;
  }

  logger.log(
    `Importing ${filesToImport.length} video file(s) from ${DEFAULT_VIDEO_SOURCE_DIR}.`,
  );

  const channelCache = new Map<string, SeedChannel>();
  let createdVideos = 0;
  let skippedVideos = 0;

  for (const [index, filePath] of filesToImport.entries()) {
    const importAssessment = assessVideoImport(filePath, 0);

    if (importAssessment.canImport === false) {
      skippedVideos += 1;
      logger.warn(
        `Skipping ${getRelativeImportPath(DEFAULT_VIDEO_SOURCE_DIR, filePath)}: ${importAssessment.reason}.`,
      );
      continue;
    }

    const owner = users[index % users.length];
    const channelName = deriveChannelName(DEFAULT_VIDEO_SOURCE_DIR, filePath);
    const channel = await ensureChannelThroughApi(
      owner,
      channelName,
      channelCache,
    );
    const existingVideos = await listChannelVideosThroughApi(
      owner.httpClient,
      channel.id,
    );
    const title = deriveVideoTitle(filePath);

    if (existingVideos.some((video) => video.title === title)) {
      logger.log(`Skipping existing imported video "${title}".`);
      continue;
    }

    const asset = await uploadAssetThroughApi(owner.httpClient, owner.token, {
      name: titleWithExtension(filePath),
      profileId: owner.profileId,
      type: 'video',
      fileExtension: extensionWithoutDot(filePath),
      sourcePath: filePath,
    });

    const relativePath = getRelativeImportPath(
      DEFAULT_VIDEO_SOURCE_DIR,
      filePath,
    );
    await createVideoThroughApi(owner.httpClient, owner.token, {
      title,
      description: `Imported from local library: ${relativePath}`,
      channelId: channel.id,
      assetId: asset.id,
      visibility: VideoVisibility.PUBLIC,
    });

    createdVideos += 1;
    logger.log(`Imported video "${title}" from ${relativePath}.`);
  }

  if (skippedVideos > 0) {
    logger.warn(
      `Skipped ${skippedVideos} incompatible video file(s) during import.`,
    );
  }

  return createdVideos;
}

async function seedFallbackCatalog(params: {
  logger: Logger;
  users: AuthenticatedSeedUser[];
}): Promise<void> {
  const { logger, users } = params;
  const channelCache = new Map<string, SeedChannel>();
  const fallbackChannels = [
    {
      name: 'Tech Tutorials',
      description:
        'Learn programming, web development, and software engineering with our comprehensive tutorials.',
      owner: users[0],
    },
    {
      name: 'Cooking Adventures',
      description:
        'Delicious recipes and cooking tips from around the world. Join us on a culinary journey!',
      owner: users[1],
    },
    {
      name: 'Fitness & Health',
      description:
        'Get fit and stay healthy with our workout routines, nutrition advice, and wellness tips.',
      owner: users[2],
    },
  ];

  const createdChannels = await Promise.all(
    fallbackChannels.map((channel) =>
      ensureChannelThroughApi(
        channel.owner,
        channel.name,
        channelCache,
        channel.description,
      ),
    ),
  );

  const videos: Array<SeedVideoRecord & { channelIndex: number }> = [
    {
      channelIndex: 0,
      title: 'Getting Started with NestJS',
      description:
        'Learn the basics of NestJS framework and build your first API.',
      assetId: '00000000-0000-0000-0000-000000000001',
      durationSeconds: 1245,
      resolution: '1920x1080',
      encoding: 'H.264',
      visibility: VideoVisibility.PUBLIC,
    },
    {
      channelIndex: 0,
      title: 'Angular Best Practices 2024',
      description:
        'Discover the best practices for Angular development in 2024.',
      assetId: '00000000-0000-0000-0000-000000000002',
      durationSeconds: 1876,
      resolution: '1920x1080',
      encoding: 'H.264',
      visibility: VideoVisibility.PUBLIC,
    },
    {
      channelIndex: 0,
      title: 'TypeScript Advanced Features',
      description: 'Deep dive into advanced TypeScript features and patterns.',
      assetId: '00000000-0000-0000-0000-000000000003',
      durationSeconds: 2156,
      resolution: '1920x1080',
      encoding: 'H.264',
      visibility: VideoVisibility.PUBLIC,
    },
    {
      channelIndex: 1,
      title: 'Perfect Homemade Pizza',
      description:
        'Learn how to make authentic Italian pizza from scratch at home.',
      assetId: '00000000-0000-0000-0000-000000000004',
      durationSeconds: 945,
      resolution: '1920x1080',
      encoding: 'H.264',
      visibility: VideoVisibility.PUBLIC,
    },
    {
      channelIndex: 1,
      title: 'Thai Green Curry Recipe',
      description: 'A step-by-step guide to making delicious Thai green curry.',
      assetId: '00000000-0000-0000-0000-000000000005',
      durationSeconds: 1123,
      resolution: '1920x1080',
      encoding: 'H.264',
      visibility: VideoVisibility.PUBLIC,
    },
    {
      channelIndex: 2,
      title: '30-Minute Full Body Workout',
      description: 'An effective full-body workout routine you can do at home.',
      assetId: '00000000-0000-0000-0000-000000000006',
      durationSeconds: 1876,
      resolution: '1920x1080',
      encoding: 'H.264',
      visibility: VideoVisibility.PUBLIC,
    },
    {
      channelIndex: 2,
      title: 'Meal Prep for Beginners',
      description: 'Simple and healthy meal prep ideas for busy people.',
      assetId: '00000000-0000-0000-0000-000000000007',
      durationSeconds: 1456,
      resolution: '1920x1080',
      encoding: 'H.264',
      visibility: VideoVisibility.PUBLIC,
    },
  ];

  for (const videoData of videos) {
    const channel = createdChannels[videoData.channelIndex];
    const owner = fallbackChannels[videoData.channelIndex].owner;
    const existingVideos = await listChannelVideosThroughApi(
      owner.httpClient,
      channel.id,
    );

    if (existingVideos.some((video) => video.title === videoData.title)) {
      continue;
    }

    await createVideoThroughApi(owner.httpClient, owner.token, {
      title: videoData.title,
      description: videoData.description,
      channelId: channel.id,
      assetId: videoData.assetId,
      visibility: videoData.visibility,
    });
  }

  logger.log('Seeded fallback sample video catalog through HTTP API.');
}

async function ensureSampleSubscriptions(params: {
  logger: Logger;
  users: AuthenticatedSeedUser[];
}): Promise<void> {
  const { logger, users } = params;
  const channels = await listChannelsThroughApi(users[0].httpClient);

  if (channels.length < 3) {
    logger.warn(
      'Skipping sample subscriptions because fewer than 3 channels exist.',
    );
    return;
  }

  const subscriptions = [
    { channelId: channels[1].id, subscriber: users[0] },
    { channelId: channels[2].id, subscriber: users[0] },
    { channelId: channels[0].id, subscriber: users[1] },
    { channelId: channels[2].id, subscriber: users[1] },
  ];

  for (const subscription of subscriptions) {
    try {
      await subscribeToChannelThroughApi(
        subscription.subscriber.httpClient,
        subscription.subscriber.token,
        {
          channelId: subscription.channelId,
          userId: subscription.subscriber.userId,
          profileId: subscription.subscriber.profileId,
        },
      );
    } catch (error) {
      logger.warn(
        `Could not create subscription: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

async function ensureChannelThroughApi(
  owner: AuthenticatedSeedUser,
  name: string,
  cache: Map<string, SeedChannel>,
  description = DEFAULT_IMPORTED_CHANNEL_DESCRIPTION,
): Promise<SeedChannel> {
  const cacheKey = `${owner.profileId}:${name}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const channels = await listUserChannelsThroughApi(
    owner.httpClient,
    owner.token,
    owner.userId,
  );
  const existing = channels.find(
    (channel) => channel.profileId === owner.profileId && channel.name === name,
  );

  if (existing) {
    cache.set(cacheKey, existing);
    return existing;
  }

  const created = await createChannelThroughApi(owner.httpClient, owner.token, {
    name,
    description,
    profileId: owner.profileId,
    userId: owner.userId,
  });

  const channel: SeedChannel = {
    id: created.id,
    name,
    profileId: owner.profileId,
    userId: owner.userId,
  };
  cache.set(cacheKey, channel);
  return channel;
}

function extensionWithoutDot(filePath: string): string {
  return extname(filePath).replace(/^\./, '').toLowerCase();
}

function titleWithExtension(filePath: string): string {
  return `${deriveVideoTitle(filePath)}.${extensionWithoutDot(filePath)}`;
}

function parseOptionalPositiveInt(
  value: string | undefined,
): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

bootstrap().catch((error) => {
  const logger = new Logger('VideoSeedScript-HTTP');
  logger.error('Error seeding video database through HTTP API:', error);
  process.exitCode = 1;
});

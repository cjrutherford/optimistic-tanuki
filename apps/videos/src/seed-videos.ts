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
  resolveFirstExistingSeedVideoDirectory,
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

const LEGACY_VIDEO_SOURCE_DIR = '/mnt/valhalla/media/TV';
const DEFAULT_VIDEO_SOURCE_DIR = resolveDefaultVideoSourceDir();
const DEFAULT_IMPORTED_CHANNEL_DESCRIPTION =
  'Imported during bootstrap from the local TV media library.';
const DEFAULT_VIDEO_SEED_MAX_FILES = 30;
const VIDEO_SEED_MAX_FILES =
  parseOptionalPositiveInt(process.env.VIDEO_SEED_MAX_FILES) ??
  DEFAULT_VIDEO_SEED_MAX_FILES;
const GATEWAY_URL =
  process.env.GATEWAY_URL || process.env.API_URL || 'http://gateway:3000/api';
const APP_SCOPE = process.env.APP_SCOPE || 'video-client';

const SEED_USERS: SeedUserCredentials[] = [
  {
    email: 'videos.alice@example.com',
    firstName: 'Alice',
    lastName: 'Johnson',
    password: 'TestPassword123!',
    bio: 'Software developer and tech enthusiast',
  },
  {
    email: 'videos.bob@example.com',
    firstName: 'Bob',
    lastName: 'Smith',
    password: 'TestPassword123!',
    bio: 'Full-stack developer | Open source contributor',
  },
  {
    email: 'videos.charlie@example.com',
    firstName: 'Charlie',
    lastName: 'Brown',
    password: 'TestPassword123!',
    bio: 'UI/UX Designer passionate about accessibility',
  },
];

type AuthenticatedSeedUser = SeedUserSession & {
  email: string;
};

async function bootstrap() {
  const logger = new Logger('VideoSeedScript-HTTP');

  logger.log('Seeding video database through gateway HTTP API...');

  const users = await authenticateSeedUsers(logger);

  if (users.length === 0) {
    throw new Error('No seed users could be authenticated for video seeding.');
  }

  await importVideosFromLibrary({ logger, users });

  await ensureSampleSubscriptions({ logger, users });

  logger.log('Video database seeding through HTTP API completed successfully.');
}

async function authenticateSeedUsers(
  logger: Logger
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
      `Authenticated seed user ${credentials.email} with profile ${session.profileId}.`
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
    throw new Error(
      `Video seed source directory "${DEFAULT_VIDEO_SOURCE_DIR}" does not exist. Mount a directory containing supported media before seeding.`
    );
  }

  const filesToImport = await discoverSeedVideoFiles(DEFAULT_VIDEO_SOURCE_DIR, {
    maxFiles: VIDEO_SEED_MAX_FILES,
  });

  if (filesToImport.length === 0) {
    throw new Error(
      `Video seed source directory "${DEFAULT_VIDEO_SOURCE_DIR}" contains no supported media files.`
    );
  }

  logger.log(
    `Importing ${filesToImport.length} video file(s) from ${DEFAULT_VIDEO_SOURCE_DIR}.`
  );

  const channelCache = new Map<string, SeedChannel>();
  let createdVideos = 0;
  let skippedVideos = 0;

  for (const [index, filePath] of filesToImport.entries()) {
    const importAssessment = assessVideoImport(filePath, 0);

    if (importAssessment.canImport === false) {
      skippedVideos += 1;
      logger.warn(
        `Skipping ${getRelativeImportPath(
          DEFAULT_VIDEO_SOURCE_DIR,
          filePath
        )}: ${importAssessment.reason}.`
      );
      continue;
    }

    const owner = users[0];
    const channelName = deriveChannelName(DEFAULT_VIDEO_SOURCE_DIR, filePath);
    const channel = await ensureChannelThroughApi(
      owner,
      channelName,
      channelCache
    );
    const existingVideos = await listChannelVideosThroughApi(
      owner.httpClient,
      channel.id
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
      filePath
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
      `Skipped ${skippedVideos} incompatible video file(s) during import.`
    );
  }

  return createdVideos;
}

async function ensureSampleSubscriptions(params: {
  logger: Logger;
  users: AuthenticatedSeedUser[];
}): Promise<void> {
  const { logger, users } = params;
  const channels = await listChannelsThroughApi(users[0].httpClient);

  if (channels.length < 3) {
    logger.warn(
      'Skipping sample subscriptions because fewer than 3 channels exist.'
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
        }
      );
    } catch (error) {
      logger.warn(
        `Could not create subscription: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

async function ensureChannelThroughApi(
  owner: AuthenticatedSeedUser,
  name: string,
  cache: Map<string, SeedChannel>,
  description = DEFAULT_IMPORTED_CHANNEL_DESCRIPTION
): Promise<SeedChannel> {
  const cacheKey = `${owner.profileId}:${name}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const channels = await listUserChannelsThroughApi(
    owner.httpClient,
    owner.token,
    owner.userId
  );
  const existing = channels.find(
    (channel) => channel.profileId === owner.profileId && channel.name === name
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

function resolveDefaultVideoSourceDir(): string {
  const configuredSourceDir = process.env.VIDEO_SEED_SOURCE_DIR;
  const candidates =
    configuredSourceDir && configuredSourceDir !== LEGACY_VIDEO_SOURCE_DIR
      ? [configuredSourceDir, '/media/TV', '/media/Tv', LEGACY_VIDEO_SOURCE_DIR]
      : [
          '/media/TV',
          '/media/Tv',
          configuredSourceDir,
          LEGACY_VIDEO_SOURCE_DIR,
        ];

  return (
    resolveFirstExistingSeedVideoDirectory(
      candidates.filter((candidate): candidate is string => Boolean(candidate)),
      existsSync
    ) ??
    configuredSourceDir ??
    LEGACY_VIDEO_SOURCE_DIR
  );
}

function parseOptionalPositiveInt(
  value: string | undefined
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

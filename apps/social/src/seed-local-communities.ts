import { saveCommunityWithDirectoryChange } from './app/services/community-directory-outbox';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ArrayContains, Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import seedData from './data/seed-cities.json';
import { AppModule } from './app/app.module';
import { Community, LocalityType } from './entities/community.entity';
import {
  changedSeedFields,
  ensureCommunityChatRoom,
  withFormerSlug,
} from './seed-local-communities.helpers';
import { ChatCommands } from '@optimistic-tanuki/constants';

type CityHighlight = {
  headline: string;
  link: string;
  imageUrl: string;
};

type RawLocality = {
  name: string;
  slug: string;
  localityType: LocalityType;
  city: string;
  state: string;
  lat: number;
  lng: number;
  population: number;
  imageUrl?: string;
  description: string;
  highlights?: CityHighlight[];
  timezone?: string;
  /** The civic-briefing locality this town's page shows briefings for. */
  localitySlug?: string;
  /**
   * The slug this community had before it was renamed. The seed then renames the existing community in place (same
   * id, so the Directory town and its data follow) instead of creating a second one.
   */
  formerSlug?: string;
  /** Slug of the locality that absorbed this one (owner decision); the community is retired as a town. */
  mergedInto?: string;
};

type NeighborhoodSeed = {
  name: string;
  slug: string;
  description: string;
  imageUrl?: string;
};

type SeedLocality = {
  name: string;
  slug: string;
  description: string;
  localityType: LocalityType;
  countryCode: string;
  adminArea: string;
  city: string;
  lat: number;
  lng: number;
  population: number;
  imageUrl: string;
  highlights: CityHighlight[] | null;
  timezone: string;
  tags: { id: string; name: string }[];
  localitySlug: string | null;
  parentSlug?: string;
  formerSlug: string | null;
  mergedInto: string | null;
};

const rawLocalities = ((seedData as { localities?: RawLocality[] })
  .localities ?? []) as RawLocality[];
const neighborhoodMap = ((
  seedData as {
    communities?: Record<string, NeighborhoodSeed[]>;
  }
).communities ?? {}) as Record<string, NeighborhoodSeed[]>;

const neighborhoodParentBySlug = new Map<string, string>(
  Object.entries(neighborhoodMap).flatMap(([parentSlug, neighborhoods]) =>
    neighborhoods.map(
      (neighborhood) => [neighborhood.slug, parentSlug] as const
    )
  )
);

const localityNameCounts = rawLocalities.reduce<Map<string, number>>(
  (counts, locality) => {
    counts.set(locality.name, (counts.get(locality.name) || 0) + 1);
    return counts;
  },
  new Map<string, number>()
);

function toSeedFragment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function buildFallbackImageUrl(seedKey: string) {
  return `https://picsum.photos/seed/${toSeedFragment(seedKey)}/1200/800`;
}

function buildFallbackHighlights(locality: RawLocality): CityHighlight[] {
  const seedBase = toSeedFragment(locality.slug);
  const cityLabel = locality.city;

  return [
    {
      headline: `${cityLabel} downtown favorites`,
      link: `https://example.com/${seedBase}/downtown`,
      imageUrl: `https://picsum.photos/seed/${seedBase}-downtown/800/600`,
    },
    {
      headline: `${cityLabel} local dining`,
      link: `https://example.com/${seedBase}/food`,
      imageUrl: `https://picsum.photos/seed/${seedBase}-food/800/600`,
    },
    {
      headline: `${cityLabel} parks and outdoors`,
      link: `https://example.com/${seedBase}/outdoors`,
      imageUrl: `https://picsum.photos/seed/${seedBase}-outdoors/800/600`,
    },
  ];
}

function buildTags(locality: RawLocality): { id: string; name: string }[] {
  const seed = [
    locality.localityType[0].toUpperCase() + locality.localityType.slice(1),
    locality.city,
    locality.state,
  ];

  if (locality.localityType === 'neighborhood') {
    seed.push('Community');
  } else if (locality.localityType === 'city') {
    seed.push('Local');
  } else if (locality.localityType === 'town') {
    seed.push('Small Town');
  } else if (locality.localityType === 'county') {
    seed.push('Regional');
  } else if (locality.localityType === 'region') {
    seed.push('Geography');
  }

  return Array.from(new Set(seed))
    .slice(0, 4)
    .map((name, index) => ({
      id: `${toSeedFragment(locality.slug)}-${index + 1}`,
      name,
    }));
}

function toSeedLocality(locality: RawLocality): SeedLocality {
  const isDuplicateName = (localityNameCounts.get(locality.name) || 0) > 1;
  const displayName = isDuplicateName
    ? `${locality.name} (${locality.city}, ${locality.state})`
    : locality.name;

  return {
    name: displayName,
    slug: locality.slug,
    description: locality.description,
    localityType: locality.localityType,
    countryCode: 'US',
    adminArea: locality.state,
    city: locality.city,
    lat: locality.lat,
    lng: locality.lng,
    population: locality.population,
    imageUrl: locality.imageUrl || buildFallbackImageUrl(locality.slug),
    highlights:
      locality.highlights && locality.highlights.length > 0
        ? locality.highlights
        : buildFallbackHighlights(locality),
    timezone: locality.timezone || 'America/New_York',
    tags: buildTags(locality),
    localitySlug: locality.localitySlug ?? null,
    parentSlug: neighborhoodParentBySlug.get(locality.slug),
    formerSlug: locality.formerSlug ?? null,
    mergedInto: locality.mergedInto ?? null,
  };
}

function localityRank(localityType: LocalityType) {
  if (localityType === 'region') return 0;
  if (localityType === 'county') return 1;
  if (localityType === 'city') return 2;
  if (localityType === 'town') return 3;
  return 4;
}

/**
 * SEED_LOCALITY_SLUGS (comma-separated) seeds only those places, and
 * SEED_SKIP_CHAT_ROOMS=true skips their chat rooms. The e2e stack uses both
 * for the Daylight towns, without chat-collector.
 */
const ONLY_SLUGS = new Set(
  (process.env['SEED_LOCALITY_SLUGS'] ?? '')
    .split(',')
    .map((slug) => slug.trim())
    .filter(Boolean)
);
const SKIP_CHAT_ROOMS = process.env['SEED_SKIP_CHAT_ROOMS'] === 'true';

const COMMUNITIES: SeedLocality[] = rawLocalities
  .filter((locality) => ONLY_SLUGS.size === 0 || ONLY_SLUGS.has(locality.slug))
  .map(toSeedLocality)
  .sort((a, b) => localityRank(a.localityType) - localityRank(b.localityType));

const logger = new Logger('SeedLocalCommunities');

async function createCommunityChat(
  input: {
    communityId: string;
    ownerId: string;
    name?: string;
  },
  chatClient: ClientProxy
): Promise<{ id: string } | null> {
  const chatRoom = await firstValueFrom(
    chatClient
      .send<{ id: string } | null>(
        { cmd: ChatCommands.CREATE_COMMUNITY_CHAT },
        input
      )
      .pipe(timeout(15000))
  );

  return chatRoom;
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const chatClient = createChatCollectorClient();

  try {
    if (!SKIP_CHAT_ROOMS) await chatClient.connect();
    const communityRepo = app.get<Repository<Community>>(
      getRepositoryToken(Community)
    );

    console.log(`Seeding ${COMMUNITIES.length} local communities...`);
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const data of COMMUNITIES) {
      const existing =
        (await communityRepo.findOne({ where: { slug: data.slug } })) ??
        (data.formerSlug
          ? await communityRepo.findOne({ where: { slug: data.formerSlug } })
          : null);

      const parent =
        data.parentSlug != null
          ? await communityRepo.findOne({
              where: { slug: data.parentSlug },
            })
          : null;

      if (existing) {
        const updates = {
          name: data.name,
          slug: data.slug,
          description: data.description,
          localityType: data.localityType,
          countryCode: data.countryCode,
          adminArea: data.adminArea,
          city: data.city,
          lat: data.lat,
          lng: data.lng,
          population: data.population,
          imageUrl: data.imageUrl,
          highlights: data.highlights,
          timezone: data.timezone,
          tags: data.tags,
          localitySlug: data.localitySlug,
          parentId: parent?.id ?? null,
        };
        const changed = changedSeedFields(existing, updates);
        if (changed.length > 0) {
          // Only a real change writes a directory change; an unchanged row would invalidate its town's boundary.
          Object.assign(existing, updates);
          await saveCommunityWithDirectoryChange(communityRepo, {
            id: existing.id,
            ...updates,
          } as Community);
        }
        // Former slugs are not directory data, so recording them needs no directory change.
        const formerSlugs = withFormerSlug(
          existing.formerSlugs,
          data.formerSlug,
          data.slug
        );
        if (changedSeedFields(existing, { formerSlugs }).length > 0) {
          await communityRepo.update(existing.id, { formerSlugs });
          existing.formerSlugs = formerSlugs;
        }
        if (!SKIP_CHAT_ROOMS)
          await ensureCommunityChatRoom(existing, {
            createCommunityChat: (input) =>
              createCommunityChat(input, chatClient),
            setCommunityChatRoom: async (communityId, chatRoomId) => {
              await communityRepo.update(communityId, { chatRoomId });
            },
          });
        if (changed.length > 0) {
          updated++;
          console.log(`  Updated: ${data.name}`);
        } else unchanged++;
      } else {
        if (
          await communityRepo.findOne({
            where: { formerSlugs: ArrayContains([data.slug]) },
          })
        )
          throw new Error(`${data.slug} is a former slug of another community`);
        const community = communityRepo.create({
          name: data.name,
          slug: data.slug,
          description: data.description,
          localityType: data.localityType,
          countryCode: data.countryCode,
          adminArea: data.adminArea,
          city: data.city,
          lat: data.lat,
          lng: data.lng,
          population: data.population,
          imageUrl: data.imageUrl,
          highlights: data.highlights,
          timezone: data.timezone,
          tags: data.tags,
          localitySlug: data.localitySlug,
          parentId: parent?.id ?? null,
          ownerId: 'system',
          ownerProfileId: 'system',
          appScope: 'local-hub',
          isPrivate: false,
          joinPolicy: 'public',
          memberCount: 0,
          isSystemCommunity: true,
        });
        await saveCommunityWithDirectoryChange(communityRepo, community);
        if (!SKIP_CHAT_ROOMS)
          await ensureCommunityChatRoom(community, {
            createCommunityChat: (input) =>
              createCommunityChat(input, chatClient),
            setCommunityChatRoom: async (communityId, chatRoomId) => {
              await communityRepo.update(communityId, { chatRoomId });
            },
          });
        created++;
        console.log(`  Created: ${data.name}`);
      }
    }

    // Merges run after every community exists, so the target of a merge is always there.
    let merged = 0;
    for (const data of COMMUNITIES.filter((c) => c.mergedInto)) {
      const source = await communityRepo.findOne({
        where: { slug: data.slug },
      });
      const target = await communityRepo.findOne({
        where: { slug: data.mergedInto as string },
      });
      if (!source || !target || source.id === target.id)
        throw new Error(`Cannot merge ${data.slug} into ${data.mergedInto}`);
      if (target.mergedIntoId)
        throw new Error(`${data.mergedInto} is itself merged`);
      if (source.mergedIntoId === target.id) continue;
      await saveCommunityWithDirectoryChange(communityRepo, {
        id: source.id,
        mergedIntoId: target.id,
      } as Community);
      merged++;
      console.log(`  Merged: ${data.name} -> ${target.name}`);
    }
    if (merged) console.log(`Merged ${merged} communities.`);

    const totalByType = COMMUNITIES.reduce<Record<string, number>>(
      (acc, item) => {
        acc[item.localityType] = (acc[item.localityType] || 0) + 1;
        return acc;
      },
      {}
    );

    console.log(
      `\nDone. Created: ${created}, Updated: ${updated}, Unchanged: ${unchanged}, Total: ${COMMUNITIES.length}`
    );
    console.log(`Breakdown: ${JSON.stringify(totalByType)}`);
    chatClient.close();
    await app.close();
    process.exit(0);
  } catch (error) {
    logger.error('Seed failed', error as Error);
    console.error('Seed failed:', error);
    chatClient.close();
    await app.close();
    process.exit(1);
  }
}

function createChatCollectorClient(): ClientProxy {
  const chatCollectorHost = process.env.CHAT_COLLECTOR_HOST || 'chat-collector';
  const chatCollectorPort = Number.parseInt(
    process.env.CHAT_COLLECTOR_PORT || '3007',
    10
  );

  return ClientProxyFactory.create({
    transport: Transport.TCP,
    options: {
      host: chatCollectorHost,
      port: chatCollectorPort,
    },
  });
}

main();

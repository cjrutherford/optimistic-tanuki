import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import seedData from '../../local-hub/src/data/seed-cities.json';
import { AppModule } from './app/app.module';
import { Community, LocalityType } from './entities/community.entity';

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
  parentSlug?: string;
};

const rawLocalities = ((seedData as { localities?: RawLocality[] }).localities ??
  []) as RawLocality[];
const neighborhoodMap = ((seedData as {
  communities?: Record<string, NeighborhoodSeed[]>;
}).communities ?? {}) as Record<string, NeighborhoodSeed[]>;

const neighborhoodParentBySlug = new Map<string, string>(
  Object.entries(neighborhoodMap).flatMap(([parentSlug, neighborhoods]) =>
    neighborhoods.map((neighborhood) => [neighborhood.slug, parentSlug] as const)
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

  return Array.from(new Set(seed)).slice(0, 4).map((name, index) => ({
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
    parentSlug: neighborhoodParentBySlug.get(locality.slug),
  };
}

function localityRank(localityType: LocalityType) {
  if (localityType === 'region') return 0;
  if (localityType === 'county') return 1;
  if (localityType === 'city') return 2;
  if (localityType === 'town') return 3;
  return 4;
}

const COMMUNITIES: SeedLocality[] = rawLocalities
  .map(toSeedLocality)
  .sort((a, b) => localityRank(a.localityType) - localityRank(b.localityType));

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const communityRepo = app.get<Repository<Community>>(
      getRepositoryToken(Community)
    );

    console.log(`Seeding ${COMMUNITIES.length} local communities...`);
    let created = 0;
    let updated = 0;

    for (const data of COMMUNITIES) {
      const existing = await communityRepo.findOne({
        where: { slug: data.slug },
      });

      const parent =
        data.parentSlug != null
          ? await communityRepo.findOne({
              where: { slug: data.parentSlug },
            })
          : null;

      if (existing) {
        Object.assign(existing, {
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
          parentId: parent?.id ?? null,
        });
        await communityRepo.save(existing);
        updated++;
        console.log(`  Updated: ${data.name}`);
      } else {
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
          parentId: parent?.id ?? null,
          ownerId: 'system',
          ownerProfileId: 'system',
          appScope: 'local-hub',
          isPrivate: false,
          joinPolicy: 'public',
          memberCount: 0,
          isSystemCommunity: true,
        });
        await communityRepo.save(community);
        created++;
        console.log(`  Created: ${data.name}`);
      }
    }

    const totalByType = COMMUNITIES.reduce<Record<string, number>>((acc, item) => {
      acc[item.localityType] = (acc[item.localityType] || 0) + 1;
      return acc;
    }, {});

    console.log(
      `\nDone. Created: ${created}, Updated: ${updated}, Total: ${COMMUNITIES.length}`
    );
    console.log(`Breakdown: ${JSON.stringify(totalByType)}`);
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    await app.close();
    process.exit(1);
  }
}

main();

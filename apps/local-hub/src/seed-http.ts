/**
 * HTTP Seed Script: Local Hub Demo Data
 *
 * Creates 5 users with:
 * - User accounts (authentication)
 * - Profiles
 * - Communities (city + sub-communities)
 * - Posts in their communities
 * - Classifieds in their communities
 * - Memberships in communities
 *
 * Run via: pnpm exec ts-node apps/local-hub/src/seed-http.ts
 * Or via Docker: docker compose exec local-hub node /usr/src/app/seed-http.js
 */

import axios, { AxiosInstance } from 'axios';
import seedData from './data/seed-cities.json';

export interface CityHighlight {
  headline: string;
  link: string;
  imageUrl: string;
}

export interface SeedCity {
  name: string;
  slug: string;
  localityType: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  population: number;
  imageUrl: string;
  description: string;
  highlights: CityHighlight[];
  timezone: string;
}

export interface SeedCommunity {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
}

interface SeedUser {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  bio: string;
  profileName: string;
}

interface AuthenticatedUser {
  userId: string;
  profileId: string;
  token: string;
  email: string;
}

interface Community {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string | null;
  highlights?: CityHighlight[] | null;
  timezone?: string | null;
  parentId?: string | null;
}

interface Post {
  title: string;
  content: string;
}

interface Classified {
  title: string;
  price: number;
  category: string;
  description: string;
  imageUrls?: string[];
}

interface UserCommunityConfig {
  userIndex: number;
  community: {
    name: string;
    slug: string;
    description: string;
    localityType: string;
    city: string;
    imageUrl: string;
  };
  posts: Post[];
  classifieds: Classified[];
}

const SEED_USERS: SeedUser[] = [
  {
    email: 'alex.rivera@example.com',
    firstName: 'Alex',
    lastName: 'Rivera',
    password: 'TestPassword123!',
    bio: 'Savannah local business owner | Food enthusiast | Community volunteer',
    profileName: 'Alex Rivera',
  },
  {
    email: 'jordan.chen@example.com',
    firstName: 'Jordan',
    lastName: 'Chen',
    password: 'TestPassword123!',
    bio: 'Tech startup founder | Remote work advocate | Golf enthusiast',
    profileName: 'Jordan Chen',
  },
  {
    email: 'maya.williams@example.com',
    firstName: 'Maya',
    lastName: 'Williams',
    password: 'TestPassword123!',
    bio: 'Real estate agent | Single mom | Love the beach and outdoor activities',
    profileName: 'Maya Williams',
  },
  {
    email: 'carlos.martinez@example.com',
    firstName: 'Carlos',
    lastName: 'Martinez',
    password: 'TestPassword123!',
    bio: 'Military veteran | Georgia Southern alum | College sports fan',
    profileName: 'Carlos Martinez',
  },
  {
    email: 'emma.johnson@example.com',
    firstName: 'Emma',
    lastName: 'Johnson',
    password: 'TestPassword123!',
    bio: 'Teacher | Book club organizer | New to the area',
    profileName: 'Emma Johnson',
  },
];

const USER_COMMUNITIES: UserCommunityConfig[] = [
  {
    userIndex: 0, // Alex Rivera - Savannah Foodie
    community: {
      name: 'Savannah Foodie Network',
      slug: 'savannah-foodie-network',
      description:
        'A community for Savannah residents who love good food, cooking, and discovering new restaurants.',
      localityType: 'neighborhood',
      city: 'Savannah',
      imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80',
    },
    posts: [
      {
        title: 'Best Sunday Brunch Spots',
        content:
          'Looking for recommendations for Sunday brunch in the historic district. What are your favorite places?',
      },
      {
        title: 'Homemade Gullah Geechee Recipes',
        content:
          "Sharing my grandmother's recipe for shrimp and grits. Anyone else have family recipes to share?",
      },
      {
        title: 'Farmers Market Finds',
        content:
          'Just got back from the farmers market on Ellis Square. Fresh produce is amazing right now!',
      },
    ],
    classifieds: [
      {
        title: 'KitchenAid Stand Mixer',
        price: 150,
        category: 'Electronics',
        description:
          'Professional 5-quart stand mixer. Great for baking. Minor scratches on bowl.',
        imageUrls: [
          'https://images.unsplash.com/photo-1585515320310-259814833e62?w=800&q=80',
        ],
      },
      {
        title: 'Dining Table - Seats 6',
        price: 350,
        category: 'Furniture',
        description:
          'Solid wood dining table. Excellent condition. Must pick up in Ardsley Park.',
        imageUrls: [
          'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80',
        ],
      },
    ],
  },
  {
    userIndex: 1, // Jordan Chen - Savannah Tech
    community: {
      name: 'Savannah Tech Hub',
      slug: 'savannah-tech-hub',
      description:
        "Connecting Savannah's tech professionals, startups, and remote workers.",
      localityType: 'neighborhood',
      city: 'Savannah',
      imageUrl: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200&q=80',
    },
    posts: [
      {
        title: 'Remote Work Meetup',
        content:
          'Anyone interested in a monthly remote work meetup? Maybe at Service Brewing or Starland?',
      },
      {
        title: 'Tech Job Market in Savannah',
        content:
          "What's the tech job market like here? Moving from Atlanta and exploring options.",
      },
      {
        title: 'Best Coffee Shops for Work',
        content:
          'Compiling a list of coffee shops with good WiFi and work-friendly vibes. Share your favorites!',
      },
    ],
    classifieds: [
      {
        title: 'MacBook Pro 14" M3',
        price: 1800,
        category: 'Electronics',
        description:
          'Like new, AppleCare+ until 2026. Selling because I need the Pro Max.',
        imageUrls: [
          'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80',
        ],
      },
      {
        title: 'Standing Desk - Fully Electric',
        price: 450,
        category: 'Furniture',
        description:
          'Electric standing desk, 60x30". Memory presets, cable management. Like new.',
        imageUrls: [
          'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?w=800&q=80',
        ],
      },
    ],
  },
  {
    userIndex: 2, // Maya Williams - Real Estate
    community: {
      name: 'Savannah Real Estate',
      slug: 'savannah-real-estate',
      description:
        'Buying, selling, and renting in the Savannah area. Market insights and neighborhood guides.',
      localityType: 'neighborhood',
      city: 'Savannah',
      imageUrl: 'https://images.unsplash.com/photo-1460317442991-0ec209397118?w=1200&q=80',
    },
    posts: [
      {
        title: 'Market Update Q1 2024',
        content:
          'Savannah housing market update: inventory is still tight but prices are stabilizing in historic district.',
      },
      {
        title: 'First-Time Home Buyer Tips',
        content:
          'Working with several first-time buyers this year. What questions do you have?',
      },
      {
        title: 'Victorian District vs Thomas Square',
        content:
          'Comparing these two popular neighborhoods for young professionals. Pros and cons inside!',
      },
    ],
    classifieds: [
      {
        title: '3BR/2BA Victorian District Home',
        price: 485000,
        category: 'Real Estate',
        description:
          'Beautiful Victorian home, restored hardwoods, updated kitchen. Walking distance to Forsyth Park.',
        imageUrls: [
          'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
          'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80',
        ],
      },
      {
        title: 'Downtown Condo - 2BR/2BA',
        price: 325000,
        category: 'Real Estate',
        description:
          'Modern condo in the heart of downtown. Secure parking, rooftop access.',
        imageUrls: [
          'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
        ],
      },
    ],
  },
  {
    userIndex: 3, // Carlos Martinez - Military/Family
    community: {
      name: 'Fort Stewart Area Families',
      slug: 'fort-stewart-area-families',
      description:
        'Supporting military families in the Hinesville and Fort Stewart area.',
      localityType: 'neighborhood',
      city: 'Hinesville',
      imageUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=1200&q=80',
    },
    posts: [
      {
        title: 'PCS Tips for Fort Stewart',
        content:
          'Just arrived at Fort Stewart. What are the must-know tips for new arrivals?',
      },
      {
        title: 'Childcare Options',
        content:
          'Looking for recommendations for childcare near post. Any suggestions?',
      },
      {
        title: 'Best Places to Eat Near Post',
        content:
          'New to the area! What are your favorite restaurants within 15 minutes of Fort Stewart?',
      },
    ],
    classifieds: [
      {
        title: '2019 Honda CR-V',
        price: 24500,
        category: 'Vehicles',
        description:
          'Single owner, military family. 45k miles. Excellent condition. Must sell for PCS move.',
        imageUrls: [
          'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80',
        ],
      },
      {
        title: 'Kids Furniture Set',
        price: 200,
        category: 'Furniture',
        description:
          'Twin beds, dresser, bookshelf. Growing kids need bigger stuff! Good condition.',
        imageUrls: [
          'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80',
        ],
      },
    ],
  },
  {
    userIndex: 4, // Emma Johnson - New Resident
    community: {
      name: 'New Savannah Residents',
      slug: 'new-savannah-residents',
      description:
        'Welcome to newcomers! Share tips, ask questions, and connect with fellow new Savannahians.',
      localityType: 'neighborhood',
      city: 'Savannah',
      imageUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80',
    },
    posts: [
      {
        title: 'Moving to Savannah - What to Know',
        content:
          'Just moved from Chicago! What should every new resident know about Savannah?',
      },
      {
        title: 'Best Neighborhoods for Families',
        content:
          'Family of 4 looking to buy. What are the best neighborhoods with good schools?',
      },
      {
        title: 'Meeting New People',
        content:
          "New in town and looking to make friends. What's the best way to meet people in Savannah?",
      },
    ],
    classifieds: [
      {
        title: 'Office Desk - Free',
        price: 0,
        category: 'Furniture',
        description:
          'Free to good home! Computer desk, great condition. You pick up.',
        imageUrls: [
          'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?w=800&q=80',
        ],
      },
      {
        title: 'Boxes and Packing Supplies',
        price: 25,
        category: 'Miscellaneous',
        description:
          'Moving boxes, bubble wrap, packing tape. Just finished moving. Take it all!',
        imageUrls: [
          'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
        ],
      },
    ],
  },
];

const CITY_COMMUNITIES: SeedCity[] =
  (seedData as any).cities ||
  (seedData as any).localities?.filter((l: any) => l.localityType === 'city') ||
  [];

interface NeighborhoodData {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
}

const NEIGHBORHOOD_COMMUNITIES: Record<string, NeighborhoodData[]> =
  (seedData as any).communities || {};

const SLEEP_MS = 100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasCityChanges(existing: Community, cityData: SeedCity): boolean {
  return (
    existing.description !== cityData.description ||
    existing.imageUrl !== cityData.imageUrl ||
    existing.timezone !== cityData.timezone ||
    JSON.stringify(existing.highlights ?? []) !==
    JSON.stringify(cityData.highlights ?? [])
  );
}

function hasNeighborhoodChanges(
  existing: Community,
  neighborhood: NeighborhoodData,
  parentId: string
): boolean {
  return (
    existing.description !== neighborhood.description ||
    existing.imageUrl !== neighborhood.imageUrl ||
    existing.parentId !== parentId
  );
}

function hasUserCommunityChanges(
  existing: Community,
  community: UserCommunityConfig['community'],
  parentId?: string
): boolean {
  return (
    existing.description !== community.description ||
    existing.imageUrl !== community.imageUrl ||
    existing.parentId !== (parentId ?? null)
  );
}

async function main() {
  const env = process.env;
  const gatewayUrl =
    env['GATEWAY_URL'] || env['API_URL'] || 'http://localhost:3000/api';
  const appScope = env['APP_SCOPE'] || 'local-hub';

  console.log('=== Local Hub HTTP Seed Script ===');
  console.log(`Gateway: ${gatewayUrl}`);
  console.log(`App Scope: ${appScope}`);
  console.log('');

  const http: AxiosInstance = axios.create({
    baseURL: gatewayUrl,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'x-ot-appscope': appScope,
    },
  });

  try {
    await http.get('/health');
    console.log('✓ Gateway connection OK');
  } catch {
    console.warn('⚠ Gateway health check failed, continuing anyway...');
  }

  // Step 1: Register and authenticate users
  console.log('\n=== Step 1: Register Users ===');
  const users: AuthenticatedUser[] = [];

  for (const userData of SEED_USERS) {
    let token: string | undefined;
    let userId: string | undefined;
    let profileId: string | undefined;

    try {
      await http.post('/authentication/register', {
        email: userData.email,
        fn: userData.firstName,
        ln: userData.lastName,
        password: userData.password,
        confirm: userData.password,
        bio: userData.bio,
      });
      console.log(`✓ Registered: ${userData.email}`);
    } catch (err: any) {
      const status = err.response?.status;
      if (
        status === 409 ||
        err.response?.data?.message?.includes('already exists')
      ) {
        console.log(`  (exists): ${userData.email}`);
      } else {
        console.warn(`  ✗ Register failed: ${userData.email} - ${err.message}`);
      }
    }
    await sleep(SLEEP_MS);

    // Login
    try {
      const loginRes = await http.post('/authentication/login', {
        email: userData.email,
        password: userData.password,
      });
      const data = loginRes.data?.data || loginRes.data;
      token = data?.token || data?.newToken;

      if (token) {
        try {
          const meRes = await http.get('/authentication/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const me = meRes.data?.data || meRes.data;
          userId = me?.userId || me?.id;
        } catch {
          /* ignore */
        }

        if (!profileId && token) {
          try {
            const profileRes = await http.get('/profile/me', {
              headers: { Authorization: `Bearer ${token}` },
            });
            const p = profileRes.data?.data || profileRes.data;
            profileId = p?.id;
            if (!userId) userId = p?.userId;
          } catch {
            /* ignore */
          }
        }

        if (userId && profileId && token) {
          users.push({ userId, profileId, token, email: userData.email });
          console.log(
            `✓ Authenticated: ${userData.email} (profile: ${profileId})`
          );
        } else {
          console.warn(`  ✗ Could not get profile for ${userData.email}`);
        }
      }
    } catch (err: any) {
      console.warn(`  ✗ Login failed: ${userData.email} - ${err.message}`);
    }
    await sleep(SLEEP_MS);
  }

  if (users.length === 0) {
    console.error('\n✗ No users authenticated. Aborting.');
    process.exit(1);
  }
  console.log(`\n✓ Authenticated ${users.length} users`);

  // Step 2: Ensure city communities exist
  console.log('\n=== Step 2: Ensure City Communities ===');
  const cityCommunities: Map<string, Community> = new Map();

  for (const cityData of CITY_COMMUNITIES) {
    try {
      const existing = await http.get(`/communities/${cityData.slug}`);
      const c = existing.data?.data || existing.data;
      if (c?.id) {
        if (hasCityChanges(c, cityData)) {
          try {
            const updated = await http.put(
              `/social/community/${c.id}`,
              {
                description: cityData.description,
                highlights: cityData.highlights,
                imageUrl: cityData.imageUrl,
                localityType: cityData.localityType,
                countryCode: 'US',
                adminArea: cityData.state,
                city: cityData.city,
                lat: cityData.lat,
                lng: cityData.lng,
                population: cityData.population,
                timezone: cityData.timezone,
              },
              { headers: { Authorization: `Bearer ${users[0].token}` } }
            );
            const updatedCommunity: Community =
              updated.data?.data || updated.data;
            cityCommunities.set(cityData.slug, updatedCommunity);
            console.log(`  ✓ Updated: ${cityData.name}`);
            await sleep(SLEEP_MS);
            continue;
          } catch (err: any) {
            console.warn(`  ! Update failed for ${cityData.name}: ${err.message}`);
          }
        }
        cityCommunities.set(cityData.slug, c);
        console.log(`  ✓ Exists: ${c.name}`);
        continue;
      }
    } catch {
      /* doesn't exist */
    }

    try {
      const res = await http.post(
        '/social/community',
        {
          name: cityData.name,
          slug: cityData.slug,
          description: cityData.description,
          highlights: cityData.highlights,
          localityType: cityData.localityType,
          countryCode: 'US',
          adminArea: cityData.state,
          city: cityData.city,
          lat: cityData.lat,
          lng: cityData.lng,
          population: cityData.population,
          isPrivate: false,
          joinPolicy: 'public',
          tags: ['Community', 'Local', 'Events'],
          imageUrl: cityData.imageUrl,
          timezone: cityData.timezone,
          appScope,
        },
        { headers: { Authorization: `Bearer ${users[0].token}` } }
      );
      const c: Community = res.data?.data || res.data;
      cityCommunities.set(cityData.slug, c);
      console.log(`  ✓ Created: ${c.name}`);
    } catch (err: any) {
      console.warn(`  ✗ Failed to create ${cityData.name}: ${err.message}`);
    }
    await sleep(SLEEP_MS);
  }

  // Step 2b: Create neighborhood communities
  console.log('\n=== Step 2b: Create Neighborhood Communities ===');
  const neighborhoodCommunities: Map<string, Community> = new Map();

  for (const cityData of CITY_COMMUNITIES) {
    const neighborhoods = NEIGHBORHOOD_COMMUNITIES[cityData.slug];
    if (!neighborhoods) continue;

    const parentCity = cityCommunities.get(cityData.slug);
    if (!parentCity) continue;

    for (const neighborhood of neighborhoods) {
      try {
        const existing = await http.get(`/communities/${neighborhood.slug}`);
        const n = existing.data?.data || existing.data;
        if (n?.id) {
          if (hasNeighborhoodChanges(n, neighborhood, parentCity.id)) {
            try {
              const updated = await http.put(
                `/social/community/${n.id}`,
                {
                  description: neighborhood.description,
                  imageUrl: neighborhood.imageUrl,
                  localityType: 'neighborhood',
                  countryCode: 'US',
                  adminArea: cityData.state,
                  city: cityData.city,
                  parentId: parentCity.id,
                },
                { headers: { Authorization: `Bearer ${users[0].token}` } }
              );
              const updatedNeighborhood: Community =
                updated.data?.data || updated.data;
              neighborhoodCommunities.set(neighborhood.slug, updatedNeighborhood);
              console.log(`  ✓ Updated: ${neighborhood.name}`);
              await sleep(SLEEP_MS);
              continue;
            } catch (err: any) {
              console.warn(`  ! Update failed for ${neighborhood.name}: ${err.message}`);
            }
          }
          neighborhoodCommunities.set(neighborhood.slug, n);
          console.log(`  ✓ Exists: ${neighborhood.name}`);
          continue;
        }
      } catch {
        /* doesn't exist */
      }

      try {
        const latOffset = (Math.random() - 0.5) * 0.1;
        const lngOffset = (Math.random() - 0.5) * 0.1;
        const res = await http.post(
          '/social/community',
          {
            name: neighborhood.name,
            slug: neighborhood.slug,
            description: neighborhood.description,
            localityType: 'neighborhood',
            countryCode: 'US',
            adminArea: cityData.state,
            city: cityData.city,
            lat: cityData.lat + latOffset,
            lng: cityData.lng + lngOffset,
            population: Math.floor(Math.random() * 30000) + 5000,
            isPrivate: false,
            joinPolicy: 'public',
            tags: ['Community', 'Neighborhood', 'Local'],
            imageUrl: neighborhood.imageUrl,
            parentId: parentCity.id,
            appScope,
          },
          { headers: { Authorization: `Bearer ${users[0].token}` } }
        );
        const n: Community = res.data?.data || res.data;
        neighborhoodCommunities.set(neighborhood.slug, n);
        console.log(`  ✓ Created: ${neighborhood.name} (${cityData.city})`);
      } catch (err: any) {
        console.warn(
          `  ✗ Failed to create ${neighborhood.name}: ${err.message}`
        );
      }
      await sleep(SLEEP_MS);
    }
  }

  // Step 3: User creates their own community + posts + classifieds
  console.log('\n=== Step 3: Create User Communities, Posts & Classifieds ===');

  for (const userConfig of USER_COMMUNITIES) {
    const user = users[userConfig.userIndex];
    if (!user) {
      console.warn(
        `  ✗ User index ${userConfig.userIndex} not found, skipping`
      );
      continue;
    }

    // Determine parent city community
    const citySlug =
      userConfig.community.city === 'Savannah'
        ? 'savannah-ga'
        : userConfig.community.city === 'Charleston'
          ? 'charleston-sc'
          : userConfig.community.city === 'Hinesville'
            ? 'hinesville-ga'
            : 'savannah-ga';
    const parentCity = cityCommunities.get(citySlug);

    // Create user's community
    let userCommunity: Community | null = null;
    try {
      const slug = userConfig.community.slug!;
      const existing = await http.get(`/communities/${slug}`);
      const c = existing.data?.data || existing.data;
      if (c?.id) {
        if (hasUserCommunityChanges(c, userConfig.community, parentCity?.id)) {
          try {
            const updated = await http.put(
              `/social/community/${c.id}`,
              {
                description: userConfig.community.description,
                imageUrl: userConfig.community.imageUrl,
                localityType: userConfig.community.localityType,
                countryCode: 'US',
                adminArea: 'GA',
                city: userConfig.community.city,
                parentId: parentCity?.id ?? null,
              },
              { headers: { Authorization: `Bearer ${user.token}` } }
            );
            userCommunity = updated.data?.data || updated.data;
            console.log(`  ✓ Updated community: ${userConfig.community.name}`);
          } catch (err: any) {
            console.warn(`  ! Update community failed: ${err.message}`);
            userCommunity = c;
            console.log(`  ✓ Exists: ${userConfig.community.name}`);
          }
        } else {
          userCommunity = c;
          console.log(`  ✓ Exists: ${userConfig.community.name}`);
        }
      }
    } catch {
      /* doesn't exist */
    }

    if (!userCommunity) {
      try {
        const res = await http.post(
          '/social/community',
          {
            name: userConfig.community.name,
            slug: userConfig.community.slug,
            description: userConfig.community.description,
            localityType: userConfig.community.localityType,
            countryCode: 'US',
            adminArea: 'GA',
            city: userConfig.community.city,
            lat: 31.0 + Math.random() * 3,
            lng: -82.0 + Math.random() * 3,
            population: Math.floor(Math.random() * 50000) + 5000,
            isPrivate: false,
            joinPolicy: 'public',
            tags: ['Community', 'Local', 'Interest'],
            imageUrl: userConfig.community.imageUrl,
            parentId: parentCity?.id,
            appScope,
          },
          { headers: { Authorization: `Bearer ${user.token}` } }
        );
        userCommunity = res.data?.data || res.data;
        if (userCommunity) {
          console.log(`  ✓ Created community: ${userCommunity.name}`);
        }
      } catch (err: any) {
        console.warn(`  ✗ Failed to create community: ${err.message}`);
      }
    }
    await sleep(SLEEP_MS);

    if (!userCommunity) continue;

    // Join user to their community
    try {
      await http.post(
        `/social/community/${userCommunity.id}/join`,
        { profileId: user.profileId },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      console.log(`  ✓ User joined: ${userCommunity.name}`);
    } catch (err: any) {
      if (err.response?.status !== 409) {
        console.warn(`  ! Join community: ${err.message}`);
      }
    }
    await sleep(SLEEP_MS);

    // Create posts
    for (const postData of userConfig.posts) {
      try {
        await http.post(
          '/social/post',
          {
            title: postData.title,
            content: `<p>${postData.content}</p>`,
            profileId: user.profileId,
            communityId: userCommunity.id,
            appScope,
          },
          { headers: { Authorization: `Bearer ${user.token}` } }
        );
        console.log(`    ✓ Post: ${postData.title}`);
      } catch (err: any) {
        console.warn(`    ✗ Post failed: ${err.message}`);
      }
      await sleep(SLEEP_MS);
    }

    // Create classifieds
    for (const classifiedData of userConfig.classifieds) {
      try {
        await http.post(
          '/classifieds',
          {
            title: classifiedData.title,
            description: classifiedData.description,
            price: classifiedData.price,
            currency: 'USD',
            category: classifiedData.category,
            condition: 'Good',
            communityId: userCommunity.id,
            profileId: user.profileId,
            imageUrls: classifiedData.imageUrls ?? [],
            appScope,
          },
          { headers: { Authorization: `Bearer ${user.token}` } }
        );
        console.log(
          `    ✓ Classified: ${classifiedData.title} - $${classifiedData.price}`
        );
      } catch (err: any) {
        console.warn(`    ✗ Classified failed: ${err.message}`);
      }
      await sleep(SLEEP_MS);
    }

    // Also join the parent city community
    if (parentCity && parentCity.id !== userCommunity.id) {
      try {
        await http.post(
          `/social/community/${parentCity.id}/join`,
          { profileId: user.profileId },
          { headers: { Authorization: `Bearer ${user.token}` } }
        );
        console.log(`  ✓ Joined city: ${parentCity.name}`);
      } catch (err: any) {
        if (err.response?.status !== 409) {
          console.warn(`  ! Join city: ${err.message}`);
        }
      }
    }
    await sleep(SLEEP_MS);
  }

  // Summary
  console.log('\n=== Seed Complete ===');
  console.log(`Users created: ${users.length}`);
  console.log(`City communities: ${cityCommunities.size}`);
  console.log('\n=== Test Credentials ===');
  for (const user of users) {
    console.log(`  ${user.email} / TestPassword123!`);
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

import { NestFactory } from '@nestjs/core';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { ClassifiedAdEntity } from './app/entities/classified-ad.entity';

interface ClassifiedSeed {
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  communitySlug: string;
  imageUrls?: string[];
}

const CLASSIFIEDS: ClassifiedSeed[] = [
  // Savannah, GA
  {
    title: '2019 Toyota Camry XSE',
    description:
      'Low mileage, single owner, excellent condition. Features include leather seats, sunroof, and advanced safety features. Must see!',
    price: 22500,
    category: 'Vehicles',
    condition: 'Excellent',
    communitySlug: 'savannah-ga',
    imageUrls: [
      'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=600&q=80',
    ],
  },
  {
    title: 'Vintage Oak Dining Table',
    description:
      'Beautiful solid oak dining table from the 1970s. Seats 6-8 people. Minor wear consistent with age. Local pickup only.',
    price: 450,
    category: 'Furniture',
    condition: 'Good',
    communitySlug: 'savannah-ga',
    imageUrls: [
      'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=600&q=80',
    ],
  },
  {
    title: 'iPhone 14 Pro Max 256GB',
    description:
      'Space Black, excellent condition with minor screen protector wear. Includes original box and charger. Unlocked for all carriers.',
    price: 850,
    category: 'Electronics',
    condition: 'Excellent',
    communitySlug: 'savannah-tech',
    imageUrls: [
      'https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=600&q=80',
    ],
  },
  {
    title: 'Professional Kitchen Equipment',
    description:
      'Restaurant closing sale. Commercial-grade stove, refrigerator, prep tables, and small wares. Perfect for starting a restaurant or food business.',
    price: 3500,
    category: 'Business',
    condition: 'Good',
    communitySlug: 'savannah-foodies',
    imageUrls: [
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80',
    ],
  },
  {
    title: 'Kids Bicycle - 20 inch',
    description:
      'Trek mountain bike for kids. Good condition, recently serviced. Helmet included. Growing out of it so need to sell.',
    price: 75,
    category: 'Sports',
    condition: 'Good',
    communitySlug: 'savannah-parents',
    imageUrls: [
      'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=600&q=80',
    ],
  },

  // Charleston, SC
  {
    title: 'Historic Charleston Home - Downtown',
    description:
      'Beautiful 3BR/2BA home in historic district. Original hardwood floors, updated kitchen, private courtyard. Walking distance to restaurants and shopping.',
    price: 625000,
    category: 'Real Estate',
    condition: 'Excellent',
    communitySlug: 'charleston-sc',
    imageUrls: [
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&q=80',
    ],
  },
  {
    title: 'Surfboard - Channel Islands 6\'2"',
    description:
      'Great all-around shortboard. Fins included. Excellent condition, only used a few times. Moving and need to downsize.',
    price: 450,
    category: 'Sports',
    condition: 'Excellent',
    communitySlug: 'charleston-sc',
    imageUrls: [
      'https://images.unsplash.com/photo-1531722569936-825d3dd91b15?w=600&q=80',
    ],
  },
  {
    title: 'Commercial Kitchen Space for Lease',
    description:
      '1200 sq ft licensed commercial kitchen in Charleston. Ideal for caterers, bakers, food trucks. Includes storage and loading dock.',
    price: 1800,
    category: 'Real Estate',
    condition: 'Excellent',
    communitySlug: 'charleston-food-wine',
    imageUrls: [
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80',
    ],
  },
  {
    title: 'Paddleboard - inflatable',
    description:
      'Stand-up paddleboard with pump, paddle, and carrying bag. Used twice. Great for beginners. Includes waterproof phone case.',
    price: 275,
    category: 'Sports',
    condition: 'Like New',
    communitySlug: 'charleston-sc',
    imageUrls: [
      'https://images.unsplash.com/photo-1526188717906-ab4a2f949f84?w=600&q=80',
    ],
  },

  // Jacksonville, FL
  {
    title: '2018 Ford F-150 Lariat',
    description:
      'Crew cab, 4x4, low miles. Leather interior, heated seats, navigation, bed liner. Tow package included. Single owner.',
    price: 38500,
    category: 'Vehicles',
    condition: 'Excellent',
    communitySlug: 'jacksonville-fl',
    imageUrls: [
      'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=600&q=80',
    ],
  },
  {
    title: 'Beach Condo - Jacksonville Beach',
    description:
      '2BR/2BA oceanfront condo at Jacksonville Beach. Balcony with ocean views, pool, direct beach access. Great rental potential or personal getaway.',
    price: 425000,
    category: 'Real Estate',
    condition: 'Excellent',
    communitySlug: 'jacksonville-beach',
    imageUrls: [
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&q=80',
    ],
  },
  {
    title: 'DJ Equipment Bundle',
    description:
      'Complete DJ setup: 2x Pioneer CDJ-2000, DJM-900 mixer, speakers, lighting. Perfect for parties or starting a DJ business.',
    price: 2800,
    category: 'Electronics',
    condition: 'Good',
    communitySlug: 'jacksonville-tech',
    imageUrls: [
      'https://images.unsplash.com/photo-1571266028243-3716f02d2d2e?w=600&q=80',
    ],
  },

  // Augusta, GA
  {
    title: 'Golf Clubs - Full Set',
    description:
      "Ping G425 driver, woods, irons, putter. Custom fitted. Used but in great condition. Moving and can't take with me.",
    price: 750,
    category: 'Sports',
    condition: 'Good',
    communitySlug: 'augusta-masters',
    imageUrls: [
      'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=600&q=80',
    ],
  },
  {
    title: 'Military Relocation Sale - Furniture',
    description:
      'PCS move! Dining set, living room furniture, bedroom set. All excellent condition. Must sell this week!',
    price: 1200,
    category: 'Furniture',
    condition: 'Excellent',
    communitySlug: 'augusta-military-families',
    imageUrls: [
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80',
    ],
  },

  // Hilton Head, SC
  {
    title: 'Hilton Head Beach House',
    description:
      '4BR/3BA beach house. Direct beach access, updated kitchen, large deck. Perfect for family vacations or investment property.',
    price: 895000,
    category: 'Real Estate',
    condition: 'Excellent',
    communitySlug: 'hilton-head-island-sc',
    imageUrls: [
      'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=600&q=80',
    ],
  },
  {
    title: 'Golf Cart - Club Car',
    description:
      '2019 Club Car precedent. New batteries, cover. Great for neighborhood or golf. Runs perfectly.',
    price: 4500,
    category: 'Vehicles',
    condition: 'Excellent',
    communitySlug: 'hilton-head-outdoors',
    imageUrls: [
      'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?w=600&q=80',
    ],
  },
  {
    title: 'Kayak - 2 Person',
    description:
      'Tandem kayak with paddles and life vests. Stable and easy to paddle. Great for family fun on the water.',
    price: 350,
    category: 'Sports',
    condition: 'Good',
    communitySlug: 'hilton-head-outdoors',
    imageUrls: [
      'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&q=80',
    ],
  },

  // Brunswick, GA
  {
    title: 'Fishing Boat - 18ft',
    description:
      'Well-maintained fishing boat with motor. Includes fishfinder, trolling motor, and trailer. Perfect for coastal fishing.',
    price: 8500,
    category: 'Vehicles',
    condition: 'Good',
    communitySlug: 'golden-isles-beach',
    imageUrls: [
      'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&q=80',
    ],
  },

  // Statesboro, GA
  {
    title: 'Georgia Southern Football Tickets',
    description:
      'Season tickets for upcoming football season. Prime seats in section 201. Can sell individually or as a package.',
    price: 350,
    category: 'Tickets',
    condition: 'New',
    communitySlug: 'georgia-southern-eagles',
    imageUrls: [
      'https://images.unsplash.com/photo-1568603074322-a4ecb1af6745?w=600&q=80',
    ],
  },
  {
    title: 'Apartment near GSU',
    description:
      '2BR/2BA apartment less than mile from campus. Washer/dryer included, pool, gym. Available August 1st.',
    price: 950,
    category: 'Real Estate',
    condition: 'Excellent',
    communitySlug: 'statesboro-downtown',
    imageUrls: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&q=80',
    ],
  },

  // Greenville, SC
  {
    title: 'Downtown Greenville Condo',
    description:
      'Modern 1BR/1BA condo in the heart of downtown. Walking distance to Falls Park, restaurants, and nightlife. Secure building.',
    price: 275000,
    category: 'Real Estate',
    condition: 'Excellent',
    communitySlug: 'greenville-downtown',
    imageUrls: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&q=80',
    ],
  },
  {
    title: 'Restaurant Equipment',
    description:
      'Complete restaurant closure sale. Walk-in cooler, ovens, fryers, prep tables, seating. Everything must go this week!',
    price: 5500,
    category: 'Business',
    condition: 'Good',
    communitySlug: 'greenville-food-scene',
    imageUrls: [
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80',
    ],
  },

  // Myrtle Beach
  {
    title: 'Myrtle Beach Condo - Oceanfront',
    description:
      '2BR/2BA oceanfront condo at popular resort. Full amenities, pools, lazy river. Great rental income potential or vacation home.',
    price: 289000,
    category: 'Real Estate',
    condition: 'Excellent',
    communitySlug: 'myrtle-beach-golf',
    imageUrls: [
      'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=600&q=80',
    ],
  },
  {
    title: 'Golf Clubs - Callaway Complete Set',
    description:
      'Full set of Callaway clubs including driver, hybrids, irons, wedges, putter. Graphite shafts. Great for mid-handicap golfer.',
    price: 650,
    category: 'Sports',
    condition: 'Good',
    communitySlug: 'myrtle-beach-golf',
    imageUrls: [
      'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=600&q=80',
    ],
  },

  // Wilmington, NC
  {
    title: 'Wilmington Downtown Loft',
    description:
      'Unique 1BR loft in historic building. Exposed brick, high ceilings, updated kitchen. Walking distance to bars and restaurants.',
    price: 325000,
    category: 'Real Estate',
    condition: 'Excellent',
    communitySlug: 'wilmington-nc',
    imageUrls: [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80',
    ],
  },
  {
    title: 'Filming Equipment',
    description:
      'Sony A7III camera, lenses, lighting kit, tripods, boom mic. Great for starting in videography or content creation.',
    price: 3200,
    category: 'Electronics',
    condition: 'Excellent',
    communitySlug: 'wilmington-film',
    imageUrls: [
      'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=600&q=80',
    ],
  },
  {
    title: 'Wrightsville Beach Parking Pass',
    description:
      'Annual parking pass for Wrightsville Beach. Valid through end of year. Transferable. Saves $500+ over daily parking.',
    price: 200,
    category: 'Miscellaneous',
    condition: 'New',
    communitySlug: 'wrightsville-beach-nc',
    imageUrls: [
      'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=600&q=80',
    ],
  },

  // Aiken, SC
  {
    title: 'Horse Tack - Complete Set',
    description:
      'English riding tack including saddle, bridle, girth, boots. All in excellent condition. Pony size (14h-15h).',
    price: 850,
    category: 'Animals',
    condition: 'Excellent',
    communitySlug: 'aiken-equestrian',
    imageUrls: [
      'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=600&q=80',
    ],
  },

  // More Savannah
  {
    title: 'Historic Savannah Home',
    description:
      'Gorgeous 4BR/3BA Victorian home in historic district. Original details, updated systems, private garden. Walking tours available.',
    price: 725000,
    category: 'Real Estate',
    condition: 'Excellent',
    communitySlug: 'savannah-ga',
    imageUrls: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&q=80',
    ],
  },

  // More Charleston
  {
    title: 'Antique Furniture Collection',
    description:
      'Curated collection of antique furniture including chairs, tables, and cabinets. Perfect for antique shop or restoration project.',
    price: 2400,
    category: 'Furniture',
    condition: 'Good',
    communitySlug: 'charleston-sc',
    imageUrls: [
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80',
    ],
  },
];

// Category mapping for seed
const CATEGORIES = [
  'Vehicles',
  'Real Estate',
  'Electronics',
  'Furniture',
  'Sports',
  'Business',
  'Tickets',
  'Animals',
  'Miscellaneous',
];

interface CommunityResponse {
  id: string;
  name: string;
  slug: string;
}

async function fetchCommunityId(
  slug: string,
  gatewayUrl: string
): Promise<string | null> {
  try {
    const response = await fetch(`${gatewayUrl}/api/communities/slug/${slug}`);
    if (!response.ok) {
      console.warn(`  Community not found: ${slug}`);
      return null;
    }
    const community: CommunityResponse = await response.json();
    return community.id;
  } catch (error) {
    console.warn(`  Failed to fetch community ${slug}:`, error);
    return null;
  }
}

async function main() {
  const configPath = path.resolve(__dirname, './assets/config.yaml');
  const config = yaml.load(fs.readFileSync(configPath, 'utf8')) as Record<
    string,
    any
  >;

  const { database } = config;
  const dbConfig = database;

  const env = process.env;
  const gatewayUrl = env['GATEWAY_URL'] || 'http://localhost:3000';

  const dataSource = new DataSource({
    type: 'postgres',
    host: env['POSTGRES_HOST'] || dbConfig.host || 'localhost',
    port: parseInt(env['POSTGRES_PORT'] || dbConfig.port || '5432'),
    username: env['POSTGRES_USER'] || dbConfig.username || 'postgres',
    password: env['POSTGRES_PASSWORD'] || dbConfig.password || 'postgres',
    database: env['POSTGRES_DB'] || dbConfig.database || 'classifieds',
    entities: [ClassifiedAdEntity],
    synchronize: false,
  });

  await dataSource.initialize();
  const repo = dataSource.getRepository(ClassifiedAdEntity);

  console.log(`Fetching community IDs from ${gatewayUrl}...`);

  const communityIdCache = new Map<string, string | null>();
  const uniqueSlugs = [...new Set(CLASSIFIEDS.map((ad) => ad.communitySlug))];

  for (const slug of uniqueSlugs) {
    const communityId = await fetchCommunityId(slug, gatewayUrl);
    communityIdCache.set(slug, communityId);
    console.log(`  ${slug} -> ${communityId || 'NOT FOUND'}`);
  }

  console.log(`\nSeeding ${CLASSIFIEDS.length} classified ads...`);

  let created = 0;
  let skipped = 0;

  for (const ad of CLASSIFIEDS) {
    // Check if ad with same title exists
    const existing = await repo.findOne({
      where: { title: ad.title, appScope: 'local-hub' },
    });

    if (existing) {
      skipped++;
      console.log(`  Skipped (exists): ${ad.title}`);
      continue;
    }

    // Use a placeholder profileId and userId for seeded ads
    // Get communityId from cache (resolved via gateway API call)
    const communityId = communityIdCache.get(ad.communitySlug) || null;

    const classifiedAd = repo.create({
      title: ad.title,
      description: ad.description,
      price: ad.price,
      currency: 'USD',
      category: ad.category,
      condition: ad.condition,
      imageUrls: ad.imageUrls || null,
      status: 'active',
      communityId: communityId,
      profileId: '00000000-0000-0000-0000-000000000000', // Placeholder
      userId: '00000000-0000-0000-0000-000000000000', // Placeholder
      appScope: 'local-hub',
      isFeatured: false,
      featuredUntil: null,
      expiresAt: null,
    });

    await repo.save(classifiedAd);
    created++;
    console.log(`  Created: ${ad.title} (${ad.communitySlug}) - $${ad.price}`);
  }

  console.log(
    `\nDone. Created: ${created}, Skipped (exists): ${skipped}, Total: ${CLASSIFIEDS.length}`
  );

  await dataSource.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

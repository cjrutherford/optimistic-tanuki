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
 * Run via: npx ts-node apps/local-hub/src/seed-http.ts
 * Or via Docker: docker compose exec local-hub node /usr/src/app/seed-http.js
 */

import axios, { AxiosInstance } from 'axios';

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
}

interface UserCommunityConfig {
  userIndex: number;
  community: {
    name: string;
    slug: string;
    description: string;
    localityType: string;
    city: string;
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
      },
      {
        title: 'Dining Table - Seats 6',
        price: 350,
        category: 'Furniture',
        description:
          'Solid wood dining table. Excellent condition. Must pick up in Ardsley Park.',
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
      },
      {
        title: 'Standing Desk - Fully Electric',
        price: 450,
        category: 'Furniture',
        description:
          'Electric standing desk, 60x30". Memory presets, cable management. Like new.',
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
      },
      {
        title: 'Downtown Condo - 2BR/2BA',
        price: 325000,
        category: 'Real Estate',
        description:
          'Modern condo in the heart of downtown. Secure parking, rooftop access.',
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
      },
      {
        title: 'Kids Furniture Set',
        price: 200,
        category: 'Furniture',
        description:
          'Twin beds, dresser, bookshelf. Growing kids need bigger stuff! Good condition.',
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
      },
      {
        title: 'Boxes and Packing Supplies',
        price: 25,
        category: 'Miscellaneous',
        description:
          'Moving boxes, bubble wrap, packing tape. Just finished moving. Take it all!',
      },
    ],
  },
];

const CITY_COMMUNITIES: {
  name: string;
  slug: string;
  localityType: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  population: number;
  imageUrl: string;
}[] = [
  {
    name: 'Savannah, GA',
    slug: 'savannah-ga',
    localityType: 'city',
    city: 'Savannah',
    state: 'GA',
    lat: 32.0809,
    lng: -81.0912,
    population: 147088,
    imageUrl:
      'https://images.unsplash.com/photo-1573115627-3b4c593f2e9c?w=800&q=80',
  },
  {
    name: 'Charleston, SC',
    slug: 'charleston-sc',
    localityType: 'city',
    city: 'Charleston',
    state: 'SC',
    lat: 32.7765,
    lng: -79.9311,
    population: 155369,
    imageUrl:
      'https://images.unsplash.com/photo-1569974507005-6dc61f97fb5c?w=800&q=80',
  },
  {
    name: 'Jacksonville, FL',
    slug: 'jacksonville-fl',
    localityType: 'city',
    city: 'Jacksonville',
    state: 'FL',
    lat: 30.3322,
    lng: -81.6557,
    population: 911507,
    imageUrl:
      'https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=800&q=80',
  },
  {
    name: 'Columbia, SC',
    slug: 'columbia-sc',
    localityType: 'city',
    city: 'Columbia',
    state: 'SC',
    lat: 34.0007,
    lng: -81.0348,
    population: 127395,
    imageUrl:
      'https://images.unsplash.com/photo-1566543079657-7756ff1b5d7c?w=800&q=80',
  },
  {
    name: 'Augusta, GA',
    slug: 'augusta-ga',
    localityType: 'city',
    city: 'Augusta',
    state: 'GA',
    lat: 33.4404,
    lng: -81.9618,
    population: 197166,
    imageUrl:
      'https://images.unsplash.com/photo-1569582963977-45a36620935c?w=800&q=80',
  },
  {
    name: 'Macon, GA',
    slug: 'macon-ga',
    localityType: 'city',
    city: 'Macon',
    state: 'GA',
    lat: 32.8407,
    lng: -83.6324,
    population: 153095,
    imageUrl:
      'https://images.unsplash.com/photo-1575893788725-2d7b1bab84f3?w=800&q=80',
  },
  {
    name: 'Columbus, GA',
    slug: 'columbus-ga',
    localityType: 'city',
    city: 'Columbus',
    state: 'GA',
    lat: 32.5102,
    lng: -84.8772,
    population: 206922,
    imageUrl:
      'https://images.unsplash.com/photo-1555466861-1be2453f4f83?w=800&q=80',
  },
  {
    name: 'Hilton Head Island, SC',
    slug: 'hilton-head-island-sc',
    localityType: 'city',
    city: 'Hilton Head Island',
    state: 'SC',
    lat: 32.2163,
    lng: -80.7526,
    population: 39661,
    imageUrl:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
  },
  {
    name: 'Wilmington, NC',
    slug: 'wilmington-nc',
    localityType: 'city',
    city: 'Wilmington',
    state: 'NC',
    lat: 34.2257,
    lng: -77.9447,
    population: 123744,
    imageUrl:
      'https://images.unsplash.com/photo-1568515045052-58b946f85c08?w=800&q=80',
  },
  {
    name: 'Orlando, FL',
    slug: 'orlando-fl',
    localityType: 'city',
    city: 'Orlando',
    state: 'FL',
    lat: 28.5383,
    lng: -81.3792,
    population: 289457,
    imageUrl:
      'https://images.unsplash.com/photo-1594729095022-e2f6d2f63f45?w=800&q=80',
  },
  {
    name: 'Charlotte, NC',
    slug: 'charlotte-nc',
    localityType: 'city',
    city: 'Charlotte',
    state: 'NC',
    lat: 35.2271,
    lng: -80.8431,
    population: 885708,
    imageUrl:
      'https://images.unsplash.com/photo-1568527353631-7f02d8b0c4f5?w=800&q=80',
  },
  {
    name: 'Atlanta, GA',
    slug: 'atlanta-ga',
    localityType: 'city',
    city: 'Atlanta',
    state: 'GA',
    lat: 33.749,
    lng: -84.388,
    population: 496441,
    imageUrl:
      'https://images.unsplash.com/photo-1569974508324-0c4e5c2c1f1e?w=800&q=80',
  },
  {
    name: 'Beaufort, SC',
    slug: 'beaufort-sc',
    localityType: 'city',
    city: 'Beaufort',
    state: 'SC',
    lat: 32.4316,
    lng: -80.6698,
    population: 31317,
    imageUrl:
      'https://images.unsplash.com/photo-1540914124281-342587941389?w=800&q=80',
  },
  {
    name: 'Brunswick, GA',
    slug: 'brunswick-ga',
    localityType: 'city',
    city: 'Brunswick',
    state: 'GA',
    lat: 31.15,
    lng: -81.4915,
    population: 16257,
    imageUrl:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
  },
  {
    name: 'Gainesville, FL',
    slug: 'gainesville-fl',
    localityType: 'city',
    city: 'Gainesville',
    state: 'FL',
    lat: 29.6516,
    lng: -82.3248,
    population: 133997,
    imageUrl:
      'https://images.unsplash.com/photo-1562783487-623d90387097?w=800&q=80',
  },
  {
    name: 'Tallahassee, FL',
    slug: 'tallahassee-fl',
    localityType: 'city',
    city: 'Tallahassee',
    state: 'FL',
    lat: 30.4383,
    lng: -84.2807,
    population: 196165,
    imageUrl:
      'https://images.unsplash.com/photo-1574169208507-84376144848b?w=800&q=80',
  },
  {
    name: 'Athens, GA',
    slug: 'athens-ga',
    localityType: 'city',
    city: 'Athens',
    state: 'GA',
    lat: 33.9519,
    lng: -83.3576,
    population: 127315,
    imageUrl:
      'https://images.unsplash.com/photo-1568972547244-8a1e6cb4f9f9?w=800&q=80',
  },
];

interface NeighborhoodData {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
}

const NEIGHBORHOOD_COMMUNITIES: Record<string, NeighborhoodData[]> = {
  'savannah-ga': [
    {
      name: 'Historic District',
      slug: 'savannah-historic-district',
      description:
        'The heart of Savannah with historic squares and antebellum architecture.',
      imageUrl:
        'https://images.unsplash.com/photo-1587578932405-7c740a762f3a?w=800&q=80',
    },
    {
      name: 'Savannah Historic District',
      slug: 'savannah-historic-district-neighborhood',
      description:
        "Browse historic homes and squares in America's first planned city.",
      imageUrl:
        'https://images.unsplash.com/photo-1579782558504-209a34106519?w=800&q=80',
    },
    {
      name: 'Tybee Island',
      slug: 'tybee-island-savannah',
      description:
        'Beach community just east of Savannah with surfing and海鲜.',
      imageUrl:
        'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=80',
    },
    {
      name: 'Ardsley Park',
      slug: 'ardsley-park-savannah',
      description: 'Historic residential neighborhood near Memorial Health.',
      imageUrl:
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    },
    {
      name: 'Southside Savannah',
      slug: 'southside-savannah',
      description: 'Growing residential area with shopping and dining.',
      imageUrl:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    },
    {
      name: 'Pooler',
      slug: 'pooler-ga',
      description: 'Suburban community west of Savannah near the airport.',
      imageUrl:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
    },
    {
      name: 'Skidaway Island',
      slug: 'skidaway-island',
      description: 'Upscale island community with golf courses.',
      imageUrl:
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    },
    {
      name: 'Wilmington Island',
      slug: 'wilmington-island-savannah',
      description: 'Marshfront community with nature trails.',
      imageUrl:
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
    },
  ],
  'charleston-sc': [
    {
      name: 'Downtown Charleston',
      slug: 'downtown-charleston',
      description:
        'Historic peninsula with cobblestone streets and antebellum homes.',
      imageUrl:
        'https://images.unsplash.com/photo-1569974507005-6dc61f97fb5c?w=800&q=80',
    },
    {
      name: 'Charleston Historic District',
      slug: 'charleston-historic-district',
      description:
        "America's most preserved historic city with horse-drawn carriages.",
      imageUrl:
        'https://images.unsplash.com/photo-1569974508324-0c4e5c2c1f1e?w=800&q=80',
    },
    {
      name: 'Mount Pleasant',
      slug: 'mount-pleasant-sc',
      description: 'Historic town with waterfront dining and Patriots Point.',
      imageUrl:
        'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80',
    },
    {
      name: 'Isle of Palms',
      slug: 'isle-of-palms',
      description: 'Beachfront community with luxury homes.',
      imageUrl:
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
    },
    {
      name: 'Sullivans Island',
      slug: 'sullivans-island',
      description: 'Quaint beach town with historic Fort Moultrie.',
      imageUrl:
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80',
    },
    {
      name: 'James Island',
      slug: 'james-island-sc',
      description: 'Island community with Folly Beach access.',
      imageUrl:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    },
    {
      name: 'North Charleston',
      slug: 'north-charleston',
      description:
        'Industrial hub with shopping and the Charleston Naval Base.',
      imageUrl:
        'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&q=80',
    },
    {
      name: 'West Ashley',
      slug: 'west-ashley',
      description: 'Residential area with shopping centers and churches.',
      imageUrl:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
    },
  ],
  'jacksonville-fl': [
    {
      name: 'Jacksonville Beach',
      slug: 'jacksonville-beach',
      description: 'Coastal community with surfing and beachfront promenade.',
      imageUrl:
        'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=80',
    },
    {
      name: 'San Marco',
      slug: 'san-marco-jax',
      description:
        'Historic neighborhood with shops and restaurants around St. Johns River.',
      imageUrl:
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    },
    {
      name: 'Riverside',
      slug: 'riverside-jacksonville',
      description:
        'Historic neighborhood with craftsman homes and Five Points shopping.',
      imageUrl:
        'https://images.unsplash.com/photo-1587578932405-7c740a762f3a?w=800&q=80',
    },
    {
      name: 'Avondale',
      slug: 'avondale-jacksonville',
      description: 'Historic district with bungalows and river views.',
      imageUrl:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
    },
    {
      name: 'Atlantic Beach',
      slug: 'atlantic-beach-fl',
      description: 'Beach community with fishing pier and local dining.',
      imageUrl:
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80',
    },
    {
      name: 'Ponte Vedra Beach',
      slug: 'ponte-vedra-beach',
      description: 'Upscale coastal community with golf courses.',
      imageUrl:
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    },
    {
      name: 'Springfield',
      slug: 'springfield-jacksonville',
      description:
        'Historic neighborhood with Victorian homes being revitalized.',
      imageUrl:
        'https://images.unsplash.com/photo-1579782558504-209a34106519?w=800&q=80',
    },
    {
      name: 'Mandarin',
      slug: 'mandarin-jacksonville',
      description: 'Historic area with plantations and St. Johns River access.',
      imageUrl:
        'https://images.unsplash.com/photo-1566543079657-7756ff1b5d7c?w=800&q=80',
    },
    {
      name: 'Fleming Island',
      slug: 'fleming-island',
      description: 'Suburban community near Orange Park.',
      imageUrl:
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
    },
    {
      name: 'Orange Park',
      slug: 'orange-park-fl',
      description: 'Suburban community with equestrian properties.',
      imageUrl:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    },
  ],
  'columbia-sc': [
    {
      name: 'Downtown Columbia',
      slug: 'downtown-columbia-sc',
      description: 'State capital with government buildings and nightlife.',
      imageUrl:
        'https://images.unsplash.com/photo-1566543079657-7756ff1b5d7c?w=800&q=80',
    },
    {
      name: 'Five Points',
      slug: 'five-points-columbia',
      description: 'Historic student area with shops and restaurants near USC.',
      imageUrl:
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    },
    {
      name: 'Forest Acres',
      slug: 'forest-acres',
      description: 'Historic upscale neighborhood near Fort Jackson.',
      imageUrl:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
    },
    {
      name: 'Shandon',
      slug: 'shandon-columbia',
      description: 'Historic neighborhood with craftsman homes.',
      imageUrl:
        'https://images.unsplash.com/photo-1587578932405-7c740a762f3a?w=800&q=80',
    },
    {
      name: 'Rosewood',
      slug: 'rosewood-columbia',
      description: 'Historic residential area near downtown.',
      imageUrl:
        'https://images.unsplash.com/photo-1579782558504-209a34106519?w=800&q=80',
    },
    {
      name: 'Cayce',
      slug: 'cayce-sc',
      description: 'Suburban community west of Columbia.',
      imageUrl:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    },
    {
      name: 'West Columbia',
      slug: 'west-columbia-sc',
      description: 'Riverside community with dining and breweries.',
      imageUrl:
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    },
    {
      name: 'Lexington',
      slug: 'lexington-sc',
      description: 'Growing suburb west of Columbia.',
      imageUrl:
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
    },
  ],
  'augusta-ga': [
    {
      name: 'Downtown Augusta',
      slug: 'downtown-augusta-ga',
      description:
        'Historic downtown with riverfront and Georgia Regents University.',
      imageUrl:
        'https://images.unsplash.com/photo-1569582963977-45a36620935c?w=800&q=80',
    },
    {
      name: 'Summerville',
      slug: 'summerville-augusta',
      description: 'Historic district with antebellum homes.',
      imageUrl:
        'https://images.unsplash.com/photo-1587578932405-7c740a762f3a?w=800&q=80',
    },
    {
      name: 'North Augusta',
      slug: 'north-augusta-sc',
      description: 'South Carolina community across the Savannah River.',
      imageUrl:
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    },
    {
      name: 'Forest Hills',
      slug: 'forest-hills-augusta',
      description: 'Upscale neighborhood near the Augusta National.',
      imageUrl:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
    },
    {
      name: 'Martinez',
      slug: 'martinez-ga',
      description: 'Suburban community near Fort Eisenhower.',
      imageUrl:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    },
    {
      name: 'Evans',
      slug: 'evans-ga',
      description: 'Growing suburb with shopping centers.',
      imageUrl:
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    },
    {
      name: 'Westlake',
      slug: 'westlake-augusta',
      description: 'Lake community with golf course.',
      imageUrl:
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
    },
  ],
  'macon-ga': [
    {
      name: 'Downtown Macon',
      slug: 'downtown-macon-ga',
      description: 'Historic downtown with music heritage and Ocmulgee River.',
      imageUrl:
        'https://images.unsplash.com/photo-1575893788725-2d7b1bab84f3?w=800&q=80',
    },
    {
      name: 'Tattnall Square',
      slug: 'tattnall-square-macon',
      description: 'Historic neighborhood near Mercer University.',
      imageUrl:
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    },
    {
      name: 'Inglesby',
      slug: 'inglesby-macon',
      description: 'Historic residential area with oak-lined streets.',
      imageUrl:
        'https://images.unsplash.com/photo-1587578932405-7c740a762f3a?w=800&q=80',
    },
    {
      name: 'Vineville',
      slug: 'vineville-macon',
      description: "Upscale neighborhood near the Governor's Mansion.",
      imageUrl:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
    },
    {
      name: 'Warner Robins',
      slug: 'warner-robins-ga',
      description: 'City south of Macon with Air Force base.',
      imageUrl:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    },
    {
      name: 'Macon-Bibb County',
      slug: 'macon-bibb-county',
      description: 'Metro area with growing tech scene.',
      imageUrl:
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    },
    {
      name: 'Riverside',
      slug: 'riverside-macon',
      description: 'Neighborhood along the Ocmulgee River.',
      imageUrl:
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
    },
  ],
  'columbus-ga': [
    {
      name: 'Downtown Columbus',
      slug: 'downtown-columbus-ga',
      description: 'Historic riverfront with Springer Opera House.',
      imageUrl:
        'https://images.unsplash.com/photo-1555466861-1be2453b4f83?w=800&q=80',
    },
    {
      name: 'Phenix City',
      slug: 'phenix-city-al',
      description: 'Alabama community across the Chattahoochee River.',
      imageUrl:
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    },
    {
      name: 'Fort Benning',
      slug: 'fort-benning',
      description: 'Military installation near the Georgia-Alabama border.',
      imageUrl:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    },
    {
      name: 'Midtown Columbus',
      slug: 'midtown-columbus-ga',
      description: 'Residential area with Columbus State University.',
      imageUrl:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
    },
    {
      name: 'North Columbus',
      slug: 'north-columbus-ga',
      description: 'Shopping and residential area near the mall.',
      imageUrl:
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    },
    {
      name: 'Lake Harding',
      slug: 'lake-harding-ga',
      description: 'Lake community with waterfront homes.',
      imageUrl:
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
    },
    {
      name: 'Oxbow Meadows',
      slug: 'oxbow-meadows',
      description: 'Neighborhood near the Oxbow Creek Golf Course.',
      imageUrl:
        'https://images.unsplash.com/photo-1579782558504-209a34106519?w=800&q=80',
    },
  ],
  'hilton-head-island-sc': [
    {
      name: 'Sea Pines',
      slug: 'sea-pines-hilton-head',
      description: 'Prestigious resort community with Harbour Town.',
      imageUrl:
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
    },
    {
      name: 'Palmetto Dunes',
      slug: 'palmetto-dunes',
      description: 'Resort community with golf and tennis.',
      imageUrl:
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80',
    },
    {
      name: 'Port Royal',
      slug: 'port-royal-hilton-head',
      description: 'Historic plantation turned golf resort.',
      imageUrl:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
    },
    {
      name: 'Shipyard',
      slug: 'shipyard-hilton-head',
      description: 'Resort community with beach and tennis.',
      imageUrl:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    },
    {
      name: 'Folly Field',
      slug: 'folly-field-hilton-head',
      description: 'Beach area with oceanfront condos.',
      imageUrl:
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    },
    {
      name: 'Forest Beach',
      slug: 'forest-beach-hilton-head',
      description: 'Neighborhood near Coligny Beach Park.',
      imageUrl:
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
    },
    {
      name: 'Spanish Wells',
      slug: 'spanish-wells-hilton-head',
      description: 'Quiet residential community.',
      imageUrl:
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    },
  ],
  'wilmington-nc': [
    {
      name: 'Downtown Wilmington',
      slug: 'downtown-wilmington-nc',
      description:
        'Historic riverfront with cobblestone streets and galleries.',
      imageUrl:
        'https://images.unsplash.com/photo-1568515045052-58b946f85c08?w=800&q=80',
    },
    {
      name: 'Historic District',
      slug: 'wilmington-historic-district',
      description: 'National Register district with Victorian homes.',
      imageUrl:
        'https://images.unsplash.com/photo-1587578932405-7c740a762f3a?w=800&q=80',
    },
    {
      name: 'Wrightsville Beach',
      slug: 'wrightsville-beach',
      description: 'Beach community popular with college students.',
      imageUrl:
        'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=80',
    },
    {
      name: 'Carolina Beach',
      slug: 'carolina-beach',
      description: 'Beach town with boardwalk and amusement rides.',
      imageUrl:
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80',
    },
    {
      name: 'Kure Beach',
      slug: 'kure-beach',
      description: 'Quiet beach community near Fort Fisher.',
      imageUrl:
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
    },
    {
      name: 'Landfall',
      slug: 'landfall-wilmington',
      description: 'Upscale gated community near Wrightsville Beach.',
      imageUrl:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
    },
    {
      name: 'Mayfaire',
      slug: 'mayfaire-wilmington',
      description: 'Newer community with shopping and dining.',
      imageUrl:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    },
    {
      name: 'Forest Hills',
      slug: 'forest-hills-wilmington',
      description: 'Historic neighborhood with tree-lined streets.',
      imageUrl:
        'https://images.unsplash.com/photo-1579782558504-209a34106519?w=800&q=80',
    },
  ],
  'orlando-fl': [
    {
      name: 'Downtown Orlando',
      slug: 'downtown-orlando',
      description: 'Urban core with nightlife, Lake Eola, and Thornton Park.',
      imageUrl:
        'https://images.unsplash.com/photo-1594729095022-e2f6d2f63f45?w=800&q=80',
    },
    {
      name: 'Winter Park',
      slug: 'winter-park-fl',
      description: 'Upscale suburb with shops, dining, and Rollins College.',
      imageUrl:
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    },
    {
      name: 'Kissimmee',
      slug: 'kissimmee-fl',
      description: 'Tourist area near Disney World with vacation rentals.',
      imageUrl:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    },
    {
      name: 'Dr. Phillips',
      slug: 'dr-phillips-fl',
      description: 'Upsale community near Universal Studios.',
      imageUrl:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
    },
    {
      name: 'College Park',
      slug: 'college-park-orlando',
      description: 'Historic neighborhood near downtown with brick streets.',
      imageUrl:
        'https://images.unsplash.com/photo-1587578932405-7c740a762f3a?w=800&q=80',
    },
    {
      name: 'Thornton Park',
      slug: 'thornton-park',
      description: 'Trendy neighborhood with restaurants and bars.',
      imageUrl:
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    },
    {
      name: 'Maitland',
      slug: 'maitland-fl',
      description: 'Suburb north of Orlando with arts scene.',
      imageUrl:
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
    },
    {
      name: 'Altamonte Springs',
      slug: 'altamonte-springs',
      description: 'Suburban community with shopping centers.',
      imageUrl:
        'https://images.unsplash.com/photo-1579782558504-209a34106519?w=800&q=80',
    },
    {
      name: 'Apopka',
      slug: 'apopka-fl',
      description: 'City north of Orlando known for orange groves.',
      imageUrl:
        'https://images.unsplash.com/photo-1566543079657-7756ff1b5d7c?w=800&q=80',
    },
    {
      name: 'Ocoee',
      slug: 'ocoee-fl',
      description: 'West Orange County suburb with historic downtown.',
      imageUrl:
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    },
  ],
  'charlotte-nc': [
    {
      name: 'Uptown Charlotte',
      slug: 'uptown-charlotte',
      description:
        'Urban core with skyscrapers, Panthers stadium, and nightlife.',
      imageUrl:
        'https://images.unsplash.com/photo-1568527353631-7f02d8b0c4f5?w=800&q=80',
    },
    {
      name: 'South End',
      slug: 'south-end-charlotte',
      description: 'Trendy neighborhood with breweries and light rail access.',
      imageUrl:
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    },
    {
      name: 'NoDa',
      slug: 'noda-charlotte',
      description: 'Arts district with galleries and live music.',
      imageUrl:
        'https://images.unsplash.com/photo-1587578932405-7c740a762f3a?w=800&q=80',
    },
    {
      name: 'Myers Park',
      slug: 'myers-park-charlotte',
      description: 'Historic upscale neighborhood with tree-lined streets.',
      imageUrl:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
    },
    {
      name: 'Dilworth',
      slug: 'dilworth-charlotte',
      description: 'Historic neighborhood near downtown with bungalows.',
      imageUrl:
        'https://images.unsplash.com/photo-1579782558504-209a34106519?w=800&q=80',
    },
    {
      name: 'Plaza Midwood',
      slug: 'plaza-midwood',
      description: 'Diverse neighborhood with restaurants and shops.',
      imageUrl:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    },
    {
      name: 'Elizabeth',
      slug: 'elizabeth-charlotte',
      description: 'Historic neighborhood near Carolinas Medical Center.',
      imageUrl:
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    },
    {
      name: 'SouthPark',
      slug: 'southpark-charlotte',
      description: 'Upscale shopping and residential area.',
      imageUrl:
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
    },
    {
      name: 'Cotswold',
      slug: 'cotswold-charlotte',
      description: 'Suburban neighborhood with Cotswold Mall.',
      imageUrl:
        'https://images.unsplash.com/photo-1566543079657-7756ff1b5d7c?w=800&q=80',
    },
    {
      name: 'Ballantyne',
      slug: 'ballantyne-charlotte',
      description: 'Upscale south Charlotte community with golf.',
      imageUrl:
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    },
  ],
  'atlanta-ga': [
    {
      name: 'Downtown Atlanta',
      slug: 'downtown-atlanta',
      description:
        'Urban core with CNN Center, Mercedes-Benz Stadium, and Centennial Olympic Park.',
      imageUrl:
        'https://images.unsplash.com/photo-1569974508324-0c4e5c2c1f1e?w=800&q=80',
    },
    {
      name: 'Midtown Atlanta',
      slug: 'midtown-atlanta',
      description: 'Arts district with Piedmont Park and the High Museum.',
      imageUrl:
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    },
    {
      name: 'Buckhead',
      slug: 'buckhead-atlanta',
      description: 'Upscale neighborhood with shopping and restaurants.',
      imageUrl:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
    },
    {
      name: 'Virginia Highland',
      slug: 'virginia-highland',
      description: 'Historic neighborhood with shops and nightlife on VaHi.',
      imageUrl:
        'https://images.unsplash.com/photo-1587578932405-7c740a762f3a?w=800&q=80',
    },
    {
      name: 'Inman Park',
      slug: 'inman-park',
      description:
        'Historic neighborhood with Victorian homes and Krog Street Market.',
      imageUrl:
        'https://images.unsplash.com/photo-1579782558504-209a34106519?w=800&q=80',
    },
    {
      name: 'Decatur',
      slug: 'decatur-ga',
      description:
        'City east of Atlanta with Emory University and Agnes Scott College.',
      imageUrl:
        'https://images.unsplash.com/photo-1566543079657-7756ff1b5d7c?w=800&q=80',
    },
    {
      name: 'Atlanta Beltline',
      slug: 'atlanta-beltline',
      description:
        'Trails and parks connecting neighborhoods on former rail lines.',
      imageUrl:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    },
    {
      name: 'Old Fourth Ward',
      slug: 'old-fourth-ward',
      description:
        'Historic neighborhood being revitalized near Ponce City Market.',
      imageUrl:
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    },
    {
      name: 'Atlanta Airport',
      slug: 'atlanta-airport',
      description:
        'Area around Hartsfield-Jackson Atlanta International Airport.',
      imageUrl:
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
    },
    {
      name: 'Sandy Springs',
      slug: 'sandy-springs-ga',
      description: 'Affluent city north of Atlanta with Perimeter Mall.',
      imageUrl:
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    },
  ],
  'beaufort-sc': [
    {
      name: 'Downtown Beaufort',
      slug: 'downtown-beaufort-sc',
      description:
        'Historic waterfront with antebellum homes and art galleries.',
      imageUrl:
        'https://images.unsplash.com/photo-1540914124281-342587941389?w=800&q=80',
    },
    {
      name: 'Beaufort Historic District',
      slug: 'beaufort-historic-district',
      description: 'National Register district with preserved architecture.',
      imageUrl:
        'https://images.unsplash.com/photo-1587578932405-7c740a762f3a?w=800&q=80',
    },
    {
      name: 'Port Royal',
      slug: 'port-royal-sc',
      description: 'Historic town with Marine Air Base.',
      imageUrl:
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    },
    {
      name: "Lady's Island",
      slug: 'ladys-island-sc',
      description: 'Island community with golf courses and marshes.',
      imageUrl:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    },
    {
      name: 'Fripp Island',
      slug: 'fripp-island',
      description: 'Private beach island with golf resort.',
      imageUrl:
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
    },
    {
      name: 'Hunting Island',
      slug: 'hunting-island',
      description: 'State park with lighthouse and beach.',
      imageUrl:
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80',
    },
    {
      name: 'St. Helena Island',
      slug: 'st-helena-island-sc',
      description: 'Gullah Geechee community with heritage sites.',
      imageUrl:
        'https://images.unsplash.com/photo-1579782558504-209a34106519?w=800&q=80',
    },
  ],
  'brunswick-ga': [
    {
      name: 'Downtown Brunswick',
      slug: 'downtown-brunswick-ga',
      description: 'Historic waterfront with Victorian architecture.',
      imageUrl:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
    },
    {
      name: 'Glynn County',
      slug: 'glynn-county',
      description: 'Coastal county with Jekyll Island and St. Simons Island.',
      imageUrl:
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
    },
    {
      name: 'St. Simons Island',
      slug: 'st-simons-island',
      description: 'Popular barrier island with golf and beaches.',
      imageUrl:
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80',
    },
    {
      name: 'Jekyll Island',
      slug: 'jekyll-island',
      description: 'State park island with historic club and beaches.',
      imageUrl:
        'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=80',
    },
    {
      name: 'Sea Island',
      slug: 'sea-island-ga',
      description: 'Luxury resort community with The Cloisters.',
      imageUrl:
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    },
    {
      name: 'St. Simons Village',
      slug: 'st-simons-village',
      description: 'Village area with shops and restaurants.',
      imageUrl:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
    },
  ],
  'gainesville-fl': [
    {
      name: 'Downtown Gainesville',
      slug: 'downtown-gainesville-fl',
      description:
        'Urban core with University of Florida and historic buildings.',
      imageUrl:
        'https://images.unsplash.com/photo-1562783487-623d90387097?w=800&q=80',
    },
    {
      name: 'University of Florida',
      slug: 'university-florida-gainesville',
      description: 'Campus area with Gator sports and student life.',
      imageUrl:
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    },
    {
      name: 'Midtown Gainesville',
      slug: 'midtown-gainesville',
      description: 'Neighborhood near UF with shops and restaurants.',
      imageUrl:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    },
    {
      name: 'Haile Plantation',
      slug: 'haile-plantation',
      description: 'Suburban community with golf course and shops.',
      imageUrl:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
    },
    {
      name: 'Arbor Greene',
      slug: 'arbor-greene',
      description: 'Newer community with amenities and parks.',
      imageUrl:
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    },
    {
      name: 'Duck Lake',
      slug: 'duck-lake-gainesville',
      description: 'Neighborhood near Paynes Prairie.',
      imageUrl:
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
    },
    {
      name: 'Kanapaha',
      slug: 'kanapaha-gainesville',
      description: 'Residential area near the botanical gardens.',
      imageUrl:
        'https://images.unsplash.com/photo-1579782558504-209a34106519?w=800&q=80',
    },
    {
      name: 'High Springs',
      slug: 'high-springs-fl',
      description: 'Town north of Gainesville with springs and caves.',
      imageUrl:
        'https://images.unsplash.com/photo-1566543079657-7756ff1b5d7c?w=800&q=80',
    },
  ],
  'tallahassee-fl': [
    {
      name: 'Downtown Tallahassee',
      slug: 'downtown-tallahassee',
      description:
        'State capital with government buildings and Florida State University.',
      imageUrl:
        'https://images.unsplash.com/photo-1574169208507-84376144848b?w=800&q=80',
    },
    {
      name: 'Florida State University',
      slug: 'fsu-tallahassee',
      description: 'Campus area near Doak Campbell Stadium.',
      imageUrl:
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    },
    {
      name: 'Florida A&M University',
      slug: 'famu-tallahassee',
      description: 'Historic HBCU campus area.',
      imageUrl:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    },
    {
      name: 'Frenchtown',
      slug: 'frenchtown-tallahassee',
      description: 'Historic African American neighborhood.',
      imageUrl:
        'https://images.unsplash.com/photo-1587578932405-7c740a762f3a?w=800&q=80',
    },
    {
      name: 'Midtown Tallahassee',
      slug: 'midtown-tallahassee',
      description: 'Residential area with shops and restaurants.',
      imageUrl:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
    },
    {
      name: 'Killearn',
      slug: 'killearn-tallahassee',
      description: 'Suburban community in northeast Tallahassee.',
      imageUrl:
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    },
    {
      name: 'Southwood',
      slug: 'southwood-tallahassee',
      description: 'Planned community with trails and parks.',
      imageUrl:
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
    },
    {
      name: 'Lake Jackson',
      slug: 'lake-jackson-tallahassee',
      description: 'Lake community with natural beauty.',
      imageUrl:
        'https://images.unsplash.com/photo-1579782558504-209a34106519?w=800&q=80',
    },
  ],
  'athens-ga': [
    {
      name: 'Downtown Athens',
      slug: 'downtown-athens-ga',
      description: 'Music scene, University of Georgia, and college bars.',
      imageUrl:
        'https://images.unsplash.com/photo-1568972547244-8a1e6cb4f9f9?w=800&q=80',
    },
    {
      name: 'University of Georgia',
      slug: 'university-georgia-athens',
      description: 'Campus area with Sanford Stadium and Dawgs.',
      imageUrl:
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    },
    {
      name: 'Five Points',
      slug: 'five-points-athens',
      description: 'Neighborhood near UGA with shops and restaurants.',
      imageUrl:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    },
    {
      name: 'Normaltown',
      slug: 'normaltown-athens',
      description: 'Trendy neighborhood with new developments.',
      imageUrl:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
    },
    {
      name: 'Boulevard',
      slug: 'boulevard-athens',
      description: 'Historic residential area with large homes.',
      imageUrl:
        'https://images.unsplash.com/photo-1587578932405-7c740a762f3a?w=800&q=80',
    },
    {
      name: 'Cobbham',
      slug: 'cobbham-athens',
      description: 'Historic neighborhood near downtown.',
      imageUrl:
        'https://images.unsplash.com/photo-1579782558504-209a34106519?w=800&q=80',
    },
    {
      name: 'Woodlands',
      slug: 'woodlands-athens',
      description: 'Newer community with golf course.',
      imageUrl:
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    },
    {
      name: 'Hawthorne',
      slug: 'hawthorne-athens',
      description: 'Suburban community south of Athens.',
      imageUrl:
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
    },
  ],
};

const SLEEP_MS = 100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
          description: `Welcome to ${cityData.name}. Connect with locals, share news, and discover what's happening in your community.`,
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
        userCommunity = c;
        console.log(`  ✓ Exists: ${userConfig.community.name}`);
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

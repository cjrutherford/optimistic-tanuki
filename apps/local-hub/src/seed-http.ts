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
  description: string;
  highlights: string[];
  timezone: string;
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
      description:
        "Georgia's first city enchants visitors with 22 moss-draped historic squares, cobblestone streets, stunning antebellum mansions, Forsyth Park, and a thriving arts and culinary scene.",
      highlights: [
        'https://images.unsplash.com/photo-1587578932405-7c740a762f3a?w=800&q=80',
        'https://images.unsplash.com/photo-1579782558504-209a34106519?w=800&q=80',
        'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=80',
      ],
      timezone: 'America/New_York',
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
      description:
        "One of America's most beautiful cities, Charleston captivates with colorful antebellum homes on Rainbow Row, horse-drawn carriage tours, world-class dining, and the historic Battery waterfront.",
      highlights: [
        'https://images.unsplash.com/photo-1569974508324-0c4e5c2c1f1e?w=800&q=80',
        'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
      ],
      timezone: 'America/New_York',
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
      description:
        "Florida's largest city by area offers 22 miles of Atlantic beaches, a vibrant downtown riverfront along the St. Johns River, thriving arts districts, and year-round outdoor recreation.",
      highlights: [
        'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=80',
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
        'https://images.unsplash.com/photo-1587578932405-7c740a762f3a?w=800&q=80',
      ],
      timezone: 'America/New_York',
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
      description:
        "South Carolina's capital blends state government, the University of South Carolina's campus energy, a growing food scene along the Congaree River, and rich Civil War history.",
      highlights: [
        'https://images.unsplash.com/photo-1566543079657-7756ff1b5d7c?w=800&q=80',
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
      ],
      timezone: 'America/New_York',
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
      description:
        'Host of the Masters Golf Tournament, Augusta combines world-class golf at Augusta National with a revitalized Riverwalk downtown, a growing medical district, and deep Southern charm.',
      highlights: [
        'https://images.unsplash.com/photo-1569582963977-45a36620935c?w=800&q=80',
        'https://images.unsplash.com/photo-1587578932405-7c740a762f3a?w=800&q=80',
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
      ],
      timezone: 'America/New_York',
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
      description:
        "Georgia's music city is the birthplace of Otis Redding, Little Richard, and the Allman Brothers Band, paired with the ancient Ocmulgee National Monument and world-famous cherry blossom festivals.",
      highlights: [
        'https://images.unsplash.com/photo-1575893788725-2d7b1bab84f3?w=800&q=80',
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
        'https://images.unsplash.com/photo-1587578932405-7c740a762f3a?w=800&q=80',
      ],
      timezone: 'America/New_York',
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
      description:
        'Home to Fort Moore, Columbus features the world\'s longest urban whitewater rafting course on the Chattahoochee River, a thriving Midtown arts district, and the National Infantry Museum.',
      highlights: [
        'https://images.unsplash.com/photo-1555466861-1be2453f4f83?w=800&q=80',
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
      ],
      timezone: 'America/New_York',
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
      description:
        'A barrier island gem renowned for world-class golf resorts, 12 miles of pristine Atlantic beach, the iconic Harbour Town lighthouse, and abundant water sports and nature trails.',
      highlights: [
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80',
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
      ],
      timezone: 'America/New_York',
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
      description:
        "North Carolina's largest coastal city boasts a stunning riverfront historic district, three barrier island beaches, a booming film industry backdrop, and the WWII battleship USS North Carolina.",
      highlights: [
        'https://images.unsplash.com/photo-1568515045052-58b946f85c08?w=800&q=80',
        'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=80',
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80',
      ],
      timezone: 'America/New_York',
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
      description:
        "Beyond the theme parks, Orlando is a thriving metro hub with world-class dining, Lake Eola's scenic downtown, a booming tech industry, and easy access to the Space Coast.",
      highlights: [
        'https://images.unsplash.com/photo-1594729095022-e2f6d2f63f45?w=800&q=80',
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
      ],
      timezone: 'America/New_York',
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
      description:
        "The Queen City is the Southeast's banking capital with Uptown's gleaming skyline, the Panthers and Hornets franchises, vibrant South End and NoDa neighborhoods, and the US National Whitewater Center.",
      highlights: [
        'https://images.unsplash.com/photo-1568527353631-7f02d8b0c4f5?w=800&q=80',
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
        'https://images.unsplash.com/photo-1587578932405-7c740a762f3a?w=800&q=80',
      ],
      timezone: 'America/New_York',
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
      description:
        "The cultural capital of the South is a cosmopolitan mega-city with world-class museums, the Georgia Aquarium, the birthplace of the civil-rights movement, top universities, and a legendary food and music scene.",
      highlights: [
        'https://images.unsplash.com/photo-1569974508324-0c4e5c2c1f1e?w=800&q=80',
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
      ],
      timezone: 'America/New_York',
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
      description:
        "The jewel of the Lowcountry, Beaufort's antebellum mansions, Spanish moss-draped live oaks, Gullah Geechee cultural heritage, and waterfront setting make it one of the South's most picturesque small cities.",
      highlights: [
        'https://images.unsplash.com/photo-1540914124281-342587941389?w=800&q=80',
        'https://images.unsplash.com/photo-1587578932405-7c740a762f3a?w=800&q=80',
        'https://images.unsplash.com/photo-1579782558504-209a34106519?w=800&q=80',
      ],
      timezone: 'America/New_York',
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
      description:
        'Gateway to the Golden Isles, Brunswick is a historic port city with a charming Victorian downtown, fresh seafood straight off the dock, and easy access to Jekyll, St. Simons, and Sea islands.',
      highlights: [
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
      ],
      timezone: 'America/New_York',
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
      description:
        "Home to the University of Florida and Gator Nation, Gainesville is a dynamic college city surrounded by natural springs, Paynes Prairie State Preserve, and a lively arts and live-music scene.",
      highlights: [
        'https://images.unsplash.com/photo-1562783487-623d90387097?w=800&q=80',
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
      ],
      timezone: 'America/New_York',
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
      description:
        "Florida's capital city is home to Florida State University and FAMU, the historic capitol buildings, Cascades Park, and a beautiful canopy road network of ancient oaks draped in Spanish moss.",
      highlights: [
        'https://images.unsplash.com/photo-1574169208507-84376144848b?w=800&q=80',
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
      ],
      timezone: 'America/New_York',
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
      description:
        'The Classic City is the home of the UGA Bulldogs and one of the top music towns in America—birthplace of R.E.M. and the B-52s—with a thriving downtown bar scene, eclectic eateries, and classic collegiate energy.',
      highlights: [
        'https://images.unsplash.com/photo-1568972547244-8a1e6cb4f9f9?w=800&q=80',
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
      ],
      timezone: 'America/New_York',
    },
    {
      name: 'Hinesville, GA',
      slug: 'hinesville-ga',
      localityType: 'city',
      city: 'Hinesville',
      state: 'GA',
      lat: 31.8468,
      lng: -81.5957,
      population: 34249,
      imageUrl:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
      description:
        'Home to Fort Stewart, the largest Army installation east of the Mississippi, Hinesville is a welcoming military community with affordable living, growing retail, and easy access to the Georgia coast.',
      highlights: [
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
      ],
      timezone: 'America/New_York',
    },
    {
      name: 'Richmond Hill, GA',
      slug: 'richmond-hill-ga',
      localityType: 'city',
      city: 'Richmond Hill',
      state: 'GA',
      lat: 31.9385,
      lng: -81.3018,
      population: 14259,
      imageUrl:
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
      description:
        "One of the fastest-growing cities in Georgia, Richmond Hill offers scenic Ogeechee River access, excellent Bryan County schools, a charming downtown, and a short drive to both Savannah and the Golden Isles.",
      highlights: [
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
      ],
      timezone: 'America/New_York',
    },
    {
      name: 'Rincon, GA',
      slug: 'rincon-ga',
      localityType: 'city',
      city: 'Rincon',
      state: 'GA',
      lat: 32.2949,
      lng: -81.2357,
      population: 11039,
      imageUrl:
        'https://images.unsplash.com/photo-1566543079657-7756ff1b5d7c?w=800&q=80',
      description:
        'A rapidly expanding bedroom community in Effingham County northwest of Savannah, Rincon offers affordable new construction homes, top-rated public schools, and quiet suburban living with easy I-95 access.',
      highlights: [
        'https://images.unsplash.com/photo-1566543079657-7756ff1b5d7c?w=800&q=80',
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
      ],
      timezone: 'America/New_York',
    },
    {
      name: 'Bluffton, SC',
      slug: 'bluffton-sc',
      localityType: 'city',
      city: 'Bluffton',
      state: 'SC',
      lat: 32.2371,
      lng: -80.8601,
      population: 28204,
      imageUrl:
        'https://images.unsplash.com/photo-1540914124281-342587941389?w=800&q=80',
      description:
        "Tucked along the May River, Bluffton's charming Old Town district—lined with live oaks and artisan galleries—sits at the gateway to Hilton Head Island, offering authentic Lowcountry living with a small-town feel.",
      highlights: [
        'https://images.unsplash.com/photo-1540914124281-342587941389?w=800&q=80',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
        'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80',
      ],
      timezone: 'America/New_York',
    },
    {
      name: 'Statesboro, GA',
      slug: 'statesboro-ga',
      localityType: 'city',
      city: 'Statesboro',
      state: 'GA',
      lat: 32.4488,
      lng: -81.7832,
      population: 33521,
      imageUrl:
        'https://images.unsplash.com/photo-1568972547244-8a1e6cb4f9f9?w=800&q=80',
      description:
        'Home to Georgia Southern University and the Eagle Nation, Statesboro is a vibrant college town with a growing local food and arts scene, surrounded by farmland just an hour from the Georgia coast.',
      highlights: [
        'https://images.unsplash.com/photo-1568972547244-8a1e6cb4f9f9?w=800&q=80',
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
      ],
      timezone: 'America/New_York',
    },
    {
      name: 'St. Simons Island, GA',
      slug: 'st-simons-island-ga',
      localityType: 'city',
      city: 'St. Simons Island',
      state: 'GA',
      lat: 31.1535,
      lng: -81.3966,
      population: 13381,
      imageUrl:
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80',
      description:
        "One of Georgia's most beloved barrier islands features a storied lighthouse, bike-friendly roads through live oak canopies, the historic Fort Frederica National Monument, and a quaint Village dining district.",
      highlights: [
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
        'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=80',
      ],
      timezone: 'America/New_York',
    },
    {
      name: 'Fernandina Beach, FL',
      slug: 'fernandina-beach-fl',
      localityType: 'city',
      city: 'Fernandina Beach',
      state: 'FL',
      lat: 30.6719,
      lng: -81.4623,
      population: 13490,
      imageUrl:
        'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=80',
      description:
        "Amelia Island's charming Victorian seaport boasts the largest concentration of Victorian-era structures in Florida, pristine beaches, a booming craft-beer scene, and a proud shrimping heritage.",
      highlights: [
        'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=80',
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80',
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
      ],
      timezone: 'America/New_York',
    },
    {
      name: 'St. Augustine, FL',
      slug: 'st-augustine-fl',
      localityType: 'city',
      city: 'St. Augustine',
      state: 'FL',
      lat: 29.8944,
      lng: -81.315,
      population: 14479,
      imageUrl:
        'https://images.unsplash.com/photo-1579782558504-209a34106519?w=800&q=80',
      description:
        "The oldest continuously occupied European settlement in the U.S. enchants with Spanish Colonial architecture, the ancient Castillo de San Marcos, cobblestone St. George Street, and beautiful Atlantic beach communities.",
      highlights: [
        'https://images.unsplash.com/photo-1579782558504-209a34106519?w=800&q=80',
        'https://images.unsplash.com/photo-1587578932405-7c740a762f3a?w=800&q=80',
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80',
      ],
      timezone: 'America/New_York',
    },
    {
      name: 'Valdosta, GA',
      slug: 'valdosta-ga',
      localityType: 'city',
      city: 'Valdosta',
      state: 'GA',
      lat: 30.8327,
      lng: -83.2785,
      population: 57597,
      imageUrl:
        'https://images.unsplash.com/photo-1566543079657-7756ff1b5d7c?w=800&q=80',
      description:
        "Georgia's Azalea City near the Florida border is home to Valdosta State University, Wild Adventures Theme Park, a revitalized historic downtown, and a passionate community identity around Wildcat athletics.",
      highlights: [
        'https://images.unsplash.com/photo-1566543079657-7756ff1b5d7c?w=800&q=80',
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
      ],
      timezone: 'America/New_York',
    },
    {
      name: 'Florence, SC',
      slug: 'florence-sc',
      localityType: 'city',
      city: 'Florence',
      state: 'SC',
      lat: 34.1954,
      lng: -79.7626,
      population: 37756,
      imageUrl:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
      description:
        "A growing regional center in the Pee Dee region, Florence is known for its I-95 commerce, the McLeod Health medical campus, a vibrant arts center, and convenient access to both Columbia and the Grand Strand coast.",
      highlights: [
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
      ],
      timezone: 'America/New_York',
    },
    {
      name: 'Myrtle Beach, SC',
      slug: 'myrtle-beach-sc',
      localityType: 'city',
      city: 'Myrtle Beach',
      state: 'SC',
      lat: 33.6891,
      lng: -78.8867,
      population: 35682,
      imageUrl:
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
      description:
        'The Grand Strand stretches 60 miles of Atlantic coastline offering world-class golf, a vibrant Boardwalk, Broadway at the Beach entertainment complex, fresh seafood, and endless family and nightlife attractions.',
      highlights: [
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
        'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=80',
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80',
      ],
      timezone: 'America/New_York',
    },
    {
      name: 'Fayetteville, NC',
      slug: 'fayetteville-nc',
      localityType: 'city',
      city: 'Fayetteville',
      state: 'NC',
      lat: 35.0527,
      lng: -78.8784,
      population: 211657,
      imageUrl:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
      description:
        'Home to Fort Liberty (formerly Fort Bragg), the largest military installation in the world by population, Fayetteville is a patriotic community with a reborn downtown, the 82nd Airborne Division Museum, and Cape Fear River access.',
      highlights: [
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
        'https://images.unsplash.com/photo-1566543079657-7756ff1b5d7c?w=800&q=80',
      ],
      timezone: 'America/New_York',
    },
    {
      name: 'Daytona Beach, FL',
      slug: 'daytona-beach-fl',
      localityType: 'city',
      city: 'Daytona Beach',
      state: 'FL',
      lat: 29.2108,
      lng: -81.0228,
      population: 73782,
      imageUrl:
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80',
      description:
        'The World Center of Racing is famous for the Daytona 500, Bike Week, 23 miles of hard-packed Atlantic beach, the historic Daytona Beach Bandshell, and Daytona International Speedway.',
      highlights: [
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80',
        'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=80',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
      ],
      timezone: 'America/New_York',
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
        'The heart of Savannah with 22 historic squares, cobblestone streets, and antebellum architecture dating to 1733.',
      imageUrl:
        'https://images.unsplash.com/photo-1587578932405-7c740a762f3a?w=800&q=80',
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
  'hinesville-ga': [
    {
      name: 'Fort Stewart',
      slug: 'fort-stewart-ga',
      description:
        'The largest Army installation east of the Mississippi, home to the 3rd Infantry Division.',
      imageUrl:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    },
    {
      name: 'Downtown Hinesville',
      slug: 'downtown-hinesville-ga',
      description:
        'A growing downtown with shops, restaurants, and family-friendly events near Memorial Drive.',
      imageUrl:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
    },
    {
      name: 'Flemington',
      slug: 'flemington-ga',
      description:
        'Family-friendly community adjacent to Hinesville with newer subdivisions and parks.',
      imageUrl:
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    },
    {
      name: 'Midway',
      slug: 'midway-ga',
      description:
        'Small historic town in Liberty County featuring the colonial-era Midway Church and museum.',
      imageUrl:
        'https://images.unsplash.com/photo-1587578932405-7c740a762f3a?w=800&q=80',
    },
    {
      name: 'Walthourville',
      slug: 'walthourville-ga',
      description:
        'Quiet residential community in Liberty County near Fort Stewart.',
      imageUrl:
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    },
  ],
  'richmond-hill-ga': [
    {
      name: 'Downtown Richmond Hill',
      slug: 'downtown-richmond-hill-ga',
      description:
        'Charming small downtown with restaurants, boutiques, and community events along Ford Avenue.',
      imageUrl:
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
    },
    {
      name: 'Ford Plantation',
      slug: 'ford-plantation-ga',
      description:
        "Henry Ford's historic winter estate, now an exclusive gated community with golf and equestrian facilities.",
      imageUrl:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
    },
    {
      name: 'Sterling Creek',
      slug: 'sterling-creek-richmond-hill',
      description:
        'A popular newer subdivision offering family-friendly amenities and excellent Bryan County schools.',
      imageUrl:
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    },
    {
      name: 'Waterways',
      slug: 'waterways-richmond-hill',
      description:
        'Upscale waterfront community with a marina and boat access to the Ogeechee River.',
      imageUrl:
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    },
  ],
  'rincon-ga': [
    {
      name: 'Downtown Rincon',
      slug: 'downtown-rincon-ga',
      description:
        'The commercial heart of Effingham County with local eateries, shops, and community festivals.',
      imageUrl:
        'https://images.unsplash.com/photo-1566543079657-7756ff1b5d7c?w=800&q=80',
    },
    {
      name: 'Goshen Plantation',
      slug: 'goshen-plantation-rincon',
      description:
        'Established master-planned community with top-rated Effingham County schools and amenity center.',
      imageUrl:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
    },
    {
      name: 'Springfield',
      slug: 'springfield-ga',
      description:
        "Effingham County's seat, a quiet historic town with the Heritage Museum and courthouse square.",
      imageUrl:
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    },
  ],
  'bluffton-sc': [
    {
      name: 'Old Town Bluffton',
      slug: 'old-town-bluffton-sc',
      description:
        'A walkable, live-oak-shaded arts district along the May River with galleries, cafes, and the historic Church of the Cross.',
      imageUrl:
        'https://images.unsplash.com/photo-1540914124281-342587941389?w=800&q=80',
    },
    {
      name: 'Sun City Hilton Head',
      slug: 'sun-city-hilton-head',
      description:
        'Del Webb active-adult community with three golf courses and a full amenity center.',
      imageUrl:
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
    },
    {
      name: 'Hampton Lake',
      slug: 'hampton-lake-bluffton',
      description:
        'Luxury lakefront community featuring a 165-acre freshwater lake and floating boathouse.',
      imageUrl:
        'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80',
    },
    {
      name: 'Palmetto Bluff',
      slug: 'palmetto-bluff-sc',
      description:
        'Iconic 20,000-acre resort community with a village center, Inn at Palmetto Bluff, and nature trails.',
      imageUrl:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    },
    {
      name: 'Buckwalter',
      slug: 'buckwalter-bluffton',
      description:
        'Vibrant mixed-use corridor with the Bluffton Recreation Center and growing retail.',
      imageUrl:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
    },
  ],
  'statesboro-ga': [
    {
      name: 'Downtown Statesboro',
      slug: 'downtown-statesboro-ga',
      description:
        'College-town downtown with local restaurants, shops, and live music centered around Georgia Southern University.',
      imageUrl:
        'https://images.unsplash.com/photo-1568972547244-8a1e6cb4f9f9?w=800&q=80',
    },
    {
      name: 'Georgia Southern University',
      slug: 'georgia-southern-statesboro',
      description:
        'The heart of Statesboro — home to the Eagle Nation, Paulson Stadium, and a thriving student community.',
      imageUrl:
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    },
    {
      name: 'Statesboro Mall Area',
      slug: 'statesboro-mall-area',
      description:
        'Major retail and dining corridor serving Bulloch County with national and local businesses.',
      imageUrl:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    },
    {
      name: 'Portal',
      slug: 'portal-ga',
      description:
        'Small Bulloch County community known for strong agriculture and close-knit community spirit.',
      imageUrl:
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    },
  ],
  'st-simons-island-ga': [
    {
      name: 'St. Simons Village',
      slug: 'st-simons-village-ga',
      description:
        'The charming village hub of the island with pier, shops, restaurants, and a classic seaside atmosphere.',
      imageUrl:
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80',
    },
    {
      name: 'East Beach',
      slug: 'east-beach-st-simons',
      description:
        "The island's Atlantic-facing beach community with the historic Coast Guard Station.",
      imageUrl:
        'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=80',
    },
    {
      name: 'Retreat Plantation',
      slug: 'retreat-plantation-st-simons',
      description:
        'Historic plantation site now home to Sea Island Golf Club on the northern end of St. Simons.',
      imageUrl:
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
    },
    {
      name: 'Frederica',
      slug: 'frederica-st-simons',
      description:
        'Upscale residential community near Fort Frederica National Monument and Christ Church.',
      imageUrl:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
    },
  ],
  'fernandina-beach-fl': [
    {
      name: 'Historic Downtown Fernandina Beach',
      slug: 'historic-downtown-fernandina-beach',
      description:
        'The Victorian heart of Amelia Island with Centre Street boutiques, seafood restaurants, and eight flags of history.',
      imageUrl:
        'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=80',
    },
    {
      name: 'Amelia Island Plantation',
      slug: 'amelia-island-plantation',
      description:
        'Landmark resort community on the south end with golf, tennis, beach access, and the Omni Amelia Island Resort.',
      imageUrl:
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80',
    },
    {
      name: 'Summer Beach',
      slug: 'summer-beach-fl',
      description:
        'Quiet residential community on southern Amelia Island near Fort Clinch State Park.',
      imageUrl:
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
    },
    {
      name: 'Yulee',
      slug: 'yulee-fl',
      description:
        'Fast-growing Nassau County mainland community with shopping and easy I-95 access to Jacksonville.',
      imageUrl:
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    },
  ],
  'st-augustine-fl': [
    {
      name: 'St. George Street Historic District',
      slug: 'st-george-street-st-augustine',
      description:
        "The pedestrian spine of the nation's oldest city, lined with colonial Spanish buildings, galleries, and restaurants.",
      imageUrl:
        'https://images.unsplash.com/photo-1579782558504-209a34106519?w=800&q=80',
    },
    {
      name: 'Anastasia Island',
      slug: 'anastasia-island-fl',
      description:
        'Barrier island home to St. Augustine Beach, the Alligator Farm, and Anastasia State Park.',
      imageUrl:
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80',
    },
    {
      name: 'Vilano Beach',
      slug: 'vilano-beach-fl',
      description:
        'A quiet beachfront community north of the inlet with stunning sunrise views and a growing dining scene.',
      imageUrl:
        'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=80',
    },
    {
      name: 'Lincolnville',
      slug: 'lincolnville-st-augustine',
      description:
        "Historic African American neighborhood listed on the National Register of Historic Places with the Lincolnville Museum.",
      imageUrl:
        'https://images.unsplash.com/photo-1587578932405-7c740a762f3a?w=800&q=80',
    },
    {
      name: 'Ponte Vedra',
      slug: 'ponte-vedra-fl',
      description:
        'Upscale coastal community south of Jacksonville known for world-class golf and the PGA Tour headquarters.',
      imageUrl:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
    },
  ],
  'valdosta-ga': [
    {
      name: 'Downtown Valdosta',
      slug: 'downtown-valdosta-ga',
      description:
        'A revitalized historic downtown with the Ashley Street Corridor, local dining, and beautiful azalea gardens.',
      imageUrl:
        'https://images.unsplash.com/photo-1566543079657-7756ff1b5d7c?w=800&q=80',
    },
    {
      name: 'Valdosta State University',
      slug: 'vsu-valdosta',
      description:
        'The campus community around VSU and Blazer athletics in the heart of South Georgia.',
      imageUrl:
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    },
    {
      name: 'Lake Park',
      slug: 'lake-park-ga',
      description:
        'Small community on I-75 near the Florida border, popular for outlet shopping and Eagle Lake.',
      imageUrl:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    },
    {
      name: 'Lowndes County',
      slug: 'lowndes-county-ga',
      description:
        'The greater county area surrounding Valdosta with agriculture, new development, and community events.',
      imageUrl:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
    },
  ],
  'florence-sc': [
    {
      name: 'Downtown Florence',
      slug: 'downtown-florence-sc',
      description:
        'A revitalized urban core with the Florence Center, boutique shops, and the Florence Railroad Museum.',
      imageUrl:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    },
    {
      name: 'Palmetto Place',
      slug: 'palmetto-place-florence',
      description:
        'Growing residential and commercial corridor in west Florence with new construction and retail.',
      imageUrl:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
    },
    {
      name: 'Timrod Park',
      slug: 'timrod-park-florence',
      description:
        "Florence's historic neighborhood park area with the Timrod Library and classic Southern homes.",
      imageUrl:
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    },
    {
      name: 'Quinby',
      slug: 'quinby-sc',
      description:
        'Small incorporated town within the greater Florence area with a tight-knit community feel.',
      imageUrl:
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    },
  ],
  'myrtle-beach-sc': [
    {
      name: 'Downtown Myrtle Beach',
      slug: 'downtown-myrtle-beach-sc',
      description:
        'The energetic center of the Grand Strand with the iconic Boardwalk, SkyWheel, and ocean boulevard entertainment.',
      imageUrl:
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
    },
    {
      name: 'North Myrtle Beach',
      slug: 'north-myrtle-beach-sc',
      description:
        'Beloved beach city home to the Shag dance, Oak Island, and a quieter beachfront atmosphere.',
      imageUrl:
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80',
    },
    {
      name: 'Pawleys Island',
      slug: 'pawleys-island-sc',
      description:
        'Arrogantly Shabby™ is the motto of this charming low-key barrier island south of Myrtle Beach on the Hammock Coast.',
      imageUrl:
        'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=80',
    },
    {
      name: 'Conway',
      slug: 'conway-sc',
      description:
        "Horry County's historic seat with a beautiful Waccamaw Riverfront Boardwalk and Coastal Carolina University.",
      imageUrl:
        'https://images.unsplash.com/photo-1566543079657-7756ff1b5d7c?w=800&q=80',
    },
    {
      name: 'Broadway at the Beach',
      slug: 'broadway-at-the-beach',
      description:
        'The flagship entertainment complex with restaurants, nightlife, Ripley\'s Aquarium, and seasonal festivals.',
      imageUrl:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    },
  ],
  'fayetteville-nc': [
    {
      name: 'Downtown Fayetteville',
      slug: 'downtown-fayetteville-nc',
      description:
        'A redeveloped urban core with Segra Stadium, the Museum of the Cape Fear, and a growing restaurant scene.',
      imageUrl:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
    },
    {
      name: 'Fort Liberty',
      slug: 'fort-liberty-nc',
      description:
        "Formerly Fort Bragg, the world's largest military installation by population is home to the 82nd Airborne Division.",
      imageUrl:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    },
    {
      name: 'Hope Mills',
      slug: 'hope-mills-nc',
      description:
        'Suburban community south of Fayetteville known for Hope Mills Lake and a strong sense of community.',
      imageUrl:
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    },
    {
      name: 'Spring Lake',
      slug: 'spring-lake-nc',
      description:
        'Military-adjacent community north of Fayetteville with affordable housing and easy post access.',
      imageUrl:
        'https://images.unsplash.com/photo-1566543079657-7756ff1b5d7c?w=800&q=80',
    },
    {
      name: 'Haymount',
      slug: 'haymount-fayetteville',
      description:
        "Fayetteville's most historic neighborhood with elegant homes, Haymount Hill, and the Cape Fear Valley Medical Center.",
      imageUrl:
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    },
  ],
  'daytona-beach-fl': [
    {
      name: 'Daytona Beach Shores',
      slug: 'daytona-beach-shores-fl',
      description:
        'Upscale oceanfront community south of Daytona with quieter beaches and luxury condos.',
      imageUrl:
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80',
    },
    {
      name: 'Ormond Beach',
      slug: 'ormond-beach-fl',
      description:
        "North of Daytona, Ormond Beach is known as the Birthplace of Speed and offers quieter beaches and Tomoka State Park.",
      imageUrl:
        'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=80',
    },
    {
      name: 'Port Orange',
      slug: 'port-orange-fl',
      description:
        'Fast-growing suburb south of Daytona with Dunlawton Avenue shopping and Spruce Creek Fly-In community.',
      imageUrl:
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    },
    {
      name: 'Daytona International Speedway',
      slug: 'daytona-speedway-area',
      description:
        "The World Center of Racing area surrounds NASCAR's most iconic 2.5-mile superspeedway with year-round events.",
      imageUrl:
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
    },
    {
      name: 'New Smyrna Beach',
      slug: 'new-smyrna-beach-fl',
      description:
        "Florida's most artsy beach town with a thriving Canal Street arts district and world-famous waves.",
      imageUrl:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
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

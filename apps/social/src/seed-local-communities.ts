import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Community } from './entities/community.entity';

type Locality = {
  name: string;
  slug: string;
  description: string;
  localityType: 'city' | 'town' | 'neighborhood' | 'county' | 'region';
  countryCode: string;
  adminArea: string;
  city: string;
  lat: number;
  lng: number;
  population: number;
  tags?: { id: string; name: string }[];
};

const COMMUNITIES: Locality[] = [
  // ── Georgia ──────────────────────────────────────────────────────────────
  {
    name: 'Savannah, GA',
    slug: 'savannah-ga',
    description:
      "Georgia's oldest city, known for its stunning squares, antebellum architecture, and vibrant arts scene along the Savannah River.",
    localityType: 'city',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Savannah',
    lat: 31.9868,
    lng: -81.0982,
    population: 147780,
    tags: [
      { id: '1', name: 'Historic' },
      { id: '2', name: 'Coastal' },
      { id: '3', name: 'Arts' },
    ],
  },
  {
    name: 'Savannah General',
    slug: 'savannah-ga-general',
    description:
      'The official community for all things Savannah. Connect with locals, share local news, events, and discover the Hostess City together.',
    localityType: 'county',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Savannah',
    lat: 31.9868,
    lng: -81.0982,
    population: 147780,
    tags: [
      { id: '1', name: 'Community' },
      { id: '2', name: 'Local' },
      { id: '3', name: 'Events' },
    ],
  },
  {
    name: 'Savannah Foodies',
    slug: 'savannah-foodies',
    description:
      "A community for Savannah's culinary enthusiasts. Share restaurant reviews, discover hidden gems, and connect with fellow food lovers.",
    localityType: 'neighborhood',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Savannah',
    lat: 31.992,
    lng: -81.091,
    population: 45000,
    tags: [
      { id: '1', name: 'Food' },
      { id: '2', name: 'Dining' },
      { id: '3', name: 'Reviews' },
    ],
  },
  {
    name: 'Savannah Tech',
    slug: 'savannah-tech',
    description:
      "Savannah's growing tech community. Network with developers, entrepreneurs, and tech enthusiasts in the Hostess City.",
    localityType: 'neighborhood',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Savannah',
    lat: 31.975,
    lng: -81.105,
    population: 28000,
    tags: [
      { id: '1', name: 'Technology' },
      { id: '2', name: 'Startups' },
      { id: '3', name: 'Networking' },
    ],
  },
  {
    name: 'Savannah Parents',
    slug: 'savannah-parents',
    description:
      'Supporting Savannah families with resources, playdates, school information, and community events for parents.',
    localityType: 'neighborhood',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Savannah',
    lat: 31.98,
    lng: -81.085,
    population: 35000,
    tags: [
      { id: '1', name: 'Family' },
      { id: '2', name: 'Parenting' },
      { id: '3', name: 'Education' },
    ],
  },
  {
    name: 'Hilton Head Island, SC',
    slug: 'hilton-head-island-sc',
    description:
      'A world-class resort island famous for its pristine beaches, championship golf, and outdoor recreation along the Atlantic coast.',
    localityType: 'city',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Hilton Head Island',
    lat: 32.2163,
    lng: -80.7526,
    population: 39945,
    tags: [
      { id: '1', name: 'Beach' },
      { id: '2', name: 'Golf' },
      { id: '3', name: 'Resort' },
    ],
  },
  {
    name: 'Hilton Head General',
    slug: 'hilton-head-general',
    description:
      'The official community for Hilton Head Island residents and visitors. Share local events, news, and connect with fellow islanders.',
    localityType: 'county',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Hilton Head Island',
    lat: 32.2163,
    lng: -80.7526,
    population: 39945,
    tags: [
      { id: '1', name: 'Community' },
      { id: '2', name: 'Local' },
      { id: '3', name: 'Island Life' },
    ],
  },
  {
    name: 'Hilton Head Outdoors',
    slug: 'hilton-head-outdoors',
    description:
      'Explore the natural beauty of Hilton Head. Hiking, kayaking, biking, and outdoor adventures with fellow enthusiasts.',
    localityType: 'neighborhood',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Hilton Head Island',
    lat: 32.22,
    lng: -80.745,
    population: 15000,
    tags: [
      { id: '1', name: 'Outdoors' },
      { id: '2', name: 'Adventure' },
      { id: '3', name: 'Fitness' },
    ],
  },
  {
    name: 'Hinesville, GA',
    slug: 'hinesville-ga',
    description:
      'Home to Fort Stewart, one of the largest Army installations in the US, with a strong military community and growing civilian population.',
    localityType: 'city',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Hinesville',
    lat: 31.8468,
    lng: -81.5957,
    population: 33703,
    tags: [
      { id: '1', name: 'Military' },
      { id: '2', name: 'Family' },
      { id: '3', name: 'Growing' },
    ],
  },
  {
    name: 'Hinesville General',
    slug: 'hinesville-ga-general',
    description:
      'The official community for Hinesville and Liberty County. Connect with neighbors, military families, and local businesses.',
    localityType: 'county',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Hinesville',
    lat: 31.8468,
    lng: -81.5957,
    population: 33703,
    tags: [
      { id: '1', name: 'Community' },
      { id: '2', name: 'Military' },
      { id: '3', name: 'Local' },
    ],
  },
  {
    name: 'Fort Stewart Families',
    slug: 'fort-stewart-families',
    description:
      'Supporting military families at Fort Stewart and Hinesville. Share resources, PCS tips, and connect with fellow service members.',
    localityType: 'neighborhood',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Hinesville',
    lat: 31.87,
    lng: -81.61,
    population: 25000,
    tags: [
      { id: '1', name: 'Military' },
      { id: '2', name: 'Family' },
      { id: '3', name: 'Support' },
    ],
  },
  {
    name: 'Beaufort, SC',
    slug: 'beaufort-sc',
    description:
      'A charming Lowcountry city with antebellum architecture, Gullah culture, and beautiful waterways connecting the Sea Islands.',
    localityType: 'city',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Beaufort',
    lat: 32.4316,
    lng: -80.6698,
    population: 14025,
    tags: [
      { id: '1', name: 'Historic' },
      { id: '2', name: 'Lowcountry' },
      { id: '3', name: 'Gullah' },
    ],
  },
  {
    name: 'Beaufort General',
    slug: 'beaufort-sc-general',
    description:
      'The official community for Beaufort and the surrounding Sea Islands. Share local news, events, and connect with Lowcountry neighbors.',
    localityType: 'county',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Beaufort',
    lat: 32.4316,
    lng: -80.6698,
    population: 14025,
    tags: [
      { id: '1', name: 'Community' },
      { id: '2', name: 'Lowcountry' },
      { id: '3', name: 'Gullah' },
    ],
  },
  {
    name: 'Beaufort Waterfront',
    slug: 'beaufort-waterfront',
    description:
      'Boating, fishing, and waterfront living in beautiful Beaufort. Connect with waterfront enthusiasts and share local knowledge.',
    localityType: 'neighborhood',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Beaufort',
    lat: 32.435,
    lng: -80.675,
    population: 8000,
    tags: [
      { id: '1', name: 'Boating' },
      { id: '2', name: 'Fishing' },
      { id: '3', name: 'Waterfront' },
    ],
  },
  {
    name: 'Statesboro, GA',
    slug: 'statesboro-ga',
    description:
      'Home to Georgia Southern University, offering college-town energy with a vibrant downtown and surrounding agricultural heritage.',
    localityType: 'city',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Statesboro',
    lat: 32.4488,
    lng: -81.7832,
    population: 33736,
    tags: [
      { id: '1', name: 'College Town' },
      { id: '2', name: 'Education' },
      { id: '3', name: 'Young' },
    ],
  },
  {
    name: 'Statesboro General',
    slug: 'statesboro-ga-general',
    description:
      'The official community for Statesboro and Bulloch County. Connect with locals, students, and the Georgia Southern community.',
    localityType: 'county',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Statesboro',
    lat: 32.4488,
    lng: -81.7832,
    population: 33736,
    tags: [
      { id: '1', name: 'Community' },
      { id: '2', name: 'College' },
      { id: '3', name: 'Local' },
    ],
  },
  {
    name: 'Georgia Southern Eagles',
    slug: 'georgia-southern-eagles',
    description:
      'Georgia Southern University sports, campus life, and Eagle athletics. Go Eagles!',
    localityType: 'neighborhood',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Statesboro',
    lat: 32.42,
    lng: -81.79,
    population: 20000,
    tags: [
      { id: '1', name: 'Sports' },
      { id: '2', name: 'College' },
      { id: '3', name: 'GSU' },
    ],
  },
  {
    name: 'Statesboro Downtown',
    slug: 'statesboro-downtown',
    description:
      'Downtown Statesboro events, restaurants, shops, and local business. Support local!',
    localityType: 'neighborhood',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Statesboro',
    lat: 32.45,
    lng: -81.78,
    population: 12000,
    tags: [
      { id: '1', name: 'Downtown' },
      { id: '2', name: 'Local Business' },
      { id: '3', name: 'Events' },
    ],
  },
  {
    name: 'Brunswick, GA',
    slug: 'brunswick-ga',
    description:
      'The Golden Isles gateway city with historic Old Town, fresh seafood, and access to Jekyll Island, St. Simons, and Sea Island.',
    localityType: 'city',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Brunswick',
    lat: 31.1499,
    lng: -81.4915,
    population: 21875,
    tags: [
      { id: '1', name: 'Historic' },
      { id: '2', name: 'Coastal' },
      { id: '3', name: 'Seafood' },
    ],
  },
  {
    name: 'Brunswick General',
    slug: 'brunswick-ga-general',
    description:
      'The official community for Brunswick and Glynn County. Discover the Golden Isles and connect with coastal Georgia neighbors.',
    localityType: 'county',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Brunswick',
    lat: 31.1499,
    lng: -81.4915,
    population: 21875,
    tags: [
      { id: '1', name: 'Community' },
      { id: '2', name: 'Coastal' },
      { id: '3', name: 'Golden Isles' },
    ],
  },
  {
    name: 'Golden Isles Beach',
    slug: 'golden-isles-beach',
    description:
      'Beach life in the Golden Isles. Jekyll Island, St. Simons, and Sea Island communities.',
    localityType: 'neighborhood',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Brunswick',
    lat: 31.08,
    lng: -81.51,
    population: 18000,
    tags: [
      { id: '1', name: 'Beach' },
      { id: '2', name: 'Golden Isles' },
      { id: '3', name: 'Vacation' },
    ],
  },
  {
    name: 'Charleston, SC',
    slug: 'charleston-sc',
    description:
      "One of America's most beloved historic cities, with cobblestone streets, antebellum plantations, world-class dining, and a rich cultural tapestry.",
    localityType: 'city',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Charleston',
    lat: 32.7767,
    lng: -79.9311,
    population: 150277,
    tags: [
      { id: '1', name: 'Historic' },
      { id: '2', name: 'Food' },
      { id: '3', name: 'Culture' },
    ],
  },
  {
    name: 'Charleston General',
    slug: 'charleston-sc-general',
    description:
      'The official community for Charleston. Share news, events, and connect with residents of the Holy City.',
    localityType: 'county',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Charleston',
    lat: 32.7767,
    lng: -79.9311,
    population: 150277,
    tags: [
      { id: '1', name: 'Community' },
      { id: '2', name: 'Historic' },
      { id: '3', name: 'Lowcountry' },
    ],
  },
  {
    name: 'Charleston Food & Wine',
    slug: 'charleston-food-wine',
    description:
      "Charleston's legendary culinary scene. Restaurant reviews, cooking tips, and food events.",
    localityType: 'neighborhood',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Charleston',
    lat: 32.785,
    lng: -79.935,
    population: 75000,
    tags: [
      { id: '1', name: 'Food' },
      { id: '2', name: 'Wine' },
      { id: '3', name: 'Dining' },
    ],
  },
  {
    name: 'Charleston Real Estate',
    slug: 'charleston-real-estate',
    description:
      'Buying, selling, and renting in the Charleston area. Market trends and neighborhood guides.',
    localityType: 'neighborhood',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Charleston',
    lat: 32.78,
    lng: -79.925,
    population: 45000,
    tags: [
      { id: '1', name: 'Real Estate' },
      { id: '2', name: 'Housing' },
      { id: '3', name: 'Market' },
    ],
  },
  {
    name: 'Charleston Tech Hub',
    slug: 'charleston-tech-hub',
    description:
      "Charleston's growing tech scene. Jobs, networking, and innovation in the Lowcountry.",
    localityType: 'neighborhood',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Charleston',
    lat: 32.795,
    lng: -79.95,
    population: 32000,
    tags: [
      { id: '1', name: 'Tech' },
      { id: '2', name: 'Startups' },
      { id: '3', name: 'Jobs' },
    ],
  },
  {
    name: 'Charleston Moms',
    slug: 'charleston-moms',
    description:
      'Supporting mothers in the Charleston area. Playgroups, schools, and family resources.',
    localityType: 'neighborhood',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Charleston',
    lat: 32.77,
    lng: -79.92,
    population: 28000,
    tags: [
      { id: '1', name: 'Parenting' },
      { id: '2', name: 'Family' },
      { id: '3', name: 'Support' },
    ],
  },
  {
    name: 'Jacksonville, FL',
    slug: 'jacksonville-fl',
    description:
      "Florida's largest city by area, with expansive beaches, the St. Johns River, a growing tech scene, and diverse neighborhoods.",
    localityType: 'city',
    countryCode: 'US',
    adminArea: 'FL',
    city: 'Jacksonville',
    lat: 30.3322,
    lng: -81.6557,
    population: 949611,
    tags: [
      { id: '1', name: 'Beaches' },
      { id: '2', name: 'River' },
      { id: '3', name: 'Diverse' },
    ],
  },
  {
    name: 'Jacksonville General',
    slug: 'jacksonville-fl-general',
    description:
      'The official community for Jacksonville. Connect with neighbors across the River City from the beaches to the suburbs.',
    localityType: 'county',
    countryCode: 'US',
    adminArea: 'FL',
    city: 'Jacksonville',
    lat: 30.3322,
    lng: -81.6557,
    population: 949611,
    tags: [
      { id: '1', name: 'Community' },
      { id: '2', name: 'River City' },
      { id: '3', name: 'First Coast' },
    ],
  },
  {
    name: 'Jacksonville Beach',
    slug: 'jacksonville-beach',
    description:
      'The beaches of Jacksonville. Surfing, beach events, and coastal living in NE Florida.',
    localityType: 'neighborhood',
    countryCode: 'US',
    adminArea: 'FL',
    city: 'Jacksonville',
    lat: 30.294,
    lng: -81.393,
    population: 25000,
    tags: [
      { id: '1', name: 'Beach' },
      { id: '2', name: 'Surfing' },
      { id: '3', name: 'Coastal' },
    ],
  },
  {
    name: 'Jacksonville Tech',
    slug: 'jacksonville-tech',
    description:
      "Jacksonville's tech ecosystem. Developers, startups, and tech meetups in the River City.",
    localityType: 'neighborhood',
    countryCode: 'US',
    adminArea: 'FL',
    city: 'Jacksonville',
    lat: 30.34,
    lng: -81.66,
    population: 55000,
    tags: [
      { id: '1', name: 'Tech' },
      { id: '2', name: 'Jobs' },
      { id: '3', name: 'Startups' },
    ],
  },
  {
    name: 'Augusta, GA',
    slug: 'augusta-ga',
    description:
      "Georgia's second-largest city, home to The Masters golf tournament, a revitalized Riverwalk, and a growing cyber and medical corridor.",
    localityType: 'city',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Augusta',
    lat: 33.4735,
    lng: -82.0105,
    population: 202081,
    tags: [
      { id: '1', name: 'Golf' },
      { id: '2', name: 'Military' },
      { id: '3', name: 'Medical' },
    ],
  },
  {
    name: 'Augusta General',
    slug: 'augusta-ga-general',
    description:
      'The official community for Augusta and the CSRA. Connect with neighbors from the Garden City to the Cyber Corridor.',
    localityType: 'county',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Augusta',
    lat: 33.4735,
    lng: -82.0105,
    population: 202081,
    tags: [
      { id: '1', name: 'Community' },
      { id: '2', name: 'CSRA' },
      { id: '3', name: 'Garden City' },
    ],
  },
  {
    name: 'Augusta Masters',
    slug: 'augusta-masters',
    description:
      'Everything Masters week! Tournament discussion, traditions, and golf in Augusta.',
    localityType: 'neighborhood',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Augusta',
    lat: 33.48,
    lng: -82.02,
    population: 80000,
    tags: [
      { id: '1', name: 'Golf' },
      { id: '2', name: 'Masters' },
      { id: '3', name: 'Sports' },
    ],
  },
  {
    name: 'Augusta Military Families',
    slug: 'augusta-military-families',
    description:
      'Supporting Fort Gordon and Augusta military families. Resources and community connections.',
    localityType: 'neighborhood',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Augusta',
    lat: 33.45,
    lng: -82.0,
    population: 45000,
    tags: [
      { id: '1', name: 'Military' },
      { id: '2', name: 'Fort Gordon' },
      { id: '3', name: 'Family' },
    ],
  },
  {
    name: 'Aiken, SC',
    slug: 'aiken-sc',
    description:
      'A charming horse-country city known for its equestrian culture, beautiful historic district, and proximity to the CSRA region.',
    localityType: 'city',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Aiken',
    lat: 33.5601,
    lng: -81.7198,
    population: 30987,
    tags: [
      { id: '1', name: 'Equestrian' },
      { id: '2', name: 'Horse Country' },
      { id: '3', name: 'Historic' },
    ],
  },
  {
    name: 'Aiken General',
    slug: 'aiken-sc-general',
    description:
      'The official community for Aiken and horse country. Connect with equestrian enthusiasts and historic district neighbors.',
    localityType: 'county',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Aiken',
    lat: 33.5601,
    lng: -81.7198,
    population: 30987,
    tags: [
      { id: '1', name: 'Community' },
      { id: '2', name: 'Horse Country' },
      { id: '3', name: 'Equestrian' },
    ],
  },
  {
    name: 'Aiken Equestrian',
    slug: 'aiken-equestrian',
    description:
      'Horse country living in Aiken. Equestrian events, horse farms, and equestrian culture.',
    localityType: 'neighborhood',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Aiken',
    lat: 33.57,
    lng: -81.725,
    population: 18000,
    tags: [
      { id: '1', name: 'Horses' },
      { id: '2', name: 'Equestrian' },
      { id: '3', name: 'Farms' },
    ],
  },
  {
    name: 'Dublin, GA',
    slug: 'dublin-ga',
    description:
      'The "Emerald City" of Georgia, known for its annual St. Patrick\'s Festival, thriving business community, and Oconee River setting.',
    localityType: 'city',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Dublin',
    lat: 32.5402,
    lng: -82.9038,
    population: 15938,
    tags: [
      { id: '1', name: 'Irish' },
      { id: '2', name: 'Festival' },
      { id: '3', name: 'River' },
    ],
  },
  {
    name: 'Dublin General',
    slug: 'dublin-ga-general',
    description:
      'The official community for Dublin and Laurens County. Celebrate the Emerald City spirit and connect with neighbors.',
    localityType: 'county',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Dublin',
    lat: 32.5402,
    lng: -82.9038,
    population: 15938,
    tags: [
      { id: '1', name: 'Community' },
      { id: '2', name: 'Emerald City' },
      { id: '3', name: 'Local' },
    ],
  },
  {
    name: 'Vidalia, GA',
    slug: 'vidalia-ga',
    description:
      'Famous for its sweet Vidalia onions, this Southeast Georgia town celebrates its agriculture and small-town hospitality.',
    localityType: 'city',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Vidalia',
    lat: 32.2177,
    lng: -82.4132,
    population: 11024,
    tags: [
      { id: '1', name: 'Agriculture' },
      { id: '2', name: 'Onions' },
      { id: '3', name: 'Small Town' },
    ],
  },
  {
    name: 'Vidalia General',
    slug: 'vidalia-ga-general',
    description:
      'The official community for Vidalia and Toombs County. Celebrating sweet onions and Southern hospitality.',
    localityType: 'county',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Vidalia',
    lat: 32.2177,
    lng: -82.4132,
    population: 11024,
    tags: [
      { id: '1', name: 'Community' },
      { id: '2', name: 'Agriculture' },
      { id: '3', name: 'Small Town' },
    ],
  },
  {
    name: 'Waycross, GA',
    slug: 'waycross-ga',
    description:
      'Gateway to the Okefenokee Swamp, one of the largest blackwater wetland preserves in North America, with outdoor adventures.',
    localityType: 'city',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Waycross',
    lat: 31.2135,
    lng: -82.3549,
    population: 14163,
    tags: [
      { id: '1', name: 'Nature' },
      { id: '2', name: 'Swamp' },
      { id: '3', name: 'Outdoor' },
    ],
  },
  {
    name: 'Waycross General',
    slug: 'waycross-ga-general',
    description:
      'The official community for Waycross and the Okefenokee region. Discover swamp adventures and connect with outdoor enthusiasts.',
    localityType: 'county',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Waycross',
    lat: 31.2135,
    lng: -82.3549,
    population: 14163,
    tags: [
      { id: '1', name: 'Community' },
      { id: '2', name: 'Okefenokee' },
      { id: '3', name: 'Nature' },
    ],
  },
  {
    name: 'Waycross Outdoors',
    slug: 'waycross-outdoors',
    description:
      'Okefenokee Swamp adventures and outdoor activities in Southeast Georgia.',
    localityType: 'neighborhood',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Waycross',
    lat: 31.22,
    lng: -82.36,
    population: 8000,
    tags: [
      { id: '1', name: 'Okefenokee' },
      { id: '2', name: 'Nature' },
      { id: '3', name: 'Adventure' },
    ],
  },
  {
    name: 'Jesup, GA',
    slug: 'jesup-ga',
    description:
      'A welcoming Southeast Georgia community known as the Carpet Capital of the World, with deep ties to the timber and agriculture industries.',
    localityType: 'city',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Jesup',
    lat: 31.5983,
    lng: -81.8857,
    population: 10214,
    tags: [
      { id: '1', name: 'Industrial' },
      { id: '2', name: 'Timber' },
      { id: '3', name: 'Agriculture' },
    ],
  },
  {
    name: 'Jesup General',
    slug: 'jesup-ga-general',
    description:
      'The official community for Jesup and Wayne County. Connect with neighbors in Southeast Georgia.',
    localityType: 'county',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Jesup',
    lat: 31.5983,
    lng: -81.8857,
    population: 10214,
    tags: [
      { id: '1', name: 'Community' },
      { id: '2', name: 'Southeast Georgia' },
      { id: '3', name: 'Local' },
    ],
  },
  {
    name: 'Fernandina Beach, FL',
    slug: 'fernandina-beach-fl',
    description:
      'Historic Amelia Island city with Victorian architecture, a charming downtown, and beautiful Atlantic beaches.',
    localityType: 'city',
    countryCode: 'US',
    adminArea: 'FL',
    city: 'Fernandina Beach',
    lat: 30.6696,
    lng: -81.4626,
    population: 12969,
    tags: [
      { id: '1', name: 'Beach' },
      { id: '2', name: 'Historic' },
      { id: '3', name: 'Amelia Island' },
    ],
  },
  {
    name: 'Fernandina Beach General',
    slug: 'fernandina-beach-fl-general',
    description:
      'The official community for Fernandina Beach and Amelia Island. Discover island life and connect with neighbors.',
    localityType: 'county',
    countryCode: 'US',
    adminArea: 'FL',
    city: 'Fernandina Beach',
    lat: 30.6696,
    lng: -81.4626,
    population: 12969,
    tags: [
      { id: '1', name: 'Community' },
      { id: '2', name: 'Amelia Island' },
      { id: '3', name: 'Island Life' },
    ],
  },
  {
    name: 'Amelia Island Living',
    slug: 'amelia-island-living',
    description:
      'Life on Amelia Island. Beach activities, local events, and island community.',
    localityType: 'neighborhood',
    countryCode: 'US',
    adminArea: 'FL',
    city: 'Fernandina Beach',
    lat: 30.68,
    lng: -81.47,
    population: 10000,
    tags: [
      { id: '1', name: 'Beach' },
      { id: '2', name: 'Island' },
      { id: '3', name: 'Community' },
    ],
  },
  {
    name: 'Orangeburg, SC',
    slug: 'orangeburg-sc',
    description:
      'Home to South Carolina State University and Claflin University, with a vibrant community spirit and regional festival scene.',
    localityType: 'city',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Orangeburg',
    lat: 33.4918,
    lng: -80.8548,
    population: 13964,
    tags: [
      { id: '1', name: 'College' },
      { id: '2', name: 'Education' },
      { id: '3', name: 'HBCU' },
    ],
  },
  {
    name: 'Orangeburg General',
    slug: 'orangeburg-sc-general',
    description:
      'The official community for Orangeburg and The Region. Connect with students, families, and local businesses.',
    localityType: 'county',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Orangeburg',
    lat: 33.4918,
    lng: -80.8548,
    population: 13964,
    tags: [
      { id: '1', name: 'Community' },
      { id: '2', name: 'HBCU' },
      { id: '3', name: 'The Region' },
    ],
  },
  {
    name: 'Orangeburg Students',
    slug: 'orangeburg-students',
    description:
      'Students and alumni of SC State and Claflin. Campus life and academic resources.',
    localityType: 'neighborhood',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Orangeburg',
    lat: 33.5,
    lng: -80.86,
    population: 9000,
    tags: [
      { id: '1', name: 'Students' },
      { id: '2', name: 'College' },
      { id: '3', name: 'HBCU' },
    ],
  },
  {
    name: 'Douglas, GA',
    slug: 'douglas-ga',
    description:
      'The seat of Coffee County, a growing South Georgia community with strong agricultural roots and emerging manufacturing.',
    localityType: 'city',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Douglas',
    lat: 31.5088,
    lng: -82.8499,
    population: 11589,
    tags: [
      { id: '1', name: 'Agriculture' },
      { id: '2', name: 'Manufacturing' },
      { id: '3', name: 'Rural' },
    ],
  },
  {
    name: 'Douglas General',
    slug: 'douglas-ga-general',
    description:
      'The official community for Douglas and Coffee County. Connect with South Georgia neighbors and local businesses.',
    localityType: 'county',
    countryCode: 'US',
    adminArea: 'GA',
    city: 'Douglas',
    lat: 31.5088,
    lng: -82.8499,
    population: 11589,
    tags: [
      { id: '1', name: 'Community' },
      { id: '2', name: 'South Georgia' },
      { id: '3', name: 'Local' },
    ],
  },
  {
    name: 'Columbia, SC',
    slug: 'columbia-sc',
    description:
      "South Carolina's capital city, home to the University of South Carolina, historic districts, and a growing culinary scene.",
    localityType: 'city',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Columbia',
    lat: 34.0007,
    lng: -81.0348,
    population: 127029,
    tags: [
      { id: '1', name: 'Capital' },
      { id: '2', name: 'College Town' },
      { id: '3', name: 'Government' },
    ],
  },
  {
    name: 'Columbia General',
    slug: 'columbia-sc-general',
    description:
      'The official community for Columbia and the Midlands. Connect with neighbors from the Vista to Five Points.',
    localityType: 'county',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Columbia',
    lat: 34.0007,
    lng: -81.0348,
    population: 127029,
    tags: [
      { id: '1', name: 'Community' },
      { id: '2', name: 'The Midlands' },
      { id: '3', name: 'Capital City' },
    ],
  },
  {
    name: 'USC Gamecocks',
    slug: 'usc-gamecocks',
    description:
      'University of South Carolina sports and campus life. Go Gamecocks!',
    localityType: 'neighborhood',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Columbia',
    lat: 33.985,
    lng: -81.03,
    population: 45000,
    tags: [
      { id: '1', name: 'Sports' },
      { id: '2', name: 'USC' },
      { id: '3', name: 'College' },
    ],
  },
  {
    name: 'Columbia Real Estate',
    slug: 'columbia-real-estate',
    description:
      'Housing market, neighborhoods, and real estate in the Columbia metro area.',
    localityType: 'neighborhood',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Columbia',
    lat: 34.01,
    lng: -81.04,
    population: 55000,
    tags: [
      { id: '1', name: 'Real Estate' },
      { id: '2', name: 'Housing' },
      { id: '3', name: 'Neighborhoods' },
    ],
  },
  {
    name: 'Greenville, SC',
    slug: 'greenville-sc',
    description:
      "One of the South's most celebrated downtowns, with the iconic Falls Park on the Reedy, a booming arts scene, and a vibrant culinary culture.",
    localityType: 'city',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Greenville',
    lat: 34.8526,
    lng: -82.394,
    population: 70720,
    tags: [
      { id: '1', name: 'Downtown' },
      { id: '2', name: 'Arts' },
      { id: '3', name: 'Food' },
    ],
  },
  {
    name: 'Greenville General',
    slug: 'greenville-sc-general',
    description:
      'The official community for Greenville and the Upstate. Discover Falls Park, local events, and connect with neighbors.',
    localityType: 'county',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Greenville',
    lat: 34.8526,
    lng: -82.394,
    population: 70720,
    tags: [
      { id: '1', name: 'Community' },
      { id: '2', name: 'Upstate' },
      { id: '3', name: 'Downtown' },
    ],
  },
  {
    name: 'Greenville Downtown',
    slug: 'greenville-downtown',
    description:
      'Downtown Greenville living and events. Falls Park, restaurants, and city life.',
    localityType: 'neighborhood',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Greenville',
    lat: 34.855,
    lng: -82.4,
    population: 25000,
    tags: [
      { id: '1', name: 'Downtown' },
      { id: '2', name: 'Falls Park' },
      { id: '3', name: 'Urban' },
    ],
  },
  {
    name: 'Greenville Food Scene',
    slug: 'greenville-food-scene',
    description:
      "Greenville's award-winning restaurants and emerging culinary hotspot.",
    localityType: 'neighborhood',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Greenville',
    lat: 34.85,
    lng: -82.39,
    population: 30000,
    tags: [
      { id: '1', name: 'Food' },
      { id: '2', name: 'Restaurants' },
      { id: '3', name: 'Dining' },
    ],
  },
  {
    name: 'Myrtle Beach, SC',
    slug: 'myrtle-beach-sc',
    description:
      "The Grand Strand's main city with 60 miles of beaches, golf courses, and world-class entertainment.",
    localityType: 'city',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Myrtle Beach',
    lat: 33.689,
    lng: -78.8869,
    population: 341421,
    tags: [
      { id: '1', name: 'Beach' },
      { id: '2', name: 'Golf' },
      { id: '3', name: 'Tourism' },
    ],
  },
  {
    name: 'Myrtle Beach General',
    slug: 'myrtle-beach-sc-general',
    description:
      'The official community for the Grand Strand. Connect with locals from Myrtle Beach to North Myrtle Beach.',
    localityType: 'county',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Myrtle Beach',
    lat: 33.689,
    lng: -78.8869,
    population: 341421,
    tags: [
      { id: '1', name: 'Community' },
      { id: '2', name: 'Grand Strand' },
      { id: '3', name: 'Beach Life' },
    ],
  },
  {
    name: 'Myrtle Beach Golf',
    slug: 'myrtle-beach-golf',
    description:
      'Golf communities and courses along the Grand Strand. The golf capital of the world!',
    localityType: 'neighborhood',
    countryCode: 'US',
    adminArea: 'SC',
    city: 'Myrtle Beach',
    lat: 33.7,
    lng: -78.88,
    population: 120000,
    tags: [
      { id: '1', name: 'Golf' },
      { id: '2', name: 'Resort' },
      { id: '3', name: 'Retirement' },
    ],
  },
  {
    name: 'Wilmington, NC',
    slug: 'wilmington-nc',
    description:
      'A historic port city with a vibrant downtown, beautiful beaches, and a growing film industry.',
    localityType: 'city',
    countryCode: 'US',
    adminArea: 'NC',
    city: 'Wilmington',
    lat: 34.2257,
    lng: -77.9447,
    population: 115382,
    tags: [
      { id: '1', name: 'Historic' },
      { id: '2', name: 'Beach' },
      { id: '3', name: 'Film' },
    ],
  },
  {
    name: 'Wilmington General',
    slug: 'wilmington-nc-general',
    description:
      'The official community for Wilmington and the Cape Fear region. Connect with neighbors from downtown to Wrightsville Beach.',
    localityType: 'county',
    countryCode: 'US',
    adminArea: 'NC',
    city: 'Wilmington',
    lat: 34.2257,
    lng: -77.9447,
    population: 115382,
    tags: [
      { id: '1', name: 'Community' },
      { id: '2', name: 'Cape Fear' },
      { id: '3', name: 'Port City' },
    ],
  },
];

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

      if (existing) {
        const {
          slug,
          description,
          localityType,
          countryCode,
          adminArea,
          city,
          lat,
          lng,
          population,
          tags,
        } = data;
        Object.assign(existing, {
          slug,
          description,
          localityType,
          countryCode,
          adminArea,
          city,
          lat,
          lng,
          population,
          tags,
        });
        await communityRepo.save(existing);
        updated++;
        console.log(`  Updated: ${data.name}`);
      } else {
        // Set memberCount to 0 initially - actual member counts will be tracked when users join
        const community = communityRepo.create({
          ...data,
          ownerId: 'system',
          ownerProfileId: 'system',
          appScope: 'local-hub',
          isPrivate: false,
          joinPolicy: 'public',
          memberCount: 0,
        });
        await communityRepo.save(community);
        created++;
        console.log(`  Created: ${data.name}`);
      }
    }

    console.log(
      `\nDone. Created: ${created}, Updated: ${updated}, Total: ${COMMUNITIES.length}`
    );
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    await app.close();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

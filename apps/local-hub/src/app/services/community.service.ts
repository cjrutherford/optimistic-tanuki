import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL, CommunityTag } from '@optimistic-tanuki/ui-models';
import { firstValueFrom } from 'rxjs';

export interface LocalCommunity {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  description: string;
  localityType: 'city' | 'town' | 'neighborhood' | 'county' | 'region';
  countryCode: string;
  adminArea: string;
  city: string;
  memberCount: number;
  createdAt: string;
  lat?: number | null;
  lng?: number | null;
  population?: number | null;
  imageUrl?: string;
  bannerUrl?: string;
  logoUrl?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  highlights?: string[];
  events?: string[];
  tags?: CommunityTag[];
}

export interface City {
  id: string;
  name: string;
  slug: string;
  countryCode: string;
  adminArea: string;
  description: string;
  imageUrl: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  population: number;
  timezone: string;
  highlights: string[];
  communities: number;
}

const CITY_IMAGES: Record<string, string> = {
  'savannah-ga':
    'https://images.unsplash.com/photo-1543076447-215ad9ba6923?w=800&q=80',
  'savannah-ga-general':
    'https://images.unsplash.com/photo-1560077183-9b7d0c4f1c1e?w=800&q=80',
  'savannah-foodies':
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
  'savannah-tech':
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80',
  'savannah-parents':
    'https://images.unsplash.com/photo-1490109662329-9554gea7e-49f2f1f2f2f2?w=800&q=80',
  'charleston-sc':
    'https://images.unsplash.com/photo-1569974507005-6dc61f97fb5c?w=800&q=80',
  'charleston-sc-general':
    'https://images.unsplash.com/photo-1579266693804-379a0e8d4a9d?w=800&q=80',
  'charleston-food-wine':
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
  'charleston-real-estate':
    'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
  'charleston-tech-hub':
    'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&q=80',
  'charleston-moms':
    'https://images.unsplash.com/photo-1490109662329-9554gea7e-49f2f1f2f2f2?w=800&q=80',
  'hilton-head-island-sc':
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
  'hilton-head-general':
    'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80',
  'hilton-head-outdoors':
    'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=800&q=80',
  'brunswick-ga':
    'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&q=80',
  'brunswick-ga-general':
    'https://images.unsplash.com/photo-1519052537078-e6302a4968d4?w=800&q=80',
  'golden-isles-beach':
    'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=800&q=80',
  'beaufort-sc':
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
  'beaufort-sc-general':
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
  'beaufort-waterfront':
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
  'jacksonville-fl':
    'https://images.unsplash.com/photo-1590059582956-94bf1a8522d7?w=800&q=80',
  'jacksonville-fl-general':
    'https://images.unsplash.com/photo-1536514072410-5019a3c6931d?w=800&q=80',
  'jacksonville-beach':
    'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=800&q=80',
  'jacksonville-tech':
    'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&q=80',
  'augusta-ga':
    'https://images.unsplash.com/photo-1569025743873-ea3a9bera3c9?w=800&q=80',
  'augusta-ga-general':
    'https://images.unsplash.com/photo-1584652868574-0669f4292976?w=800&q=80',
  'augusta-masters':
    'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800&q=80',
  'augusta-military-families':
    'https://images.unsplash.com/photo-1543076447-215ad9ba6923?w=800&q=80',
  'aiken-sc':
    'https://images.unsplash.com/photo-1531633498708-6419951c6fa5?w=800&q=80',
  'aiken-sc-general':
    'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=800&q=80',
  'aiken-equestrian':
    'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=800&q=80',
  'statesboro-ga':
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&q=80',
  'statesboro-ga-general':
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80',
  'georgia-southern-eagles':
    'https://images.unsplash.com/photo-1568603074322-a4ecb1af6745?w=800&q=80',
  'statesboro-downtown':
    'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80',
  'hinesville-ga':
    'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=80',
  'hinesville-ga-general':
    'https://images.unsplash.com/photo-1543076447-215ad9ba6923?w=800&q=80',
  'fort-stewart-families':
    'https://images.unsplash.com/photo-1543076447-215ad9ba6923?w=800&q=80',
  'dublin-ga':
    'https://images.unsplash.com/photo-1543076447-215ad9ba6923?w=800&q=80',
  'dublin-ga-general':
    'https://images.unsplash.com/photo-1531633498708-6419951c6fa5?w=800&q=80',
  'vidalia-ga':
    'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800&q=80',
  'vidalia-ga-general':
    'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800&q=80',
  'waycross-ga':
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
  'waycross-ga-general':
    'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=800&q=80',
  'waycross-outdoors':
    'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=800&q=80',
  'jesup-ga':
    'https://images.unsplash.com/photo-1543076447-215ad9ba6923?w=800&q=80',
  'jesup-ga-general':
    'https://images.unsplash.com/photo-1543076447-215ad9ba6923?w=800&q=80',
  'fernandina-beach-fl':
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
  'fernandina-beach-fl-general':
    'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=800&q=80',
  'amelia-island-living':
    'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=800&q=80',
  'orangeburg-sc':
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80',
  'orangeburg-sc-general':
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80',
  'orangeburg-students':
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80',
  'douglas-ga':
    'https://images.unsplash.com/photo-1543076447-215ad9ba6923?w=800&q=80',
  'douglas-ga-general':
    'https://images.unsplash.com/photo-1543076447-215ad9ba6923?w=800&q=80',
  'columbia-sc':
    'https://images.unsplash.com/photo-1490109662329-9554gea7e-49f2f1f2f2f2?w=800&q=80',
  'columbia-sc-general':
    'https://images.unsplash.com/photo-1490109662329-9554gea7e-49f2f1f2f2f2?w=800&q=80',
  'usc-gamecocks':
    'https://images.unsplash.com/photo-1568603074322-a4ecb1af6745?w=800&q=80',
  'columbia-real-estate':
    'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
  'greenville-sc':
    'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80',
  'greenville-sc-general':
    'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80',
  'greenville-downtown':
    'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80',
  'greenville-food-scene':
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
  'myrtle-beach-sc':
    'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=800&q=80',
  'myrtle-beach-sc-general':
    'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=800&q=80',
  'myrtle-beach-golf':
    'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800&q=80',
  'wilmington-nc':
    'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=800&q=80',
  'wilmington-nc-general':
    'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=800&q=80',
  'wilmington-film':
    'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&q=80',
  'wrightsville-beach-nc':
    'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=800&q=80',
  default:
    'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80',
};

const CITY_HIGHLIGHTS: Record<string, string[]> = {
  'savannah-ga': [
    'Historic Squares',
    'Riverfront District',
    'Southern Cuisine',
    'Ghost Tours',
    'Telfair Museums',
    'Forsyth Park',
    'SCAD',
    "St. Patrick's Day",
  ],
  'charleston-sc': [
    'Historic District',
    'Charleston Harbor',
    'Southern Food',
    'Antebellum Homes',
    'Battery & White Point Garden',
    'King Street Shopping',
    'Spoleto Festival',
    'Waterfront Park',
  ],
  'hilton-head-island-sc': [
    'World-Class Golf',
    'Pristine Beaches',
    'Sea Pines Resort',
    'Harbour Town',
    'Water Sports',
    'Bike Trails',
    'Nature Reserves',
    'Tennis',
  ],
  'brunswick-ga': [
    'Golden Isles',
    'Historic Old Town',
    'Fresh Seafood',
    'Jekyll Island',
    'St. Simons Island',
    'Marshes of Glynn',
    'Georgia Coast',
    'Fort Frederica',
  ],
  'beaufort-sc': [
    'Lowcountry Charm',
    'Gullah Culture',
    'Waterways',
    'Antebellum Architecture',
    'Spanish Moss',
    'Hunting Island',
    'Beaufort History',
    'Waterfront Park',
  ],
  'jacksonville-fl': [
    'Atlantic Beaches',
    'St. Johns River',
    'Craft Beer Scene',
    'Sports',
    'Jacksonville Zoo',
    'Cummer Museum',
    'Art Walk',
    "Surfer's Paradise",
  ],
  'augusta-ga': [
    'The Masters',
    'Riverwalk',
    'Cyber Corridor',
    'Historic Homes',
    'Fort Gordon',
    'Medical Corridor',
    'Georgia Golf Hall of Fame',
    'Augusta Canal',
  ],
  'aiken-sc': [
    'Horse Country',
    'Equestrian',
    'Historic District',
    'Fine Dining',
    'Hopeland Gardens',
    'DuBose Museum',
    'Aiken Thoroughbred Racing',
    'Steeplechase',
  ],
  'statesboro-ga': [
    'Georgia Southern University',
    'Downtown',
    'Southern Cuisine',
    'College Town',
    'Sweetser Arts Festival',
    'Bulloch County',
    'Eagle Creek',
    'South Main Street',
  ],
  'hinesville-ga': [
    'Fort Stewart',
    'Military Community',
    'Growing Economy',
    'Family-Friendly',
    'Liberty County',
    'Coastal Georgia',
    'Small Business',
    'Veteran Services',
  ],
  'fernandina-beach-fl': [
    'Amelia Island',
    'Victorian Architecture',
    'Beaches',
    'Historic District',
    'Shrimpfest',
    'Fort Clinch',
    'Pirate Festival',
    'Navy Seal Museum',
  ],
  'dublin-ga': [
    "St. Patrick's Festival",
    'Oconee River',
    'Emerald City',
    'Business Community',
    'Laurens County',
    'Dublin Downtown',
    'Wright Square',
    'Piedmont Healthcare',
  ],
  'vidalia-ga': [
    'Vidalia Onions',
    'Agriculture',
    'Small Town',
    'Georgia Grown',
    'Onion Festival',
    'Toombs County',
    'Farming Heritage',
    'Sweet Onion',
  ],
  'waycross-ga': [
    'Okefenokee Swamp',
    'Nature',
    'Outdoor Adventure',
    'Railroad History',
    'Suwannee River',
    'Wildlife',
    'Fishing',
    'Canoeing',
  ],
  'jesup-ga': [
    'Carpet Capital',
    'Timber',
    'Agriculture',
    'Southeast Georgia',
    'Wayne County',
    'Altamaha River',
    'Golf',
    'Community Events',
  ],
  'orangeburg-sc': [
    'SC State University',
    'Claflin University',
    'HBCU',
    'Festivals',
    'Edisto River',
    'Orangeburg County',
    'Historical Sites',
    'Regional Healthcare',
  ],
  'douglas-ga': [
    'Coffee County',
    'Agriculture',
    'Manufacturing',
    'South Georgia',
    'Graveface Museum',
    'Willow Lake',
    'Farmers Market',
    'Pine Forest',
  ],
  'columbia-sc': [
    'USC Gamecocks',
    'State Capital',
    'Historic Districts',
    'Culinary Scene',
    'Riverbanks Zoo',
    'Finley Park',
    'Congaree River',
    'Vista District',
  ],
  'greenville-sc': [
    'Falls Park',
    'Arts Scene',
    'Downtown',
    'Gastronomy',
    'Peace Center',
    'Swamp Rabbit Trail',
    'Main Street',
    'Woods Bridge',
  ],
  'myrtle-beach-sc': [
    'Grand Strand',
    'Golf Courses',
    'Beach Life',
    'Entertainment',
    'Broadway at the Beach',
    'Myrtle Waves',
    'Coastal Carolina',
    'BBQ Festival',
  ],
  'wilmington-nc': [
    'Historic Downtown',
    'Cape Fear River',
    'Film Industry',
    'Beaches',
    'USS NC Battleship',
    'Riverfront',
    'Film Tours',
    'Cape Fear Museum',
  ],
};

export interface CityPost {
  id: string;
  communityId: string;
  communitySlug: string;
  communityName: string;
  title: string;
  content: string;
  authorName: string;
  authorAvatar?: string;
  createdAt: string;
  likes: number;
  comments: number;
}

const MOCK_POSTS: CityPost[] = [
  {
    id: 'post-1',
    communityId: 'savannah-general',
    communitySlug: 'savannah-ga-general',
    communityName: 'Savannah General',
    title: 'Welcome to Savannah!',
    content:
      'Welcome to the official Savannah community! Share local news, events, and connect with neighbors.',
    authorName: 'Sam Savannah',
    createdAt: '2024-01-15T10:00:00Z',
    likes: 42,
    comments: 8,
  },
  {
    id: 'post-2',
    communityId: 'savannah-general',
    communitySlug: 'savannah-ga-general',
    communityName: 'Savannah General',
    title: 'Farmers Market This Saturday',
    content:
      "Don't forget - the Saturday Farmers Market is back at Ellis Square from 8am to 1pm!",
    authorName: 'Lily Community',
    createdAt: '2024-01-14T15:30:00Z',
    likes: 28,
    comments: 5,
  },
  {
    id: 'post-3',
    communityId: 'charleston-general',
    communitySlug: 'charleston-sc-general',
    communityName: 'Charleston General',
    title: 'Best Lowcountry Spots?',
    content:
      'Just moved to Charleston! What are the must-visit spots for authentic Lowcountry cuisine?',
    authorName: 'New Charlestonian',
    createdAt: '2024-01-13T09:00:00Z',
    likes: 35,
    comments: 22,
  },
  {
    id: 'post-4',
    communityId: 'charleston-general',
    communitySlug: 'charleston-sc-general',
    communityName: 'Charleston General',
    title: 'Spoleto Festival Tickets Available',
    content:
      "Spent the day getting tickets for Spoleto this year. Can't wait for the performances!",
    authorName: 'Arts Lover',
    createdAt: '2024-01-12T18:00:00Z',
    likes: 56,
    comments: 12,
  },
  {
    id: 'post-5',
    communityId: 'hilton-head-general',
    communitySlug: 'hilton-head-general',
    communityName: 'Hilton Head General',
    title: 'Golf Tournament This Weekend',
    content:
      "The annual Hilton Head Golf Tournament is happening this weekend at Sea Pines. Who's playing?",
    authorName: 'Golf Pro',
    createdAt: '2024-01-11T12:00:00Z',
    likes: 19,
    comments: 7,
  },
  {
    id: 'post-6',
    communityId: 'augusta-general',
    communitySlug: 'augusta-ga-general',
    communityName: 'Augusta General',
    title: 'Masters Week Approaches!',
    content: "Only a few weeks until The Masters! Who's got tickets this year?",
    authorName: 'Golf Fan',
    createdAt: '2024-01-10T14:00:00Z',
    likes: 89,
    comments: 34,
  },
  {
    id: 'post-7',
    communityId: 'jacksonville-general',
    communitySlug: 'jacksonville-fl-general',
    communityName: 'Jacksonville General',
    title: 'Best Craft Breweries?',
    content:
      'Looking for recommendations on the best craft breweries in Jacksonville. What are your favorites?',
    authorName: 'Beer Enthusiast',
    createdAt: '2024-01-09T16:00:00Z',
    likes: 24,
    comments: 18,
  },
  {
    id: 'post-8',
    communityId: 'greenville-general',
    communitySlug: 'greenville-sc-general',
    communityName: 'Greenville General',
    title: 'Falls Park Stroll',
    content:
      'Took a beautiful evening stroll through Falls Park. This city never disappoints!',
    authorName: 'Greenville Native',
    createdAt: '2024-01-08T20:00:00Z',
    likes: 67,
    comments: 9,
  },
  {
    id: 'post-9',
    communityId: 'columbia-general',
    communitySlug: 'columbia-sc-general',
    communityName: 'Columbia General',
    title: 'Gamecocks Game Day Thread',
    content: "Who's ready for today's game? Let's go Gamecocks!",
    authorName: 'USC Fan',
    createdAt: '2024-01-07T14:00:00Z',
    likes: 112,
    comments: 45,
  },
  {
    id: 'post-10',
    communityId: 'myrtle-beach-general',
    communitySlug: 'myrtle-beach-sc-general',
    communityName: 'Myrtle Beach General',
    title: 'Summer Beach Rentals',
    content:
      'Looking for recommendations for beach house rentals for the summer. Any suggestions?',
    authorName: 'Beach Visitor',
    createdAt: '2024-01-06T11:00:00Z',
    likes: 15,
    comments: 28,
  },
];

@Injectable({
  providedIn: 'root',
})
export class CommunityService {
  private http = inject(HttpClient);
  private apiBaseUrl = inject(API_BASE_URL);
  private baseUrl = `${this.apiBaseUrl}/communities`;
  private socialBaseUrl = `${this.apiBaseUrl}/social/community`;

  private getCityImageUrl(slug: string): string {
    return CITY_IMAGES[slug] || CITY_IMAGES['default'];
  }

  private getCityHighlights(slug: string): string[] {
    return CITY_HIGHLIGHTS[slug] || [];
  }

  getCommunities(): Promise<LocalCommunity[]> {
    return firstValueFrom(this.http.get<LocalCommunity[]>(this.baseUrl)).then(
      (communities) => {
        if (!Array.isArray(communities)) {
          console.error('API returned non-array for communities:', communities);
          return [];
        }
        return communities.map((c) => ({
          ...c,
          imageUrl: c.imageUrl || this.getCityImageUrl(c.slug),
          highlights: c.highlights?.length
            ? c.highlights
            : this.getCityHighlights(c.slug),
          coordinates: c.coordinates || {
            lat: c.lat || 0,
            lng: c.lng || 0,
          },
        }));
      }
    );
  }

  getCommunityBySlug(slug: string): Promise<LocalCommunity> {
    return firstValueFrom(
      this.http.get<LocalCommunity>(`${this.baseUrl}/${slug}`)
    ).then((c) => ({
      ...c,
      imageUrl: c.imageUrl || this.getCityImageUrl(c.slug),
      highlights: c.highlights?.length
        ? c.highlights
        : this.getCityHighlights(c.slug),
      coordinates: c.coordinates || { lat: c.lat || 0, lng: c.lng || 0 },
    }));
  }

  getSubCommunities(parentId: string): Promise<LocalCommunity[]> {
    return firstValueFrom(
      this.http.get<LocalCommunity[]>(
        `${this.baseUrl}/${parentId}/sub-communities`
      )
    ).then((communities) => {
      if (!Array.isArray(communities)) {
        console.error(
          'API returned non-array for sub-communities:',
          communities
        );
        return [];
      }
      return communities.map((c) => ({
        ...c,
        imageUrl: c.imageUrl || this.getCityImageUrl(c.slug),
        highlights: c.highlights?.length
          ? c.highlights
          : this.getCityHighlights(c.slug),
        coordinates: c.coordinates || { lat: c.lat || 0, lng: c.lng || 0 },
      }));
    });
  }

  joinCommunity(communityId: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`${this.baseUrl}/${communityId}/join`, {})
    );
  }

  leaveCommunity(communityId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/${communityId}/membership`)
    );
  }

  isMember(communityId: string): Promise<boolean> {
    return firstValueFrom(
      this.http.get<boolean>(`${this.baseUrl}/${communityId}/membership`)
    );
  }

  getMyMemberships(): Promise<LocalCommunity[]> {
    return firstValueFrom(
      this.http.get<LocalCommunity[]>(`${this.socialBaseUrl}/user/communities`)
    ).then((communities) => {
      if (!Array.isArray(communities)) return [];
      return communities.map((c) => ({
        ...c,
        imageUrl: c.imageUrl || this.getCityImageUrl(c.slug),
        highlights: c.highlights?.length
          ? c.highlights
          : this.getCityHighlights(c.slug),
        coordinates: c.coordinates || { lat: c.lat || 0, lng: c.lng || 0 },
      }));
    });
  }

  async getCities(): Promise<City[]> {
    try {
      const communities = await this.getCommunities();

      const citiesMap = new Map<string, City>();

      for (const community of communities) {
        if (community.localityType === 'city' && community.slug) {
          const key = community.city || community.name;
          if (!citiesMap.has(key)) {
            citiesMap.set(key, {
              id: community.id,
              name: community.city || community.name,
              slug: community.slug,
              countryCode: community.countryCode || 'US',
              adminArea: community.adminArea || '',
              description: community.description || '',
              imageUrl:
                community.imageUrl || this.getCityImageUrl(community.slug),
              coordinates: {
                lat: community.coordinates?.lat || community.lat || 0,
                lng: community.coordinates?.lng || community.lng || 0,
              },
              population: community.population || 0,
              timezone: 'America/New_York',
              highlights: this.getCityHighlights(community.slug),
              communities: 1,
            });
          }
        }
      }

      const cities = Array.from(citiesMap.values());
      return cities;
    } catch (error) {
      console.error('Failed to fetch cities:', error);
      return [];
    }
  }

  async getCityBySlug(slug: string): Promise<City | undefined> {
    try {
      const community = await this.getCommunityBySlug(slug);

      if (!community || community.localityType !== 'city') {
        return undefined;
      }

      const allCommunities = await this.getCommunities();
      const cityCommunities = allCommunities.filter(
        (c) => c.city === community.city && c.localityType === 'city'
      );

      return {
        id: community.id,
        name: community.city || community.name,
        slug: community.slug,
        countryCode: community.countryCode || 'US',
        adminArea: community.adminArea || '',
        description: community.description || '',
        imageUrl: community.imageUrl || this.getCityImageUrl(community.slug),
        coordinates: {
          lat: community.coordinates?.lat || community.lat || 0,
          lng: community.coordinates?.lng || community.lng || 0,
        },
        population: community.population || 0,
        timezone: 'America/New_York',
        highlights: this.getCityHighlights(community.slug),
        communities: cityCommunities.length,
      };
    } catch (error) {
      console.error('Failed to fetch city:', error);
      return undefined;
    }
  }

  async getMockCommunities(): Promise<LocalCommunity[]> {
    try {
      const communities = await this.getCommunities();
      return communities.filter(
        (c) => !c.localityType || c.localityType !== 'city'
      );
    } catch (error) {
      console.error('Failed to fetch communities:', error);
      return [];
    }
  }

  /**
   * Get all communities for a city page — includes the city community itself
   * and its sub-communities fetched via the parent-child API.
   */
  async getCommunitiesForCity(citySlug: string): Promise<LocalCommunity[]> {
    try {
      const cityCommunity = await this.getCommunityBySlug(citySlug);
      if (!cityCommunity) return [];

      // Fetch sub-communities registered with this city as parent
      const subCommunities = await this.getSubCommunities(cityCommunity.id);

      // Also fetch any communities sharing the same city name without parentId
      // (legacy data compatibility)
      const allCommunities = await this.getCommunities();
      const legacyChildren = allCommunities.filter((c) => {
        if (c.id === cityCommunity.id) return false;
        if (c.parentId) return false; // already handled via parentId path
        const communityCity = (c.city || '').toLowerCase().replace(/\s+/g, '-');
        return communityCity === citySlug;
      });

      const combined = [cityCommunity, ...subCommunities, ...legacyChildren];
      // Deduplicate by id
      const seen = new Set<string>();
      return combined.filter((c) => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
    } catch (error) {
      console.error('Failed to fetch communities for city:', error);
      return [];
    }
  }

  getMockCommunitiesForCity(citySlug: string): Promise<LocalCommunity[]> {
    return this.getCommunitiesForCity(citySlug);
  }

  getPostsForCity(citySlug: string): Promise<CityPost[]> {
    const cityGeneralSlug = `${citySlug}-general`;
    return Promise.resolve(
      MOCK_POSTS.filter(
        (post) =>
          post.communitySlug === cityGeneralSlug ||
          post.communitySlug === citySlug
      )
    );
  }

  getPostsForCommunity(communitySlug: string): Promise<CityPost[]> {
    return Promise.resolve(
      MOCK_POSTS.filter((post) => post.communitySlug === communitySlug)
    );
  }
}

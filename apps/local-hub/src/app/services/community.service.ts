import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL, CommunityTag } from '@optimistic-tanuki/ui-models';
import { firstValueFrom } from 'rxjs';

export interface LocalCommunity {
  id: string;
  name: string;
  slug: string;
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
  'savannah-foodies':
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
  'savannah-tech':
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80',
  'savannah-parents':
    'https://images.unsplash.com/photo-1490109662329-9554gea7e-49f2f1f2f2f2?w=800&q=80',
  'charleston-sc':
    'https://images.unsplash.com/photo-1569974507005-6dc61f97fb5c?w=800&q=80',
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
  'hilton-head-outdoors':
    'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=800&q=80',
  'brunswick-ga':
    'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&q=80',
  'golden-isles-beach':
    'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=800&q=80',
  'beaufort-sc':
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
  'beaufort-waterfront':
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
  'jacksonville-fl':
    'https://images.unsplash.com/photo-1590059582956-94bf1a8522d7?w=800&q=80',
  'jacksonville-beach':
    'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=800&q=80',
  'jacksonville-tech':
    'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&q=80',
  'augusta-ga':
    'https://images.unsplash.com/photo-1569025743873-ea3a9bera3c9?w=800&q=80',
  'augusta-masters':
    'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800&q=80',
  'augusta-military-families':
    'https://images.unsplash.com/photo-1543076447-215ad9ba6923?w=800&q=80',
  'aiken-sc':
    'https://images.unsplash.com/photo-1531633498708-6419951c6fa5?w=800&q=80',
  'aiken-equestrian':
    'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=800&q=80',
  'statesboro-ga':
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&q=80',
  'georgia-southern-eagles':
    'https://images.unsplash.com/photo-1568603074322-a4ecb1af6745?w=800&q=80',
  'statesboro-downtown':
    'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80',
  'hinesville-ga':
    'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=80',
  'fort-stewart-families':
    'https://images.unsplash.com/photo-1543076447-215ad9ba6923?w=800&q=80',
  'dublin-ga':
    'https://images.unsplash.com/photo-1543076447-215ad9ba6923?w=800&q=80',
  'vidalia-ga':
    'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800&q=80',
  'waycross-ga':
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
  'waycross-outdoors':
    'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=800&q=80',
  'jesup-ga':
    'https://images.unsplash.com/photo-1543076447-215ad9ba6923?w=800&q=80',
  'fernandina-beach-fl':
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
  'amelia-island-living':
    'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=800&q=80',
  'orangeburg-sc':
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80',
  'orangeburg-students':
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80',
  'douglas-ga':
    'https://images.unsplash.com/photo-1543076447-215ad9ba6923?w=800&q=80',
  'columbia-sc':
    'https://images.unsplash.com/photo-1490109662329-9554gea7e-49f2f1f2f2f2?w=800&q=80',
  'usc-gamecocks':
    'https://images.unsplash.com/photo-1568603074322-a4ecb1af6745?w=800&q=80',
  'columbia-real-estate':
    'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
  'greenville-sc':
    'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80',
  'greenville-downtown':
    'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80',
  'greenville-food-scene':
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
  'myrtle-beach-sc':
    'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=800&q=80',
  'myrtle-beach-golf':
    'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800&q=80',
  'wilmington-nc':
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
    'Riverfront',
    'Ghost Tours',
    'Southern Cuisine',
  ],
  'charleston-sc': [
    'Historic District',
    'Waterfront',
    'Southern Food',
    'Antebellum Homes',
  ],
  'hilton-head-island-sc': ['Beaches', 'Golf', 'Resorts', 'Water Sports'],
  'brunswick-ga': ['Golden Isles', 'Seafood', 'Historic District', 'Beaches'],
  'beaufort-sc': [
    'Lowcountry',
    'Gullah Culture',
    'Waterways',
    'Antebellum Architecture',
  ],
  'jacksonville-fl': ['Beaches', 'St. Johns River', 'Craft Beer', 'Sports'],
  'augusta-ga': [
    'The Masters',
    'Riverwalk',
    'Cyber Corridor',
    'Historic Homes',
  ],
  'aiken-sc': [
    'Horse Country',
    'Equestrian',
    'Historic District',
    'Fine Dining',
  ],
  'statesboro-ga': [
    'Georgia Southern',
    'Downtown',
    'Southern Cuisine',
    'College Town',
  ],
  'hinesville-ga': [
    'Fort Stewart',
    'Military Community',
    'Growing Economy',
    'Family-Friendly',
  ],
  'fernandina-beach-fl': [
    'Amelia Island',
    'Victorian Architecture',
    'Beaches',
    'Historic District',
  ],
  'dublin-ga': [
    "St. Patrick's Festival",
    'Oconee River',
    'Emerald City',
    'Business Community',
  ],
  'vidalia-ga': [
    'Vidalia Onions',
    'Agriculture',
    'Small Town',
    'Georgia Grown',
  ],
  'waycross-ga': [
    'Okefenokee Swamp',
    'Nature',
    'Outdoor Adventure',
    'Railroad History',
  ],
  'jesup-ga': ['Carpet Capital', 'Timber', 'Agriculture', 'Southeast Georgia'],
  'orangeburg-sc': ['SC State', 'Claflin University', 'HBCU', 'Festivals'],
  'douglas-ga': [
    'Coffee County',
    'Agriculture',
    'Manufacturing',
    'South Georgia',
  ],
  'columbia-sc': [
    'USC Gamecocks',
    'State Capital',
    'Historic Districts',
    'Culinary Scene',
  ],
  'greenville-sc': ['Falls Park', 'Arts Scene', 'Downtown', 'Gastronomy'],
  'myrtle-beach-sc': [
    'Grand Strand',
    'Golf Courses',
    'Beach Life',
    'Entertainment',
  ],
  'wilmington-nc': [
    'Historic Downtown',
    'Cape Fear River',
    'Film Industry',
    'Beaches',
  ],
};

@Injectable({
  providedIn: 'root',
})
export class CommunityService {
  private http = inject(HttpClient);
  private apiBaseUrl = inject(API_BASE_URL);
  private baseUrl = `${this.apiBaseUrl}/communities`;

  private getCityImageUrl(slug: string): string {
    return CITY_IMAGES[slug] || CITY_IMAGES['default'];
  }

  private getCityHighlights(slug: string): string[] {
    return CITY_HIGHLIGHTS[slug] || [];
  }

  getCommunities(): Promise<LocalCommunity[]> {
    return firstValueFrom(this.http.get<LocalCommunity[]>(this.baseUrl));
  }

  getCommunityBySlug(slug: string): Promise<LocalCommunity> {
    return firstValueFrom(
      this.http.get<LocalCommunity>(`${this.baseUrl}/${slug}`)
    );
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
              imageUrl: this.getCityImageUrl(community.slug),
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
        imageUrl: this.getCityImageUrl(community.slug),
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

  getMockCommunitiesForCity(citySlug: string): Promise<LocalCommunity[]> {
    return this.getMockCommunities().then((communities) =>
      communities.filter((c) => {
        const communityCity = (c.city || '').toLowerCase().replace(/\s+/g, '-');
        return communityCity === citySlug || c.slug === citySlug;
      })
    );
  }
}

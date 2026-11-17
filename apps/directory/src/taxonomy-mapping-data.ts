import {
  DIRECTORY_TAXONOMY_CATEGORIES,
  DIRECTORY_TAXONOMY_PLACE_TYPES,
  type TaxonomyExclusionReason,
} from '../../../libs/social/contracts/src/lib/directory';

/**
 * Checked-in taxonomy mappings (S7d), ported from the business-directory POC's pinned Overture v3 category roots
 * (`OVERTURE_V3_TAXONOMY_MAPPING` in `libs/providers/.../taxonomy-v1.ts`) plus the stored Overture `basic_category`
 * values the local evaluation screens for (`LOW_RISK_ADDRESS_CATEGORIES`) and the education and place-of-worship
 * facets. A mapping is data: operators install a version with the "install mapping version" operation, and a
 * reclassification run applies it. Changing a mapping means adding a NEW version; an installed version id whose
 * content changed is refused.
 *
 * The private rows retain only `basic_category` (as `listing.category`), so `basic_category` rows do the work today.
 * `taxonomy_node` rows apply when a listing also carries its taxonomy path; they are matched most-specific first,
 * and adult nodes always win, exactly as in the POC.
 */
export interface TaxonomyMappingEntry {
  readonly kind: 'basic_category' | 'taxonomy_node';
  readonly key: string;
  readonly categoryId?: string;
  readonly placeTypeId?: string;
  readonly excluded?: true;
  readonly exclusionReason?: TaxonomyExclusionReason;
}
export interface TaxonomyMappingFile {
  readonly version: string;
  /** What a stored category the mapping does not know becomes: keep the stored value, or leave the directory. */
  readonly unmappedPolicy: 'keep_legacy' | 'exclude';
  readonly categories: readonly string[];
  readonly placeTypes: readonly { id: string; categoryId: string }[];
  readonly entries: readonly TaxonomyMappingEntry[];
}

type Facet = Record<string, readonly string[]>;
const expand = (
  kind: TaxonomyMappingEntry['kind'],
  byCategory: Facet
): TaxonomyMappingEntry[] =>
  Object.entries(byCategory).flatMap(([categoryId, keys]) =>
    keys.map((key) => ({ kind, key, categoryId }))
  );

/** Overture `basic_category` slugs seen in private rows, by the directory category they belong to. */
const BASIC_CATEGORIES: Facet = {
  restaurants: [
    'restaurant',
    'casual_eatery',
    'fast_food_restaurant',
    'cafe',
    'coffee_shop',
    'bakery',
    'bar',
    'pub',
    'pizza_restaurant',
    'food_truck_stand',
    'ice_cream_shop',
    'deli',
    'catering',
    'brewery',
  ],
  activities: [
    'attraction',
    'museum',
    'park',
    'entertainment',
    'scenic_viewpoint',
    'beach',
    'nature_reserve',
    'botanical_garden',
    'movie_theater',
    'amusement_park',
    'sports_and_recreation_venue',
    'gym',
    'golf_course',
    'campground',
    'bowling_alley',
    'zoo',
  ],
  services: [
    'service',
    'professional_service',
    'repair',
    'fueling_station',
    'gas_station',
    'hotel',
    'motel',
    'bank',
    'atm',
    'insurance_agency',
    'real_estate_agency',
    'law_firm',
    'accountant',
    'hospital',
    'clinic',
    'doctor',
    'dentist',
    'pharmacy',
    'veterinarian',
    'beauty_salon',
    'barber',
    'laundromat',
    'auto_repair_shop',
    'car_wash',
    'post_office',
    'government_office',
    'police_department',
    'fire_department',
    'radio_station',
  ],
  stores: [
    'shop',
    'supermarket',
    'retail',
    'convenience_store',
    'shopping',
    'food_and_beverage_store',
    'grocery_store',
    'discount_store',
    'second_hand_store',
    'specialty_store',
    'hardware_home_and_garden_store',
    'electronics_store',
    'fashion_and_apparel_store',
    'flowers_and_gifts_store',
    'vehicle_parts_store',
    'department_store',
    'furniture_store',
    'pet_store',
    'book_store',
    'auto_dealer',
    'vehicle_dealer',
    'car_dealer',
  ],
  places_and_landmarks: [
    'lake',
    'river',
    'bridge',
    'cave',
    'geographic_entities',
    'landmark',
    'monument',
    'historic_site',
  ],
  education: [
    'education',
    'school',
    'elementary_school',
    'middle_school',
    'high_school',
    'college',
    'college_university',
    'university',
    'library',
    'preschool',
    'child_care',
    'technical_school',
  ],
  places_of_worship: [
    'place_of_worship',
    'church',
    'mosque',
    'synagogue',
    'temple',
    'religious_organization',
    'cathedral',
    'chapel',
  ],
};

/** Overture taxonomy ancestry nodes (POC v3 category roots and legacy nodes). */
const TAXONOMY_NODES: Facet = {
  restaurants: [
    'food_and_drink',
    'restaurant',
    'casual_eatery',
    'cafe',
    'fast_food_restaurant',
    'food_truck_stand',
  ],
  activities: [
    'arts_and_entertainment',
    'cultural_and_historic',
    'sports_and_recreation',
    'attraction',
    'museum',
    'park',
    'entertainment',
    'scenic_viewpoint',
    'beach',
    'nature_reserve',
    'botanical_garden',
  ],
  services: [
    'services_and_business',
    'health_care',
    'lifestyle_services',
    'travel_and_transportation',
    'community_and_government',
    'lodging',
    'service',
    'professional_service',
    'repair',
    'fueling_station',
  ],
  stores: ['shopping', 'shop', 'supermarket', 'retail', 'convenience_store'],
  places_and_landmarks: [
    'lake',
    'river',
    'bridge',
    'cave',
    'geographic_entities',
  ],
  education: ['education'],
  places_of_worship: ['place_of_worship'],
  // Adult rows are served only to a visitor who opted in; the classifier turns this into an exclusion otherwise.
  adult: ['adult_entertainment_venue', 'adult_store', 'adult'],
};

const PLACE_TYPES: readonly TaxonomyMappingEntry[] = [
  ...['radio_station'].flatMap((key) =>
    (['basic_category', 'taxonomy_node'] as const).map((kind) => ({
      kind,
      key,
      categoryId: 'services',
      placeTypeId: 'radio_station',
    }))
  ),
  ...['auto_dealer', 'vehicle_dealer', 'car_dealer'].flatMap((key) =>
    (['basic_category', 'taxonomy_node'] as const).map((kind) => ({
      kind,
      key,
      categoryId: 'stores',
      placeTypeId: 'auto_dealer',
    }))
  ),
];

const withPlaceTypes = (entries: TaxonomyMappingEntry[]) => {
  const refined = new Map(
    PLACE_TYPES.map((e) => [`${e.kind}:${e.key}`, e] as const)
  );
  const merged = entries.map((e) => refined.get(`${e.kind}:${e.key}`) ?? e);
  const present = new Set(merged.map((e) => `${e.kind}:${e.key}`));
  return [
    ...merged,
    ...PLACE_TYPES.filter((e) => !present.has(`${e.kind}:${e.key}`)),
  ];
};

export const TAXONOMY_MAPPINGS: readonly TaxonomyMappingFile[] = [
  {
    version: 'overture-v3-local-2026-11.1',
    unmappedPolicy: 'keep_legacy',
    categories: DIRECTORY_TAXONOMY_CATEGORIES.map((c) => c.id),
    placeTypes: DIRECTORY_TAXONOMY_PLACE_TYPES.map((p) => ({
      id: p.id,
      categoryId: p.categoryId,
    })),
    entries: withPlaceTypes([
      ...expand('basic_category', BASIC_CATEGORIES),
      ...expand('taxonomy_node', TAXONOMY_NODES),
    ]),
  },
];

export const findTaxonomyMapping = (
  version: string
): TaxonomyMappingFile | undefined =>
  TAXONOMY_MAPPINGS.find((m) => m.version === version);

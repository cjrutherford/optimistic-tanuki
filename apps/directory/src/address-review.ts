/**
 * Pure address-review decision engine.
 *
 * This module does not fetch evidence and does not write to the database. It
 * classifies a candidate after the caller has supplied the rights decision,
 * geocode result and official-page evidence. The public projection still
 * requires the existing reviewed-field writer and rights policy.
 */

export type AddressReviewVerdict = 'auto_approve' | 'needs_human' | 'reject';
export type AddressReviewRights = 'eligible' | 'review' | 'denied';
export type GeocodePrecision =
  | 'rooftop'
  | 'range'
  | 'street'
  | 'locality'
  | 'unknown';
export type CheckStatus = 'pass' | 'fail' | 'unknown';

export interface AddressReviewCandidate {
  sourceRow: number;
  name: string;
  category: string;
  taxonomy?: readonly string[];
  point?: { lat: number; lng: number } | null;
  addresses: readonly string[];
  websites?: readonly string[];
  phones?: readonly string[];
  rights: AddressReviewRights;
  residential?: boolean;
  sensitive?: boolean;
  adult?: boolean;
}

export interface GeocodeEvidence {
  status: 'match' | 'no_match' | 'ambiguous' | 'error';
  normalizedAddress?: string;
  coordinates?: { lat: number; lng: number } | null;
  precision?: GeocodePrecision;
  distanceMeters?: number | null;
  provider?: string;
  checkedAt?: string;
}

export interface OfficialEvidence {
  url: string;
  status: 'fetched' | 'unavailable' | 'blocked' | 'invalid';
  nameMatch?: boolean;
  addressMatch?: boolean;
  phoneMatch?: boolean;
  websiteMatch?: boolean;
  fetchedAt?: string;
  evidenceHash?: string;
  httpStatus?: number;
  transport?: 'http' | 'https';
}

export interface AddressReviewPolicy {
  version: string;
  requireOfficialEvidence: boolean;
  maxDistanceMeters: Readonly<Record<GeocodePrecision, number>>;
  hardMaxDistanceMeters: number;
  minNameSimilarity: number;
  maxEvidenceAgeDays: number;
}

export interface AddressReviewDecision {
  verdict: AddressReviewVerdict;
  reasons: string[];
  checks: Record<string, CheckStatus>;
  policyVersion: string;
  thresholds: {
    maxDistanceMeters: number | null;
    hardMaxDistanceMeters: number;
    minNameSimilarity: number;
    maxEvidenceAgeDays: number;
    requireOfficialEvidence: boolean;
  };
}

export const DEFAULT_ADDRESS_REVIEW_POLICY: AddressReviewPolicy = {
  version: 'address-review-v1',
  requireOfficialEvidence: true,
  maxDistanceMeters: {
    rooftop: 150,
    range: 1000,
    street: 1000,
    locality: 0,
    unknown: 0,
  },
  hardMaxDistanceMeters: 2000,
  minNameSimilarity: 0.8,
  maxEvidenceAgeDays: 30,
};

function hasControlCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

export function haversineMeters(
  origin: { lat: number; lng: number },
  target: { lat: number; lng: number }
): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(target.lat - origin.lat);
  const dLng = toRadians(target.lng - origin.lng);
  const originLat = toRadians(origin.lat);
  const targetLat = toRadians(target.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(originLat) * Math.cos(targetLat) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371000 * c;
}

function validAddress(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= 300 &&
    !hasControlCharacters(trimmed)
  );
}

function validPoint(
  value: { lat: number; lng: number } | null | undefined
): value is { lat: number; lng: number } {
  return (
    !!value &&
    Number.isFinite(value.lat) &&
    Number.isFinite(value.lng) &&
    Math.abs(value.lat) <= 90 &&
    Math.abs(value.lng) <= 180
  );
}

function add(
  checks: Record<string, CheckStatus>,
  reasons: string[],
  check: string,
  status: CheckStatus,
  reason?: string
): void {
  checks[check] = status;
  if (status !== 'pass' && reason && !reasons.includes(reason)) {
    reasons.push(reason);
  }
}

function evidenceAgeDays(
  fetchedAt: string | undefined,
  now: Date
): number | null {
  if (!fetchedAt) return null;
  const timestamp = Date.parse(fetchedAt);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, (now.getTime() - timestamp) / 86_400_000);
}

export function decideAddressReview(input: {
  candidate: AddressReviewCandidate;
  geocode?: GeocodeEvidence | null;
  official?: OfficialEvidence | null;
  policy?: AddressReviewPolicy;
  now?: Date;
}): AddressReviewDecision {
  const policy = input.policy ?? DEFAULT_ADDRESS_REVIEW_POLICY;
  const now = input.now ?? new Date();
  const checks: Record<string, CheckStatus> = {};
  const reasons: string[] = [];
  const candidate = input.candidate;
  const addresses = (candidate.addresses ?? [])
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0);

  if (addresses.length === 0) {
    add(checks, reasons, 'addressPresent', 'fail', 'missing_address');
  } else {
    add(checks, reasons, 'addressPresent', 'pass');
  }

  if (addresses.length === 1) {
    add(checks, reasons, 'singleAddress', 'pass');
  } else if (addresses.length > 1) {
    add(checks, reasons, 'singleAddress', 'unknown', 'multiple_addresses');
  }

  const badAddress = addresses.find((address) => !validAddress(address));
  if (badAddress) {
    add(checks, reasons, 'addressValid', 'fail', 'invalid_address');
  } else if (addresses.length > 0) {
    add(checks, reasons, 'addressValid', 'pass');
  }

  if (candidate.rights === 'eligible') {
    add(checks, reasons, 'rights', 'pass');
  } else if (candidate.rights === 'denied') {
    add(checks, reasons, 'rights', 'fail', 'rights_denied');
  } else {
    add(checks, reasons, 'rights', 'unknown', 'rights_review_required');
  }

  if (candidate.adult === false) {
    add(checks, reasons, 'adult', 'pass');
  } else if (candidate.adult === true) {
    add(checks, reasons, 'adult', 'fail', 'adult_listing');
  } else {
    add(checks, reasons, 'adult', 'unknown', 'adult_classification_unknown');
  }

  if (candidate.sensitive === false) {
    add(checks, reasons, 'sensitive', 'pass');
  } else if (candidate.sensitive === true) {
    add(checks, reasons, 'sensitive', 'fail', 'sensitive_location');
  } else {
    add(
      checks,
      reasons,
      'sensitive',
      'unknown',
      'sensitive_classification_unknown'
    );
  }

  if (candidate.residential === false) {
    add(checks, reasons, 'residential', 'pass');
  } else if (candidate.residential === true) {
    add(checks, reasons, 'residential', 'fail', 'residential_location');
  } else {
    add(
      checks,
      reasons,
      'residential',
      'unknown',
      'residential_classification_unknown'
    );
  }

  if (validPoint(candidate.point)) {
    add(checks, reasons, 'sourcePoint', 'pass');
  } else {
    add(checks, reasons, 'sourcePoint', 'unknown', 'missing_source_point');
  }

  const geocode = input.geocode;
  let effectivePrecision: GeocodePrecision = 'unknown';
  let effectiveDistance: number | null = null;
  if (!geocode) {
    add(checks, reasons, 'geocode', 'unknown', 'geocode_missing');
  } else if (geocode.status === 'no_match') {
    add(checks, reasons, 'geocode', 'fail', 'geocode_no_match');
  } else if (geocode.status === 'ambiguous') {
    add(checks, reasons, 'geocode', 'unknown', 'geocode_ambiguous');
  } else if (geocode.status === 'error') {
    add(checks, reasons, 'geocode', 'unknown', 'geocode_error');
  } else {
    add(checks, reasons, 'geocode', 'pass');
    effectivePrecision = geocode.precision ?? 'unknown';
    if (
      effectivePrecision === 'unknown' ||
      effectivePrecision === 'locality'
    ) {
      add(
        checks,
        reasons,
        'geocodePrecision',
        'unknown',
        'geocode_low_precision'
      );
    } else {
      add(checks, reasons, 'geocodePrecision', 'pass');
      effectiveDistance =
        typeof geocode.distanceMeters === 'number'
          ? geocode.distanceMeters
          : validPoint(geocode.coordinates) && validPoint(candidate.point)
          ? haversineMeters(candidate.point, geocode.coordinates)
          : null;
      if (effectiveDistance === null) {
        add(
          checks,
          reasons,
          'geocodeDistance',
          'unknown',
          'geocode_distance_missing'
        );
      } else if (effectiveDistance > policy.hardMaxDistanceMeters) {
        add(checks, reasons, 'geocodeDistance', 'fail', 'point_too_far');
      } else if (
        effectiveDistance >
        policy.maxDistanceMeters[effectivePrecision]
      ) {
        add(
          checks,
          reasons,
          'geocodeDistance',
          'unknown',
          'point_distance_requires_review'
        );
      } else {
        add(checks, reasons, 'geocodeDistance', 'pass');
      }
    }
  }

  if (policy.requireOfficialEvidence) {
    const official = input.official;
    if (!official) {
      add(
        checks,
        reasons,
        'officialEvidence',
        'unknown',
        'official_evidence_missing'
      );
    } else if (official.status !== 'fetched') {
      add(
        checks,
        reasons,
        'officialEvidence',
        'unknown',
        'official_evidence_unavailable'
      );
    } else {
      add(checks, reasons, 'officialEvidence', 'pass');
      if (official.nameMatch === true) {
        add(checks, reasons, 'officialName', 'pass');
      } else if (official.nameMatch === false) {
        add(
          checks,
          reasons,
          'officialName',
          'unknown',
          'official_name_mismatch'
        );
      } else {
        add(
          checks,
          reasons,
          'officialName',
          'unknown',
          'official_name_missing'
        );
      }

      if (official.addressMatch === true) {
        add(checks, reasons, 'officialAddress', 'pass');
      } else if (official.addressMatch === false) {
        add(
          checks,
          reasons,
          'officialAddress',
          'unknown',
          'official_address_mismatch'
        );
      } else {
        add(
          checks,
          reasons,
          'officialAddress',
          'unknown',
          'official_address_missing'
        );
      }

      const hasPhone = (candidate.phones ?? []).some(
        (value) => typeof value === 'string' && value.trim().length > 0
      );
      const hasWebsite = (candidate.websites ?? []).some(
        (value) => typeof value === 'string' && value.trim().length > 0
      );
      if (!hasPhone) {
        add(checks, reasons, 'officialPhone', 'pass');
      } else if (official.phoneMatch === true) {
        add(checks, reasons, 'officialPhone', 'pass');
      } else {
        add(
          checks,
          reasons,
          'officialPhone',
          'unknown',
          'official_phone_mismatch'
        );
      }
      if (!hasWebsite) {
        add(checks, reasons, 'officialWebsite', 'pass');
      } else if (official.websiteMatch === true) {
        add(checks, reasons, 'officialWebsite', 'pass');
      } else {
        add(
          checks,
          reasons,
          'officialWebsite',
          'unknown',
          'official_website_mismatch'
        );
      }

      const age = evidenceAgeDays(official.fetchedAt, now);
      if (age === null) {
        add(
          checks,
          reasons,
          'evidenceAge',
          'unknown',
          'official_evidence_age_missing'
        );
      } else if (age > policy.maxEvidenceAgeDays) {
        add(
          checks,
          reasons,
          'evidenceAge',
          'unknown',
          'official_evidence_stale'
        );
      } else {
        add(checks, reasons, 'evidenceAge', 'pass');
      }
    }
  }

  const hasFailure = Object.values(checks).includes('fail');
  const hasUnknown = Object.values(checks).includes('unknown');
  const verdict: AddressReviewVerdict = hasFailure
    ? 'reject'
    : hasUnknown
    ? 'needs_human'
    : 'auto_approve';

  return {
    verdict,
    reasons,
    checks,
    policyVersion: policy.version,
    thresholds: {
      maxDistanceMeters:
        effectivePrecision === 'unknown' || effectivePrecision === 'locality'
          ? null
          : policy.maxDistanceMeters[effectivePrecision],
      hardMaxDistanceMeters: policy.hardMaxDistanceMeters,
      minNameSimilarity: policy.minNameSimilarity,
      maxEvidenceAgeDays: policy.maxEvidenceAgeDays,
      requireOfficialEvidence: policy.requireOfficialEvidence,
    },
  };
}

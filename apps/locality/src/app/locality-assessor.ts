import {
  LocalityAssessmentDto,
  LocalityObservationInputDto,
  LocalityObservationStateDto,
} from '@optimistic-tanuki/models';

export const LOCALITY_DEFAULT_MAX_ACCURACY_METERS = 1000;
export const LOCALITY_MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;
export const LOCALITY_MAX_TRAVEL_SPEED_KMH = 900;

const EARTH_RADIUS_KM = 6371;

export function validateLocalityObservation(
  input: LocalityObservationInputDto
): Date {
  if (
    !input ||
    typeof input.subjectId !== 'string' ||
    !input.subjectId.trim()
  ) {
    throw new Error('subjectId must be a non-empty string');
  }
  if (input.source !== 'live-playback') {
    throw new Error('source must be live-playback');
  }
  if (!Number.isFinite(input.lat) || input.lat < -90 || input.lat > 90) {
    throw new Error('lat must be between -90 and 90');
  }
  if (!Number.isFinite(input.lng) || input.lng < -180 || input.lng > 180) {
    throw new Error('lng must be between -180 and 180');
  }
  if (
    input.accuracyMeters !== undefined &&
    (!Number.isFinite(input.accuracyMeters) || input.accuracyMeters < 0)
  ) {
    throw new Error('accuracyMeters must be a non-negative number');
  }

  const observedAt = new Date(input.observedAt);
  if (!input.observedAt || Number.isNaN(observedAt.getTime())) {
    throw new Error('observedAt must be a valid ISO timestamp');
  }
  return observedAt;
}

export function assessLocalityObservation(
  input: LocalityObservationInputDto,
  prior: LocalityObservationStateDto | undefined,
  now: Date = new Date(),
  maxAccuracyMeters = LOCALITY_DEFAULT_MAX_ACCURACY_METERS,
  maxTravelSpeedKmh = LOCALITY_MAX_TRAVEL_SPEED_KMH
): LocalityAssessmentDto {
  const observedAt = validateLocalityObservation(input);
  const reasons: string[] = [];

  if (
    Math.abs(now.getTime() - observedAt.getTime()) >
    LOCALITY_MAX_TIMESTAMP_SKEW_MS
  ) {
    reasons.push('timestamp-skew');
  }
  if (
    input.accuracyMeters !== undefined &&
    input.accuracyMeters > maxAccuracyMeters
  ) {
    reasons.push('poor-accuracy');
  }
  if (prior) {
    const elapsedHours =
      (observedAt.getTime() - new Date(prior.observedAt).getTime()) /
      (60 * 60 * 1000);
    const distanceKm = distanceBetweenKm(
      prior.lat,
      prior.lng,
      input.lat,
      input.lng
    );
    const speedKmh = elapsedHours > 0 ? distanceKm / elapsedHours : Infinity;
    if (speedKmh > maxTravelSpeedKmh) {
      reasons.push('impossible-travel');
    }
  }

  return {
    status: reasons.length ? 'suspicious' : 'observed',
    confidenceScore: Math.max(0, 100 - reasons.length * 25),
    reasons,
    observedAt: observedAt.toISOString(),
    action: 'observe',
  };
}

function distanceBetweenKm(
  firstLat: number,
  firstLng: number,
  secondLat: number,
  secondLng: number
): number {
  const latDelta = toRadians(secondLat - firstLat);
  const lngDelta = toRadians(secondLng - firstLng);
  const firstLatitude = toRadians(firstLat);
  const secondLatitude = toRadians(secondLat);
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(lngDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

import {
  LocalityObservationInputDto,
  LocalityObservationStateDto,
} from '@optimistic-tanuki/models';
import { assessLocalityObservation } from './locality-assessor';

const NOW = new Date('2026-07-18T15:00:00.000Z');

const observation = (
  overrides: Partial<LocalityObservationInputDto> = {}
): LocalityObservationInputDto => ({
  subjectId: 'opaque-session-hash',
  source: 'live-playback',
  lat: 40.7128,
  lng: -74.006,
  observedAt: NOW.toISOString(),
  ...overrides,
});

describe('assessLocalityObservation', () => {
  it('marks a valid first observation as observed without trusting it', () => {
    expect(assessLocalityObservation(observation(), undefined, NOW)).toEqual(
      expect.objectContaining({
        status: 'observed',
        confidenceScore: expect.any(Number),
        reasons: [],
        observedAt: NOW.toISOString(),
        action: 'observe',
      })
    );
  });

  it('marks observations outside the five-minute timestamp window as suspicious', () => {
    const result = assessLocalityObservation(
      observation({ observedAt: '2026-07-18T14:49:00.000Z' }),
      undefined,
      NOW
    );

    expect(result.status).toBe('suspicious');
    expect(result.reasons).toContain('timestamp-skew');
  });

  it('marks observations with poor GPS accuracy as suspicious', () => {
    const result = assessLocalityObservation(
      observation({ accuracyMeters: 1000.01 }),
      undefined,
      NOW
    );

    expect(result.status).toBe('suspicious');
    expect(result.reasons).toContain('poor-accuracy');
  });

  it('marks observations implying travel above 900 km/h as suspicious', () => {
    const prior: LocalityObservationStateDto = {
      subjectId: 'opaque-session-hash',
      source: 'live-playback',
      lat: 40.7128,
      lng: -74.006,
      observedAt: '2026-07-18T14:00:00.000Z',
    };

    const result = assessLocalityObservation(
      observation({ lat: 51.5074, lng: -0.1278 }),
      prior,
      NOW
    );

    expect(result.status).toBe('suspicious');
    expect(result.reasons).toContain('impossible-travel');
  });

  it('rejects coordinates outside geographic bounds', () => {
    expect(() =>
      assessLocalityObservation(observation({ lat: 91 }), undefined, NOW)
    ).toThrow('lat');
  });
});

import { LocalityObservationInputDto } from '@optimistic-tanuki/models';
import { LocalityService } from './locality.service';

const NOW = new Date('2026-07-18T15:00:00.000Z');
const input: LocalityObservationInputDto = {
  subjectId: 'opaque-session-hash',
  source: 'live-playback',
  lat: 40.7128,
  lng: -74.006,
  observedAt: NOW.toISOString(),
};

describe('LocalityService', () => {
  it('persists suspicious telemetry instead of dropping it', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest
        .fn()
        .mockImplementation(async (value) => ({ id: '1', ...value })),
    };
    const service = new LocalityService(repository as never, () => NOW);

    const result = await service.recordObservation({
      ...input,
      accuracyMeters: 1001,
    });

    expect(result.status).toBe('suspicious');
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'suspicious', action: 'observe' })
    );
  });

  it('returns unverified when no assessment exists for a subject and source', async () => {
    const repository = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new LocalityService(repository as never, () => NOW);

    await expect(
      service.getAssessment('missing-session', 'live-playback')
    ).resolves.toEqual({
      status: 'unverified',
      confidenceScore: 0,
      reasons: ['no-observation'],
      observedAt: null,
      action: 'observe',
    });
  });

  it('does not persist invalid coordinates', async () => {
    const repository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    const service = new LocalityService(repository as never, () => NOW);

    await expect(
      service.recordObservation({ ...input, lng: 181 })
    ).rejects.toThrow('lng');
    expect(repository.save).not.toHaveBeenCalled();
  });
});

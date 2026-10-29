import { of, throwError } from 'rxjs';
import { ActivityRetentionStatusService } from './activity-retention-status.service';
const sources = {
  profile: ['guardian_profile_activity'],
  assets: ['guardian_asset_activity'],
  social: [
    'activity',
    'profile_view',
    'search_history',
    'community_membership_audit',
    'content_moderation_action',
    'guardian_content_audit',
  ],
  forum: ['forum_moderation_action'],
};
const report = (owner: keyof typeof sources) => ({
  owner,
  cutoff: '2026-01-01T00:00:00Z',
  state: 'verified',
  sources: sources[owner].map((source) => ({
    source,
    deleted: 0,
    remaining: 0,
    state: 'verified',
  })),
});
describe('shared authoritative retention status', () => {
  it('requires all four owners and all nine declared sources', async () => {
    const clients = Object.keys(sources).map((owner) => ({
      send: jest.fn(() => of(report(owner as keyof typeof sources))),
    }));
    const service = new ActivityRetentionStatusService(
      ...(clients as [any, any, any, any]),
      {
        readback: async () => ({
          owner: 'authentication',
          cutoff: '2026-01-01T00:00:00Z',
          state: 'verified',
          sources: [
            {
              source: 'guardian_policy_notice',
              deleted: 0,
              remaining: 0,
              state: 'verified',
            },
          ],
        }),
      } as any,
      { query: async () => [{ remaining: '0' }] } as any
    );
    expect((await service.readback()).state).toBe('verified');
    clients[2].send.mockReturnValue(of({ ...report('social'), sources: [] }));
    expect((await service.readback()).state).toBe('blocked');
  });
  it('does not turn missing, unavailable or nonempty owners into verified status', async () => {
    const clients = Object.keys(sources).map((owner) => ({
      send: jest.fn(() => of(report(owner as keyof typeof sources))),
    }));
    clients[0].send.mockReturnValue(throwError(() => Error('offline')));
    const service = new ActivityRetentionStatusService(
      ...(clients as [any, any, any, any]),
      {
        readback: async () => ({
          owner: 'authentication',
          cutoff: '2026-01-01T00:00:00Z',
          state: 'verified',
          sources: [
            {
              source: 'guardian_policy_notice',
              deleted: 0,
              remaining: 0,
              state: 'verified',
            },
          ],
        }),
      } as any,
      { query: async () => [{ remaining: '0' }] } as any
    );
    expect((await service.readback()).state).toBe('blocked');
  });
});

jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
import { FORUM_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import { ForumAccountExportOwnerService } from './account-export-owner.service';

describe('ForumAccountExportOwnerService', () => {
  it('configures the shared PostgreSQL driver with the exact six-source registry', () => {
    const service = new ForumAccountExportOwnerService(
      {} as any,
      {} as any,
      {} as any
    );
    const options = (service as any).options;
    expect(options.participantId).toBe('forum');
    expect(options.sources).toEqual(FORUM_ACCOUNT_EXPORT_CAPTURE_SOURCES);
    const sources = options.createSources(
      'forum_export_scope_0123456789abcdef'
    );
    expect(sources.map((source: { source: string }) => source.source)).toEqual(
      FORUM_ACCOUNT_EXPORT_CAPTURE_SOURCES
    );
    expect(
      sources.every(
        (source: { sql: string; project: unknown }) =>
          typeof source.sql === 'string' && typeof source.project === 'function'
      )
    ).toBe(true);
  });
});

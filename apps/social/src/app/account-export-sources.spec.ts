import { SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import { createSocialAccountExportSources } from './account-export-sources';

describe('Social account export source registry', () => {
  it('creates all 33 SQL sources in the shared public source order', () => {
    const sources = createSocialAccountExportSources(
      'social_export_scope_test'
    );

    expect(sources.map((source) => source.source)).toEqual(
      SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES
    );
    expect(sources).toHaveLength(33);
    expect(sources[0].sql).toContain('social_export_scope_test');
  });
});

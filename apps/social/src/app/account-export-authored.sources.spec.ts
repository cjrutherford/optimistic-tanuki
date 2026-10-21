import {
  createAuthoredSources,
  SOCIAL_AUTHORED_SOURCES,
  safeUrl,
  boundedString,
} from './account-export-authored.sources';

describe('Social authored account export source projections', () => {
  const sources = createAuthoredSources(
    'social_export_scope_0123456789abcdef0123456789abcdef'
  );

  it('uses a fixed ordered source inventory and bounded positional paging', () => {
    expect(sources.map((source) => source.source)).toEqual(
      SOCIAL_AUTHORED_SOURCES
    );
    for (const source of sources) {
      expect(source.sql).toContain('$1');
      expect(source.sql).toContain('$2');
      expect(source.sql).toContain('$3');
      expect(source.sql).toMatch(/ORDER BY .*COLLATE "C" LIMIT \$3/);
      expect(source.sql).not.toMatch(
        /componentData|\."votes"|attendeeIds|s\."filePath" FROM/
      );
    }
  });

  it('limits child records to a currently selected owned post and never copies the post', () => {
    for (const name of ['Attachment', 'SocialComponent', 'Link']) {
      const source = sources.find((item) => item.source === name)!;
      expect(source.sql).toContain('FROM "post" p');
      expect(source.sql).toContain('p."userId"');
      expect(source.sql).toContain('p."profileId"');
    }
    const link = sources.find((item) => item.source === 'Link')!;
    const postId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const projected = link.project(
      {
        id: `${postId}:9`,
        postId,
        linkId: 9,
        url: 'https://example.test/path',
        appScope: 'social',
        urlLength: 25,
        appScopeLength: 6,
      },
      'a'
    );
    expect(projected).toEqual({
      id: `${postId}:9`,
      postId,
      linkId: '9',
      url: 'https://example.test/path',
      appScope: 'social',
      attribution: 'recorded-unverified',
      consent: 'not-inferred',
    });
  });

  it('labels attachment references as unverified and excludes stored paths', () => {
    const source = sources.find((item) => item.source === 'Attachment')!;
    const row = source.project(
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: 'photo',
        type: 'IMAGE',
        appScope: 'social',
        postId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        nameLength: 5,
        typeLength: 5,
        appScopeLength: 6,
        mediaAssetId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      },
      'a'
    );
    expect(row).not.toHaveProperty('filePath');
    expect(row.mediaReference).toEqual({
      kind: 'asset-reference',
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      binding: 'referenceOnly-unverified',
    });
    const excluded = source.project(
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: 'photo',
        type: 'IMAGE',
        appScope: 'social',
        postId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        nameLength: 5,
        typeLength: 5,
        appScopeLength: 6,
        mediaAssetId: null,
      },
      'a'
    );
    expect(excluded.mediaReference).toBeNull();
    expect(excluded.mediaReferenceDisposition).toBe('excluded-unverified');
  });

  it('rejects URL credentials, oversized values and wrong account attribution', () => {
    expect(() => safeUrl('https://user:secret@example.test')).toThrow();
    const post = sources.find((item) => item.source === 'Post')!;
    expect(() =>
      post.project(
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          title: 'x',
          content: 'x',
          profileId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          appScope: 'social',
          createdAt: '2026-10-20T00:00:00Z',
          updatedAt: '2026-10-20T00:00:00Z',
          visibility: 'public',
          publicAudienceExplicit: false,
          scheduledAt: null,
          isScheduled: false,
        },
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      )
    ).toThrow();
  });

  it('preserves unicode text and normalizes timezone-free timestamps as UTC', () => {
    const post = sources.find((item) => item.source === 'Post')!;
    const projected = post.project(
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: '😀',
        titleLength: 1,
        content: '😀',
        contentLength: 1,
        profileId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        appScope: 'social',
        appScopeLength: 6,
        createdAt: '2026-10-20 12:00:00',
        updatedAt: '2026-10-20 12:00:00',
        visibility: 'public',
        visibilityLength: 6,
        publicAudienceExplicit: false,
        scheduledAt: null,
        isScheduled: false,
        communityId: null,
      },
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    );
    expect(projected.title).toBe('😀');
    expect(boundedString('😀'.repeat(4096), 4096)).toBe('😀'.repeat(4096));
    expect(projected.createdAt).toBe('2026-10-20T12:00:00.000Z');
    expect(projected.userId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });
});

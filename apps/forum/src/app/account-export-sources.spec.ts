import { FORUM_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import { createForumAccountExportSources } from './account-export-sources';

const id = '123e4567-e89b-42d3-a456-426614174000';
const other = '123e4567-e89b-42d3-a456-426614174001';

describe('Forum account export sources', () => {
  it('registers six sources with stable keyset queries and no OFFSET', () => {
    const sources = createForumAccountExportSources('profile');
    expect(sources.map(({ source }) => source)).toEqual(
      FORUM_ACCOUNT_EXPORT_CAPTURE_SOURCES
    );
    for (const source of sources) {
      expect(source.sql).toContain('COLLATE "C"');
      expect(source.sql).toContain('$2::text IS NULL');
      expect(source.sql).toContain('LIMIT $3');
      expect(source.sql).not.toMatch(/\bOFFSET\b/i);
    }
    expect(sources[3].sql).toContain('forum_post_links_forum_link');
    expect(sources[3].sql).toContain("concat(p.id::text, ':', l.id::text)");
  });

  it('projects authored content with both identities, narrow fields, and unverified attribution', () => {
    const source = createForumAccountExportSources('profile')[2];
    const result = source.project(
      {
        id,
        userId: id,
        profileId: other,
        threadId: other,
        appScope: 'forum',
        content: 'Hi 世界',
        createdAt: '2026-10-22 12:00:00',
        updatedAt: '2026-10-22 12:00:00',
        isEdited: true,
        moderatedBy: id,
      },
      id
    );
    expect(result).toMatchObject({
      id,
      userId: id,
      profileId: other,
      threadId: other,
      content: { text: 'Hi 世界' },
      createdAt: '2026-10-22T12:00:00.000Z',
      updatedAt: '2026-10-22T12:00:00.000Z',
      attribution: 'recorded-unverified',
      isEdited: true,
    });
    expect(result).not.toHaveProperty('moderatedBy');
    expect(() =>
      source.project(
        {
          id,
          userId: other,
          profileId: other,
          threadId: other,
          appScope: 'forum',
          content: 'x',
        },
        id
      )
    ).toThrow('FORUM_EXPORT_IDENTITY_MISMATCH');
  });

  it('retains unknown legacy report scope and excludes report descriptions and audit details', () => {
    const sources = createForumAccountExportSources('profile');
    const report = sources[4].project(
      {
        id,
        reporterId: other,
        createdAt: '2026-10-22 12:00:00',
        appScope: null,
        contentType: 'post',
        contentId: id,
        reason: 'spam',
        description: 'private',
        status: 'pending',
        adminNotes: 'secret',
      },
      id
    );
    expect(report).toMatchObject({
      reporterProfileId: other,
      targetId: id,
      appScope: null,
      scopeAttribution: 'unknown',
      attribution: 'recorded-unverified',
    });
    expect(report).not.toHaveProperty('description');
    expect(report).not.toHaveProperty('adminNotes');
    const action = sources[5].project(
      {
        id,
        actorProfileId: other,
        appScope: 'forum',
        createdAt: '2026-10-22 12:00:00',
        action: 'content_moderation',
        subjectType: 'thread',
        subjectId: id,
        details: { private: true },
      },
      id
    );
    expect(action).not.toHaveProperty('details');
    expect(action).toHaveProperty('actorProfileId', other);
  });

  it('uses associated-post identity and scope for links and keeps the composite cursor', () => {
    const link = createForumAccountExportSources('profile')[3];
    const result = link.project(
      {
        id: `${id}:${other}`,
        postId: id,
        linkId: other,
        appScope: 'forum',
        linkScope: 'forum',
        createdAt: '2026-10-22 12:00:00',
        url: 'https://example.test/article',
        title: 'copied',
        description: 'copied',
      },
      id
    );
    expect(result).toMatchObject({
      id: `${id}:${other}`,
      postId: id,
      linkId: other,
      reference: { kind: 'external', status: 'referenceOnly-unverified' },
    });
    expect(result).not.toHaveProperty('title');
    expect(result).not.toHaveProperty('description');
    expect(() => createForumAccountExportSources('bad-name;--')).toThrow(
      'FORUM_EXPORT_INVALID_PROFILE_TABLE'
    );
  });
});

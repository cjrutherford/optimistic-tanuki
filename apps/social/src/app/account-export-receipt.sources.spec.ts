import {
  createPersonalSources,
  PERSONAL_SOURCES,
} from './account-export-personal.sources';
import {
  createCommunitySources,
  COMMUNITY_SOURCES,
} from './account-export-community.sources';
import {
  createSafetySources,
  SAFETY_SOURCES,
} from './account-export-safety.sources';
import {
  receiptSource,
  field,
  profileScope,
} from './account-export-receipt.sources';

const account = '10000000-0000-4000-8000-000000000001';
const profile = '20000000-0000-4000-8000-000000000001';
const id = '30000000-0000-4000-8000-000000000001';
const at = '2026-10-21 15:30:00';
const sources = [
  ...createPersonalSources('scope_fixture'),
  ...createCommunitySources('scope_fixture'),
  ...createSafetySources('scope_fixture'),
];
const source = (name: string) => sources.find((item) => item.source === name)!;

describe('Social personal/community/safety receipt policies', () => {
  it('declares all 23 policy sources once with read-only bounded ordered queries', () => {
    expect(sources.map((item) => item.source)).toEqual([
      ...PERSONAL_SOURCES,
      ...COMMUNITY_SOURCES,
      ...SAFETY_SOURCES,
    ]);
    expect(new Set(sources.map((item) => item.source)).size).toBe(23);
    for (const item of sources) {
      expect(item.sql).toMatch(/^SELECT /);
      expect(item.sql).toContain('COLLATE "C"');
      expect(item.sql).toContain('LIMIT $3');
      expect(item.sql).not.toMatch(/\b(UPDATE|DELETE|INSERT)\b/);
    }
    expect(() => profileScope('scope"; DROP TABLE post;')).toThrow();
  });
  it('retains own state and opaque targets without counterpart-derived content', () => {
    const out = source('UserBlock').project(
      {
        id,
        blockerId: profile,
        blockedId: 'target-profile',
        reason: 'my reason',
        createdAt: at,
        privateCounterpart: 'marker',
      },
      account
    );
    expect(out).toMatchObject({
      blockedId: 'target-profile',
      reason: 'my reason',
      createdAt: '2026-10-21T15:30:00.000Z',
      attribution: 'recorded-unverified',
      consent: 'not-inferred',
    });
    expect(out).not.toHaveProperty('privateCounterpart');
    expect(source('FollowEntity').sql).not.toContain('isMutual');
    expect(source('SavedItem').sql).not.toContain('itemTitle');
    expect(source('Activity').sql).not.toContain('description');
  });
  it('uses account-domain viewing and presence, rejecting ambiguous presence bindings', () => {
    expect(source('ProfileView').sql).toContain('r."viewerId"');
    expect(
      source('ProfileView').project(
        {
          id,
          viewerId: account,
          profileId: profile,
          source: 'https://private.example/referrer',
          viewedAt: at,
        },
        account
      )['source']
    ).toBe('other');
    const row = {
      id,
      userId: account,
      status: 'online',
      lastSeen: null,
      createdAt: at,
      isExplicit: true,
      bindingCount: 2,
    };
    expect(() => source('UserPresence').project(row, account)).toThrow();
    expect(
      source('UserPresence').project({ ...row, bindingCount: 1 }, account)
    ).toMatchObject({ userId: account, status: 'online' });
  });
  it('reuses notification templates and does not select historical free text or URLs', () => {
    const out = source('Notification').project(
      {
        id,
        recipientId: profile,
        type: 'like',
        isRead: false,
        createdAt: at,
        title: 'marker',
        body: 'marker',
        actionUrl: 'https://secret.example',
      },
      account
    );
    expect(JSON.stringify(out)).not.toContain('marker');
    expect(JSON.stringify(out)).not.toContain('secret.example');
    expect(source('Notification').sql).not.toMatch(
      /"(title|body|senderId|actionUrl|resourceId)"/
    );
    expect(out).toHaveProperty('title');
  });
  it('separates invitation and audit branches without the unmatched participant identity', () => {
    const invite = source('CommunityInvite').project(
      {
        id,
        status: 'pending',
        expiresAt: null,
        createdAt: at,
        communityId: 'context',
        actorMatches: true,
        subjectMatches: false,
        inviteeId: 'foreign',
        inviteeEmail: 'secret',
        token: 'secret',
      },
      account
    );
    expect(invite['participation']).toEqual([
      { role: 'inviter', accountId: account },
    ]);
    expect(JSON.stringify(invite)).not.toMatch(/foreign|secret/);
    const audit = source('CommunityMembershipAudit').project(
      {
        id,
        actor: 'member',
        action: 'join',
        from: 'none',
        to: 'active',
        createdAt: at,
        workspaceId: 'workspace',
        actorMatches: false,
        matchedSubjectId: profile,
        actorId: 'foreign',
      },
      account
    );
    expect(audit['participation']).toEqual([
      { role: 'subject', profileId: profile },
    ]);
    expect(audit).not.toHaveProperty('actorId');
  });
  it('fails paired community identities and excludes shared governance fields', () => {
    expect(() =>
      source('CommunityMember').project(
        { id, accountBinding: true, profileBinding: false },
        account
      )
    ).toThrow();
    expect(source('Community').sql).toContain('"isSystemCommunity" = false');
    expect(source('ElectionVote').sql).not.toContain('candidateUserId');
    expect(source('ElectionCandidate').sql).not.toContain('voteCount');
    expect(source('CommunityElection').sql).not.toContain('winnerId');
  });
  it('keeps guardian history branch-safe without implying current access', () => {
    const out = source('GuardianPublishedAssetGrant').project(
      {
        id,
        appId: 'social',
        resourceType: 'post',
        createdAt: at,
        assetId: 'asset-id',
        resourceId: 'post-id',
        actorMatches: false,
        matchedDependentId: profile,
        actorUserId: 'foreign',
      },
      account
    );
    expect(out).toMatchObject({
      participation: [{ role: 'dependent', profileId: profile }],
      referenceOnly: true,
      currentAccess: 'not-established',
    });
    expect(out).not.toHaveProperty('actorUserId');
    expect(source('GuardianContentAudit').sql).not.toContain('changedFields');
    expect(source('BusinessThemeContent').sql).not.toMatch(
      /customCss|customFontFamily/
    );
    expect(source('ContentReport').sql).not.toMatch(/description|adminNotes/);
    expect(source('ContentModerationAction').sql).not.toMatch(
      /details|reportId/
    );
  });
  it('fails malformed, oversized or object values rather than silently completing', () => {
    const s = receiptSource({
      source: 'test',
      table: 'test',
      selector: 'TRUE',
      fields: { value: field.text(false, 4) },
    });
    expect(() => s.project({ id, value: '12345' }, account)).toThrow();
    expect(s.project({ id, value: '😀😀😀😀' }, account)['value']).toBe(
      '😀😀😀😀'
    );
    expect(() => s.project({ id, value: '😀😀😀😀😀' }, account)).toThrow();
    expect(() => s.project({ id, value: { secret: true } }, account)).toThrow();
    expect(() => s.project({ id: 'bad', value: 'safe' }, account)).toThrow();
    expect(() =>
      source('UserBlock').project(
        {
          id,
          blockerId: profile,
          blockedId: 'https://private.example',
          reason: null,
          createdAt: at,
        },
        account
      )
    ).toThrow();
  });
});

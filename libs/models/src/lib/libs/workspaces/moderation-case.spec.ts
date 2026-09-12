import {
  createModerationCase,
  decideModerationCase,
  fileModerationAppeal,
} from './moderation-case';

describe('moderation case contract', () => {
  const input = {
    id: 'case-1',
    workspaceId: 'workspace-1',
    appScope: 'social',
    subject: {
      domain: 'social',
      resourceType: 'post',
      resourceId: 'post-1',
      workspaceId: 'workspace-1',
    },
    reporterId: 'profile-reporter',
    reason: 'harassment' as const,
    evidence: [
      { kind: 'url' as const, value: 'https://evidence.test/report-1' },
    ],
    retention: { deleteAfter: '2027-08-23T00:00:00.000Z' },
    occurredAt: '2026-08-23T00:00:00.000Z',
  };

  it('creates an open case only for a subject in the same workspace', () => {
    expect(createModerationCase(input)).toMatchObject({
      status: 'open',
      workspaceId: 'workspace-1',
      decision: null,
    });
    expect(() =>
      createModerationCase({
        ...input,
        subject: { ...input.subject, workspaceId: 'workspace-2' },
      })
    ).toThrow('same workspace');
  });

  it('allows an app-scoped case when the Social feature has no workspace', () => {
    expect(
      createModerationCase({
        ...input,
        id: 'case-app-scope',
        workspaceId: null,
        subject: { ...input.subject, workspaceId: null },
      })
    ).toMatchObject({ workspaceId: null, appScope: 'social', status: 'open' });
  });

  it('records a reviewer decision and forbids a second decision', () => {
    const decided = decideModerationCase(createModerationCase(input), {
      outcome: 'restrict',
      actorId: 'profile-moderator',
      rationale: 'Repeated targeted harassment.',
      occurredAt: '2026-08-23T00:05:00.000Z',
    });

    expect(decided).toMatchObject({
      status: 'resolved',
      decision: { outcome: 'restrict', actorId: 'profile-moderator' },
    });
    expect(() =>
      decideModerationCase(decided, {
        outcome: 'dismiss',
        actorId: 'profile-other',
        occurredAt: '2026-08-23T00:06:00.000Z',
      })
    ).toThrow('already resolved');
  });

  it('supports approval and rejection outcomes for owner-client relationships', () => {
    const approved = decideModerationCase(createModerationCase(input), {
      outcome: 'approve',
      actorId: 'profile-owner',
      occurredAt: '2026-08-23T00:05:00.000Z',
    });

    expect(approved.decision?.outcome).toBe('approve');
  });

  it('allows one appeal only after a decision', () => {
    const resolved = decideModerationCase(createModerationCase(input), {
      outcome: 'remove',
      actorId: 'profile-moderator',
      occurredAt: '2026-08-23T00:05:00.000Z',
    });
    const appealed = fileModerationAppeal(resolved, {
      appellantId: 'profile-subject',
      reason: 'The report was inaccurate.',
      occurredAt: '2026-08-23T01:00:00.000Z',
    });

    expect(appealed.status).toBe('appealed');
    expect(appealed.appeal?.appellantId).toBe('profile-subject');
    expect(() =>
      fileModerationAppeal(appealed, {
        appellantId: 'profile-subject',
        reason: 'A duplicate appeal.',
        occurredAt: '2026-08-23T01:01:00.000Z',
      })
    ).toThrow('already appealed');
  });
});

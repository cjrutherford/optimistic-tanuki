import {
  isResolvedWorkspace,
  isWorkspaceKind,
  isWorkspaceStatus,
  workspaceScopeName,
  type ResolvedWorkspace,
} from './workspace.dto';

describe('workspace contracts', () => {
  const workspace: ResolvedWorkspace = {
    workspaceId: 'workspace-1',
    kind: 'business-site',
    slug: 'north-star-coaching',
    displayName: 'North Star Coaching',
    appScope: 'business-site',
    ownerUserId: 'user-1',
    ownerProfileId: 'profile-1',
    status: 'active',
    source: { service: 'store', sourceId: 'site-config-1' },
  };

  it('recognizes the supported workspace kinds and lifecycle states', () => {
    expect(isWorkspaceKind('business-site')).toBe(true);
    expect(isWorkspaceKind('community')).toBe(true);
    expect(isWorkspaceKind('finance-tenant')).toBe(false);

    expect(isWorkspaceStatus('draft')).toBe(true);
    expect(isWorkspaceStatus('active')).toBe(true);
    expect(isWorkspaceStatus('published')).toBe(false);
  });

  it('requires every identity field in a resolved workspace', () => {
    expect(isResolvedWorkspace(workspace)).toBe(true);
    expect(
      isResolvedWorkspace({ ...workspace, ownerProfileId: undefined })
    ).toBe(false);
    expect(
      isResolvedWorkspace({ ...workspace, source: { service: 'store' } })
    ).toBe(false);
  });

  it('derives tenant permission scope names from canonical UUIDs, never slugs', () => {
    expect(workspaceScopeName('123e4567-e89b-12d3-a456-426614174000')).toBe(
      'workspace:123e4567-e89b-12d3-a456-426614174000'
    );
    expect(() => workspaceScopeName('north-star-coaching')).toThrow(
      'canonical UUID'
    );
  });
});

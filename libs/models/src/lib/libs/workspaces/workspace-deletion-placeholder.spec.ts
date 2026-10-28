import { randomUUID } from 'node:crypto';
import { isResolvedWorkspace, isWorkspaceSource } from './workspace.dto';
import { DELETED_ACCOUNT_ID as nil } from '../account-deletion/account-deletion.contract';
describe('resolved deleted stewardship', () => {
  const base = {
    workspaceId: randomUUID(),
    kind: 'community',
    slug: 'shared',
    displayName: 'Shared',
    appScope: 'local-hub',
    ownerUserId: nil,
    ownerProfileId: nil,
    status: 'active',
    source: { service: 'app-configurator', sourceId: nil },
  };
  it('retains a resolved shared container with the explicit erased source placeholder', () =>
    expect(isResolvedWorkspace(base)).toBe(true));
  it('does not treat a deleted source as an ordinary registration source', () =>
    expect(isWorkspaceSource(base.source)).toBe(false));
  it('rejects a deleted source paired with a live account or an unknown service', () => {
    expect(isResolvedWorkspace({ ...base, ownerUserId: randomUUID() })).toBe(
      false
    );
    expect(
      isResolvedWorkspace({
        ...base,
        source: { service: 'unknown', sourceId: nil },
      })
    ).toBe(false);
  });
});

import { ACCOUNT_DELETION_OWNERS } from '@optimistic-tanuki/models';
import { randomUUID } from 'node:crypto';
import { AccountDeletionOwnerReadbacksAdapter } from './account-deletion-owner-readbacks.adapter';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
const profile = randomUUID();
const grant = {
  contractVersion: 1,
  accountId: randomUUID(),
  operationId: randomUUID(),
  appId: 'local-hub',
  owner: 'authentication',
  action: 'readback',
  attempt: 1,
  leaseOwner: randomUUID(),
  expiresAt: new Date(Date.now() + 30000).toISOString(),
  signature: 'a'.repeat(64),
} as const;
const subject = {
  accountId: grant.accountId,
  operationId: grant.operationId,
  profileIds: [profile],
  grant,
};
function fixture() {
  const scope = { currentProfileIds: [profile], legacyProfileIds: [] };
  const authority = {
    validateGrant: jest.fn(async () => ({ scope })),
    issueGrant: jest.fn(async (_id, owner, action) => ({
      ...grant,
      owner,
      action,
    })),
  };
  const social = jest.fn(async () => ({ verified: true, remaining: 0 }));
  const assets = jest.fn(async () => ({ fenced: true, profileCount: 1 }));
  const videos = jest.fn(async () => ({ verified: true }));
  const ports = new Map<string, jest.Mock>([
    ['social', social],
    ['assets', assets],
    ['videos', videos],
  ]);
  return {
    authority,
    social,
    assets,
    videos,
    ports,
    service: new AccountDeletionOwnerReadbacksAdapter(
      authority as never,
      { ports } as never
    ),
  };
}
it('calls the current Social source readback for search instead of trusting a saved receipt', async () => {
  const f = fixture();
  const adapter = f.service.forFamily('search-copies');
  await adapter.purge(subject);
  expect(await adapter.readback(subject)).toBe(0);
  expect(f.social).toHaveBeenCalledTimes(2);
  expect(f.authority.issueGrant).toHaveBeenCalledWith(
    grant.operationId,
    'social',
    'readback'
  );
});
it('requires fresh Assets and Videos custody readbacks for the media family', async () => {
  const f = fixture();
  const adapter = f.service.forFamily('media-versions-and-keys');
  await adapter.purge(subject);
  expect(await adapter.readback(subject)).toBe(0);
  expect(f.assets).toHaveBeenCalledTimes(2);
  expect(f.videos).toHaveBeenCalledTimes(2);
  f.videos.mockResolvedValueOnce({ verified: false } as never);
  await expect(adapter.readback(subject)).rejects.toThrow(
    'DELETION_OWNER_CUSTODY_UNVERIFIED'
  );
});
it('rejects missing participants, surviving records, bad subject binding and scope drift', async () => {
  const f = fixture();
  const search = f.service.forFamily('search-copies');
  f.social.mockResolvedValueOnce({ verified: true, remaining: 1 });
  await expect(search.readback(subject)).rejects.toThrow(
    'DELETION_OWNER_CUSTODY_UNVERIFIED'
  );
  f.ports.delete('social');
  await expect(search.readback(subject)).rejects.toThrow(
    'DELETION_OWNER_UNAVAILABLE'
  );
  await expect(
    search.readback({ ...subject, accountId: randomUUID() })
  ).rejects.toThrow('DELETION_OWNER_SUBJECT_INVALID');
  f.authority.validateGrant.mockResolvedValueOnce({
    scope: { currentProfileIds: [], legacyProfileIds: [] },
  });
  await expect(search.readback(subject)).rejects.toThrow(
    'DELETION_OWNER_SCOPE_CHANGED'
  );
});

function fullFixture() {
  const f = fixture();
  for (const owner of ACCOUNT_DELETION_OWNERS)
    if (!f.ports.has(owner))
      f.ports.set(
        owner,
        jest.fn(async () =>
          owner === 'authentication'
            ? { complete: true, unresolvedAttribution: [] }
            : owner === 'profile'
            ? { fenced: true, profileCount: 1, legacyCount: 0 }
            : { verified: true, remaining: 0 }
        )
      );
  const runtimeReadbacks = jest.fn(async (capability) => [
    {
      owner: capability.owner,
      instanceId: randomUUID(),
      remaining: 0,
      logging: { policyVersion: 1, active: true },
      databaseLogging: { policyVersion: 1, active: true },
      ...(['profile', 'assets', 'social', 'forum'].includes(capability.owner)
        ? { audit: { remaining: 0 } }
        : {}),
    },
  ]);
  return {
    ...f,
    runtimeReadbacks,
    service: new AccountDeletionOwnerReadbacksAdapter(
      f.authority as never,
      { ports: f.ports, runtimeReadbacks } as never
    ),
  };
}
it('checks transient custody across every owner rather than substituting stored acknowledgements', async () => {
  const f = fullFixture();
  const adapter = f.service.forFamily('jobs-and-spools');
  await adapter.purge(subject);
  expect(f.runtimeReadbacks).toHaveBeenCalledTimes(12);
  expect(
    new Set(
      f.runtimeReadbacks.mock.calls.map(([capability]) => capability.owner)
    )
  ).toEqual(new Set(ACCOUNT_DELETION_OWNERS));
  f.runtimeReadbacks.mockResolvedValueOnce([
    {
      owner: 'authentication',
      instanceId: randomUUID(),
      remaining: 1,
      logging: { policyVersion: 1, active: true },
      databaseLogging: { policyVersion: 1, active: true },
    },
  ]);
  await expect(adapter.readback(subject)).rejects.toThrow(
    'DELETION_OWNER_RUNTIME_UNVERIFIED'
  );
});
it('requires explicit local log inventory and a live payload-free boundary on every replica', async () => {
  const previous = process.env['ACCOUNT_DELETION_LOG_INVENTORY'];
  try {
    const f = fullFixture();
    const adapter = f.service.forFamily('diagnostics-and-audits');
    delete process.env['ACCOUNT_DELETION_LOG_INVENTORY'];
    await expect(adapter.readback(subject)).rejects.toThrow(
      'DELETION_LOG_INVENTORY_REQUIRED'
    );
    process.env['ACCOUNT_DELETION_LOG_INVENTORY'] = JSON.stringify({
      scope: 'local-ot-ts',
      confirmedAt: '2026-10-26',
      noForwardedCollectors: true,
      noRetainedLegacyLogs: true,
    });
    expect(await adapter.readback(subject)).toBe(0);
    f.runtimeReadbacks.mockResolvedValueOnce([
      {
        owner: 'authentication',
        instanceId: randomUUID(),
        remaining: 0,
        logging: { policyVersion: 1, active: false },
        databaseLogging: { policyVersion: 1, active: true },
      },
    ]);
    await expect(adapter.readback(subject)).rejects.toThrow(
      'DELETION_OWNER_RUNTIME_UNVERIFIED'
    );
    f.ports
      .get('forum')!
      .mockResolvedValueOnce({ verified: true, remaining: 1 });
    await expect(adapter.readback(subject)).rejects.toThrow(
      'DELETION_OWNER_CUSTODY_UNVERIFIED'
    );
  } finally {
    if (previous === undefined)
      delete process.env['ACCOUNT_DELETION_LOG_INVENTORY'];
    else process.env['ACCOUNT_DELETION_LOG_INVENTORY'] = previous;
  }
});

it('can verify frozen-scope runtime custody after Profile root disposal, without pretending root rows survive', async () => {
  const f = fullFixture();
  f.ports
    .get('profile')!
    .mockRejectedValue(Error('PROFILE_ROOT_ALREADY_FINALIZED'));
  expect(await f.service.forFamily('jobs-and-spools').readback(subject)).toBe(
    0
  );
  expect(f.ports.get('profile')).not.toHaveBeenCalled();
  expect(
    f.runtimeReadbacks.mock.calls.some(
      ([capability]) => capability.owner === 'profile'
    )
  ).toBe(true);
});

import { randomUUID } from 'node:crypto';
import { AccountDeletionSnapshotController } from './account-deletion-snapshot.controller';
const grant = {
  contractVersion: 1,
  operationId: randomUUID(),
  accountId: randomUUID(),
  appId: 'local-hub',
  owner: 'social',
  action: 'fence',
  attempt: 1,
  leaseOwner: randomUUID(),
  expiresAt: new Date(Date.now() + 30000).toISOString(),
  signature: 'a'.repeat(64),
};
const setup = () => {
  const authority = {
    validate: jest.fn(async () => ({
      scope: { currentProfileIds: [], legacyProfileIds: [] },
    })),
  };
  const snapshot = {
    purgeAccount: jest.fn(async () => ({ remaining: 0 as const })),
  };
  const spool = {
    purgeAccount: jest.fn(async () => ({ remaining: 0 as const })),
    readbackAccount: jest.fn(async () => 0),
  };
  return {
    authority,
    snapshot,
    spool,
    controller: new AccountDeletionSnapshotController({
      owner: 'social',
      authority: authority as never,
      snapshot,
      spool,
    }),
  };
};
it('requires literal owner and a fence/readback capability before calling purge', async () => {
  const { controller, snapshot } = setup();
  for (const bad of [
    { ...grant, owner: 'assets' },
    { ...grant, action: 'finalize' },
    { ...grant, signature: 'bad' },
  ])
    await expect(controller.purge(bad)).rejects.toThrow(
      'DELETION_SNAPSHOT_GRANT_INVALID'
    );
  expect(snapshot.purgeAccount).not.toHaveBeenCalled();
});
it('purges only the granted account and revalidates before acknowledgement', async () => {
  const { controller, snapshot, authority } = setup();
  expect(await controller.purge(grant)).toEqual({ purged: true, remaining: 0 });
  expect(snapshot.purgeAccount).toHaveBeenCalledWith(grant.accountId);
  expect(authority.validate).toHaveBeenCalledTimes(2);
});
it('does not report success if cleanup or post-cleanup authorization fails', async () => {
  const { controller, snapshot, authority } = setup();
  snapshot.purgeAccount.mockRejectedValueOnce(Error('cleanup'));
  await expect(controller.purge(grant)).rejects.toThrow('cleanup');
  authority.validate.mockRejectedValueOnce(Error('stale'));
  await expect(controller.purge(grant)).rejects.toThrow('stale');
});

it('reports current instance custody only for a fresh readback capability', async () => {
  const f = setup();
  await expect(f.controller.runtime(grant)).rejects.toThrow(
    'DELETION_RUNTIME_GRANT_INVALID'
  );
  const capability = { ...grant, action: 'readback' };
  const reply = await f.controller.runtime(capability);
  expect(reply).toMatchObject({
    owner: 'social',
    remaining: 0,
    logging: { policyVersion: 1 },
  });
  expect(reply.instanceId).toMatch(/^[0-9a-f-]{36}$/);
  expect(f.authority.validate).toHaveBeenCalledTimes(2);
  f.spool.readbackAccount.mockResolvedValueOnce(1);
  await expect(f.controller.runtime(capability)).rejects.toThrow(
    'DELETION_RUNTIME_UNVERIFIED'
  );
  f.authority.validate.mockRejectedValueOnce(Error('STALE_LEASE'));
  await expect(f.controller.runtime(capability)).rejects.toThrow('STALE_LEASE');
});

it('independently verifies audit identities with frozen scope even after root identity disposal', async () => {
  const f = setup();
  const audit = { readbackParticipation: jest.fn(async () => 0) };
  const controller = new AccountDeletionSnapshotController({
    owner: 'social',
    authority: f.authority as never,
    snapshot: f.snapshot,
    spool: f.spool,
    audit,
  });
  const capability = { ...grant, action: 'readback' };
  expect(await controller.runtime(capability)).toMatchObject({
    audit: { remaining: 0 },
  });
  expect(audit.readbackParticipation).toHaveBeenCalledWith({
    accountId: grant.accountId,
    profileIds: [],
  });
  audit.readbackParticipation.mockResolvedValueOnce(1);
  await expect(controller.runtime(capability)).rejects.toThrow(
    'DELETION_AUDIT_READBACK_UNVERIFIED'
  );
});

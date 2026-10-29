import { randomUUID } from 'node:crypto';
import {
  ACCOUNT_DELETION_OWNERS,
  AccountDeletionGrant,
} from '@optimistic-tanuki/models';
import {
  AccountDeletionRunnerService,
  DeletionOwnerPorts,
} from './account-deletion-runner.service';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
function harness() {
  const id = randomUUID();
  let attempt = 0;
  let state = 'fencing';
  const progress: Record<string, Record<string, boolean>> = {};
  const db = {
    query: jest.fn(async () => [
      {
        ownerProgress: progress,
        privateScope: { currentProfileIds: [], legacyProfileIds: [] },
      },
    ]),
  };
  const authority = {
    claim: jest.fn(async () => ({
      operationId: id,
      attempt: ++attempt,
      leaseOwner: randomUUID(),
    })),
    issueGrant: jest.fn(async (_id, owner, action) => ({
      operationId: id,
      owner,
      action,
      attempt,
    })),
    acknowledge: jest.fn(async (g: AccountDeletionGrant) => {
      progress[g.owner] ??= {};
      progress[g.owner][g.action] = true;
    }),
    renew: jest.fn(async () => {}),
    releaseBlocked: jest.fn(async () => {
      state = 'blocked';
    }),
    status: jest.fn(async () => ({ state, attempt })),
  };
  const ports = new Map(
    ACCOUNT_DELETION_OWNERS.map((owner) => [
      owner,
      jest.fn(async (g: AccountDeletionGrant) => {
        if (g.action === 'finalize') return { finalized: true, remaining: 0 };
        if (owner === 'authentication')
          return g.action === 'fence'
            ? { fenced: true }
            : g.action === 'erase'
            ? { erased: true }
            : {
                complete: true,
                counts: Object.fromEntries(
                  [
                    'token_account',
                    'token_profile',
                    'oauth_provider',
                    'auth_action_token',
                    'guardian_permission',
                    'guardian_policy_notice',
                    'account_export_jobs',
                  ].map((name) => [name, 0])
                ),
                unresolvedAttribution: [],
              };
        if (owner === 'profile' || owner === 'assets')
          return { fenced: true, profileCount: 0, legacyCount: 0 };
        return { verified: true, remaining: 0 };
      }),
    ])
  );
  const nonOrm = { execute: jest.fn(async () => ({ verified: false })) };
  const finalizer = {
    finalize: jest.fn(async () => {
      state = 'complete';
    }),
  };
  const make = () =>
    new AccountDeletionRunnerService(
      authority as never,
      nonOrm as never,
      finalizer as never,
      db as never,
      ports as unknown as DeletionOwnerPorts
    );
  return { id, authority, ports, nonOrm, finalizer, make, progress };
}
it('does not erase any owner or finalize roots when a required fence owner is unavailable', async () => {
  const h = harness();
  h.ports.delete('videos');
  expect((await h.make().run(h.id))?.state).toBe('blocked');
  for (const fn of h.ports.values())
    expect(fn.mock.calls.every(([grant]) => grant.action === 'fence')).toBe(
      true
    );
  expect(h.finalizer.finalize).not.toHaveBeenCalled();
});
it('persists completed owner stages but blocks roots until non-ORM verification, then resumes through a reconstructed runner', async () => {
  const h = harness();
  expect((await h.make().run(h.id))?.state).toBe('blocked');
  expect(ACCOUNT_DELETION_OWNERS.every((o) => h.progress[o]?.readback)).toBe(
    true
  );
  expect(h.finalizer.finalize).not.toHaveBeenCalled();
  const before = [...h.ports.values()].reduce(
    (n, fn) => n + fn.mock.calls.length,
    0
  );
  h.nonOrm.execute.mockResolvedValue({ verified: true });
  expect((await h.make().run(h.id))?.state).toBe('complete');
  expect(
    [...h.ports.values()].reduce((n, fn) => n + fn.mock.calls.length, 0)
  ).toBe(before + 1);
  expect(h.finalizer.finalize).toHaveBeenCalledTimes(1);
  expect(h.authority.claim).toHaveBeenCalledTimes(2);
});
it('refuses malformed owner acknowledgement instead of recording it', async () => {
  const h = harness();
  h.ports
    .get('social')!
    .mockResolvedValue({ verified: true, remaining: undefined } as never);
  expect((await h.make().run(h.id))?.state).toBe('blocked');
  expect(h.progress['social']).toBeUndefined();
  expect(h.finalizer.finalize).not.toHaveBeenCalled();
});

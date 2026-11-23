import type {
  LocalityConfig,
  SourcingDecision,
} from '@optimistic-tanuki/civic-core';
import { createTestSchema } from '@optimistic-tanuki/civic-core/testing';
import { DataSource } from 'typeorm';
import { Foundation1790940573082 } from '../../../migrations/1790940573082-foundation';
import { AddDaylightAlerts1791165718816 } from '../../../migrations/1791165718816-AddDaylightAlerts';
import { DaylightDbLocalities1793805980810 } from '../../../migrations/1793805980810-DaylightDbLocalities';
import { DaylightLocalityDisambiguation1793808213553 } from '../../../migrations/1793808213553-DaylightLocalityDisambiguation';
import { SourceRequests1793837771735 } from '../../../migrations/1793837771735-SourceRequests';
import { OfficialCandidates1793843620449 } from '../../../migrations/1793843620449-OfficialCandidates';
import { SourcesAdmin1795421681325 } from '../../../migrations/1795421681325-SourcesAdmin';
import { SourceRequestsService } from '../registry/source-requests.service';
import { SourcingStore } from '../schedule/sourcing-store';
import { BRIEFING_SCHEMAS } from '../schemas';
import {
  InvalidSourceOpError,
  SourceOpsService,
  SourceRequestDecidedError,
} from './source-ops.service';

const town = {
  slug: 'groton-ny',
  name: 'Groton',
  kind: 'town',
  sources: [],
} as unknown as LocalityConfig;
const registry = {
  all: () => [town],
  ancestors: () => [],
  descendants: () => [],
};

function adoption(key: string, adopted = true): SourcingDecision {
  return {
    source: {
      sourceKey: key,
      adapter: 'civic-core',
      url: `civic-core:${key}`,
      kind: 'meeting',
      desk: 'government',
      coverage: 'all',
      name: key,
      ownerSlug: 'groton-ny',
    },
    official: true,
    ownerSlug: 'groton-ny',
    via: 'civic-core tenant match',
    adopted,
    reasons: ['matched'],
    evidence: ['name'],
  } as unknown as SourcingDecision;
}

describe('SourceOpsService', () => {
  let ds: DataSource;
  let ops: SourceOpsService;
  let store: SourcingStore;

  beforeAll(async () => {
    ds = new DataSource({
      type: 'postgres',
      url: (await createTestSchema()).url,
      entities: BRIEFING_SCHEMAS,
      migrations: [
        Foundation1790940573082,
        AddDaylightAlerts1791165718816,
        DaylightDbLocalities1793805980810,
        DaylightLocalityDisambiguation1793808213553,
        SourceRequests1793837771735,
        OfficialCandidates1793843620449,
        SourcesAdmin1795421681325,
      ],
    });
    await ds.initialize();
    await ds.runMigrations();
    ops = new SourceOpsService(ds, { current: () => registry as never });
    store = new SourcingStore(ds);
  });

  afterAll(async () => {
    await ds?.destroy();
  });

  it('lists decisions newest first, paged, without search records', async () => {
    await store.recordSearch('groton-ny', '2026-11-01', {
      pagesRead: 0,
      searched: null,
      adopted: 0,
      refused: 0,
      officialSites: [],
    });
    for (let i = 0; i < 3; i++)
      await store.recordDecision(
        'groton-ny',
        adoption(`log-${i}`),
        new Date(2026, 10, 1 + i)
      );
    const first = await ops.decisionLog('groton-ny', { limit: 2 });
    expect(first.total).toBe(3);
    expect(first.items.map((item) => item.sourceKey)).toEqual([
      'log-2',
      'log-1',
    ]);
    const next = await ops.decisionLog('groton-ny', { limit: 2, offset: 2 });
    expect(next.items.map((item) => item.sourceKey)).toEqual(['log-0']);
    expect(next.items[0].evidence).toEqual(['name']);
  });

  it('a blocked source is never adopted, and the block is logged and clearable', async () => {
    const override = await ops.setOverride({
      slug: 'groton-ny',
      sourceKey: 'civic-core-blocked',
      kind: 'block',
      reason: 'wrong tenant',
      actor: 'op-1',
    });
    expect(override).toMatchObject({ kind: 'block', actor: 'op-1' });
    expect(await store.adopt(adoption('civic-core-blocked'))).toBe(false);
    expect(await ops.overrides('groton-ny')).toHaveLength(1);
    const log = await ops.decisionLog('groton-ny', { limit: 1 });
    expect(log.items[0]).toMatchObject({
      decision: 'blocked',
      reason: 'wrong tenant',
      via: 'operator op-1',
    });
    await ops.clearOverride({
      sourceKey: 'civic-core-blocked',
      reason: 'it was right after all',
      actor: 'op-2',
    });
    expect(await ops.overrides('groton-ny')).toHaveLength(0);
    expect(await store.adopt(adoption('civic-core-blocked'))).toBe(true);
  });

  it('blocking switches off a discovered source already held', async () => {
    await store.adopt(adoption('civic-core-held'));
    await ops.setOverride({
      slug: 'groton-ny',
      sourceKey: 'civic-core-held',
      kind: 'block',
      reason: 'remove it',
      actor: 'op-1',
    });
    expect(await store.setDiscoveredEnabled('civic-core-held', false)).toBe(
      false
    );
    await ops.setOverride({
      slug: 'groton-ny',
      sourceKey: 'civic-core-held',
      kind: 'pin',
      reason: 'changed my mind',
      actor: 'op-1',
    });
    expect(await store.overrides()).toEqual(
      new Map([['civic-core-held', 'pin']])
    );
    await ops.clearOverride({
      sourceKey: 'civic-core-held',
      reason: 'done',
      actor: 'op-1',
    });
  });

  it('refuses an override without a reason or a known kind', async () => {
    await expect(
      ops.setOverride({
        slug: 'groton-ny',
        sourceKey: 'x',
        kind: 'block',
        reason: '  ',
        actor: 'op-1',
      })
    ).rejects.toBeInstanceOf(InvalidSourceOpError);
    await expect(
      ops.setOverride({
        slug: 'groton-ny',
        sourceKey: 'x',
        kind: 'mute',
        reason: 'because',
        actor: 'op-1',
      })
    ).rejects.toBeInstanceOf(InvalidSourceOpError);
    expect(
      await ops.setOverride({
        slug: 'nowhere',
        sourceKey: 'x',
        kind: 'block',
        reason: 'because',
        actor: 'op-1',
      })
    ).toBeNull();
    expect(
      await ops.clearOverride({ sourceKey: 'x', reason: 'r', actor: 'a' })
    ).toBeNull();
  });

  it('reports health for a town, and null for an unknown one', async () => {
    expect(await ops.health('nowhere')).toBeNull();
    expect(await ops.health('groton-ny')).toEqual({
      slug: 'groton-ny',
      name: 'Groton',
      sources: [],
    });
  });

  it('queues readers requests and decides each once, with a reason', async () => {
    const requests = new SourceRequestsService(ds, {
      current: () => registry as never,
    });
    await requests.request('groton-ny', 'reader-1', 'please');
    await requests.request('groton-ny', 'reader-2');
    const pending = await ops.listRequests({ slug: 'groton-ny' });
    expect(pending.total).toBe(2);
    expect(pending.items[0]).toMatchObject({
      status: 'pending',
      townName: 'Groton',
    });
    const id = pending.items[0].id;
    await expect(
      ops.decideRequest({ id, decision: 'approved', reason: '', actor: 'op' })
    ).rejects.toBeInstanceOf(InvalidSourceOpError);
    const decided = await ops.decideRequest({
      id,
      decision: 'rejected',
      reason: 'no public source exists',
      actor: 'op-1',
    });
    expect(decided).toMatchObject({
      status: 'rejected',
      decidedBy: 'op-1',
      decisionReason: 'no public source exists',
    });
    await expect(
      ops.decideRequest({ id, decision: 'approved', reason: 'r', actor: 'op' })
    ).rejects.toBeInstanceOf(SourceRequestDecidedError);
    expect((await ops.listRequests({ slug: 'groton-ny' })).total).toBe(1);
    expect((await ops.listRequests({ status: 'rejected' })).items[0].id).toBe(
      id
    );
    expect(
      await ops.decideRequest({
        id: '00000000-0000-4000-8000-000000000000',
        decision: 'approved',
        reason: 'r',
        actor: 'op',
      })
    ).toBeNull();
  });
});

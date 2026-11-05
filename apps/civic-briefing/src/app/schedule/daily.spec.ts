import { Logger } from '@nestjs/common';
import type {
  Cadence,
  LocalityConfig,
  LocalityRegistry,
  PipelineStages,
} from '@optimistic-tanuki/civic-core';
import type { DataSource } from 'typeorm';
import { LocalityRegistrySource } from '../registry/locality-registry.source';
import { DailySchedule } from './daily';
import { loadScheduleConfig, type ScheduleConfig } from './schedule.config';

const NOW = new Date('2026-11-05T12:00:00Z');
const TODAY = '2026-11-05';

interface FakeRegistry {
  editions(): LocalityConfig[];
  ancestors(): LocalityConfig[];
  descendants(): LocalityConfig[];
}

function town(slug: string, sources = true): LocalityConfig {
  return {
    slug,
    timezone: 'UTC',
    sources: sources ? [{ sourceKey: `${slug}-feed` }] : [],
  } as unknown as LocalityConfig;
}

/** A registry whose towns have a source each, except the named `sourceless` ones. */
function registryWith(
  sourceless: string[],
  ...slugs: string[]
): LocalityRegistry {
  const fake: FakeRegistry = {
    editions: () => slugs.map((slug) => town(slug, !sourceless.includes(slug))),
    ancestors: () => [],
    descendants: () => [],
  };
  return fake as unknown as LocalityRegistry;
}

function registryOf(...slugs: string[]): LocalityRegistry {
  return registryWith([], ...slugs);
}

class FakeSource extends LocalityRegistrySource {
  refreshes = 0;
  options: ({ sync?: boolean } | undefined)[] = [];
  constructor(
    private registry: LocalityRegistry,
    private readonly after?: LocalityRegistry
  ) {
    super();
  }
  current(): LocalityRegistry {
    return this.registry;
  }
  async refresh(options?: { sync?: boolean }): Promise<LocalityRegistry> {
    this.refreshes += 1;
    this.options.push(options);
    if (this.after) this.registry = this.after;
    return this.registry;
  }
}

interface Last {
  periodEnd: string;
  cadence: Cadence;
}

/** The schedule with its database and pipeline replaced by in-memory fakes. */
class TestSchedule extends DailySchedule {
  readonly order: string[] = [];
  readonly sourced: string[] = [];
  inFlight = 0;
  maxInFlight = 0;
  lasts = new Map<string, Last>();
  searched = new Map<string, string>();
  holdMs = 0;

  constructor(config: ScheduleConfig, registry: LocalityRegistrySource) {
    super(config, {} as DataSource, {} as PipelineStages, registry);
  }

  protected override async lastEdition(slug: string): Promise<Last | null> {
    return this.lasts.get(slug) ?? null;
  }
  protected override async recentItems(): Promise<number> {
    return 100;
  }
  protected override async lastSearched(slug: string): Promise<string | null> {
    return this.searched.get(slug) ?? null;
  }
  protected override async source(target: LocalityConfig): Promise<string> {
    this.sourced.push(target.slug);
    return 'sourced';
  }
  protected override async run(target: LocalityConfig): Promise<string> {
    this.order.push(target.slug);
    this.inFlight += 1;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    await new Promise((resolve) => setTimeout(resolve, this.holdMs));
    this.inFlight -= 1;
    return 'succeeded';
  }
  refreshForTest(): Promise<void> {
    return this.refreshRegistry();
  }
}

function config(env: Record<string, string> = {}): ScheduleConfig {
  return loadScheduleConfig({
    PIPELINE_DAILY_AT: '05:30',
    ...env,
  });
}

/** Every town already searched this week, so sourcing is not due. */
function established(schedule: TestSchedule, slugs: string[]): void {
  slugs.forEach((slug, index) => {
    schedule.lasts.set(slug, {
      periodEnd: `2026-11-0${index + 1}`,
      cadence: 'daily',
    });
    schedule.searched.set(slug, '2026-11-03');
  });
}

describe('DailySchedule.tick', () => {
  it('runs the least recently published towns first, never-run towns before all', async () => {
    const schedule = new TestSchedule(
      config({ SOURCING_MAX_PER_TICK: '10' }),
      new FakeSource(registryOf('c', 'a', 'b', 'never'))
    );
    schedule.lasts.set('a', { periodEnd: '2026-11-04', cadence: 'daily' });
    schedule.lasts.set('b', { periodEnd: '2026-11-02', cadence: 'daily' });
    schedule.lasts.set('c', { periodEnd: '2026-11-03', cadence: 'daily' });
    schedule.searched.set('a', TODAY);
    schedule.searched.set('b', TODAY);
    schedule.searched.set('c', TODAY);

    await schedule.tick(NOW);

    expect(schedule.order).toEqual(['never', 'b', 'c', 'a']);
  });

  it('skips a town whose edition for today exists', async () => {
    const schedule = new TestSchedule(
      config(),
      new FakeSource(registryOf('done', 'todo'))
    );
    established(schedule, ['todo']);
    schedule.lasts.set('done', { periodEnd: TODAY, cadence: 'daily' });

    await schedule.tick(NOW);

    expect(schedule.order).toEqual(['todo']);
  });

  it('runs at most PIPELINE_MAX_TOWNS_PER_TICK towns and takes the rest next tick', async () => {
    const slugs = ['a', 'b', 'c', 'd', 'e'];
    const schedule = new TestSchedule(
      config({ PIPELINE_MAX_TOWNS_PER_TICK: '2' }),
      new FakeSource(registryOf(...slugs))
    );
    established(schedule, slugs);

    await schedule.tick(NOW);
    expect(schedule.order).toEqual(['a', 'b']);

    // The two that ran now have today's edition; the next two are due.
    schedule.lasts.set('a', { periodEnd: TODAY, cadence: 'daily' });
    schedule.lasts.set('b', { periodEnd: TODAY, cadence: 'daily' });
    schedule.order.length = 0;
    await schedule.tick(NOW);
    expect(schedule.order).toEqual(['c', 'd']);
  });

  it('runs one town at a time by default and PIPELINE_CONCURRENCY at once when set', async () => {
    const slugs = ['a', 'b', 'c', 'd'];
    const serial = new TestSchedule(
      config(),
      new FakeSource(registryOf(...slugs))
    );
    established(serial, slugs);
    serial.holdMs = 5;
    await serial.tick(NOW);
    expect(serial.maxInFlight).toBe(1);
    expect(serial.order).toHaveLength(4);

    const parallel = new TestSchedule(
      config({ PIPELINE_CONCURRENCY: '2' }),
      new FakeSource(registryOf(...slugs))
    );
    established(parallel, slugs);
    parallel.holdMs = 5;
    const done = await parallel.tick(NOW);
    expect(parallel.maxInFlight).toBe(2);
    expect(done.filter((step) => step.action === 'succeeded')).toHaveLength(4);
  });

  it('starts discovery for at most SOURCING_MAX_PER_TICK towns; new towns wait, established ones run on', async () => {
    const schedule = new TestSchedule(
      config({ SOURCING_MAX_PER_TICK: '2' }),
      new FakeSource(registryOf('n1', 'n2', 'n3', 'old'))
    );
    // `old` has an edition and a search a month ago: sourcing is due, but it need not wait.
    schedule.lasts.set('old', { periodEnd: '2026-11-04', cadence: 'daily' });
    schedule.searched.set('old', '2026-10-01');

    await schedule.tick(NOW);

    // never-run towns lead the order and take the two slots; n3 is deferred.
    expect(schedule.sourced).toEqual(['n1', 'n2']);
    expect(schedule.order).toEqual(['n1', 'n2', 'old']);

    // Next tick the new towns have run; n3 gets the freed slot.
    schedule.lasts.set('n1', { periodEnd: TODAY, cadence: 'weekly' });
    schedule.lasts.set('n2', { periodEnd: TODAY, cadence: 'weekly' });
    schedule.lasts.set('old', { periodEnd: TODAY, cadence: 'daily' });
    schedule.sourced.length = 0;
    schedule.order.length = 0;
    await schedule.tick(NOW);
    expect(schedule.sourced).toEqual(['n3']);
    expect(schedule.order).toEqual(['n3']);
  });

  it('does nothing with the kill switch off, tick and start alike', async () => {
    const schedule = new TestSchedule(
      config({ DAYLIGHT_SCHEDULE_ENABLED: 'false' }),
      new FakeSource(registryOf('a', 'b'))
    );
    expect(await schedule.tick(NOW)).toEqual([]);
    schedule.start();
    schedule.stop();
    expect(schedule.order).toEqual([]);
    expect(schedule.sourced).toEqual([]);
  });

  it('sees towns a registry refresh adds, after adoption', async () => {
    const source = new FakeSource(registryOf('a'), registryOf('a', 'b'));
    const schedule = new TestSchedule(config(), source);
    established(schedule, ['a', 'b']);

    await schedule.refreshForTest();
    expect(source.refreshes).toBe(1);
    expect(source.options).toEqual([{ sync: false }]);

    await schedule.tick(NOW);
    expect(schedule.order.sort()).toEqual(['a', 'b']);
    expect(schedule.townSlugs()).toEqual(['a', 'b']);
  });

  describe('towns with no sources (D32)', () => {
    it('skips a searched town without running it and without using a tick slot', async () => {
      const schedule = new TestSchedule(
        config({ PIPELINE_MAX_TOWNS_PER_TICK: '1' }),
        new FakeSource(registryWith(['a'], 'a', 'b'))
      );
      established(schedule, ['a', 'b']);
      schedule.lasts.delete('a');

      const done = await schedule.tick(NOW);

      expect(schedule.order).toEqual(['b']);
      expect(schedule.sourced).toEqual([]);
      expect(done.map((step) => step.town)).not.toContain('a');
    });

    it('does not search it again before the re-search interval', async () => {
      const schedule = new TestSchedule(
        config(),
        new FakeSource(registryWith(['a'], 'a'))
      );
      schedule.searched.set('a', '2026-11-03');
      await schedule.tick(NOW);
      expect(schedule.sourced).toEqual([]);
      expect(schedule.order).toEqual([]);
    });

    it('searches it again when the interval has passed, then skips it if still empty', async () => {
      const schedule = new TestSchedule(
        config(),
        new FakeSource(registryWith(['a'], 'a'))
      );
      schedule.searched.set('a', '2026-10-01');
      const done = await schedule.tick(NOW);
      expect(schedule.sourced).toEqual(['a']);
      expect(schedule.order).toEqual([]);
      expect(done).toContainEqual({ town: 'a', action: 'no sources' });
    });

    it('does not run a town that discovery has just left with nothing', async () => {
      const schedule = new TestSchedule(
        config(),
        new FakeSource(registryWith(['a'], 'a'))
      );
      // Never searched, so discovery runs; the fake records the search.
      jest
        .spyOn(schedule as unknown as { source(): Promise<string> }, 'source')
        .mockImplementation(async () => {
          schedule.searched.set('a', TODAY);
          return 'sourced';
        });
      await schedule.tick(NOW);
      expect(schedule.order).toEqual([]);
    });

    it('logs the skip once', async () => {
      const schedule = new TestSchedule(
        config(),
        new FakeSource(registryWith(['a'], 'a'))
      );
      schedule.searched.set('a', '2026-11-03');
      const log = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);
      await schedule.tick(NOW);
      await schedule.tick(NOW);
      const said = log.mock.calls.filter(([line]) => line === 'a: no sources');
      log.mockRestore();
      expect(said).toHaveLength(1);
    });
  });
});

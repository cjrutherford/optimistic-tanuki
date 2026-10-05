import { BackfillService, type BackfillSchedule } from './backfill.service';

interface FakeSchedule extends BackfillSchedule {
  calls: string[];
  release: () => void;
}

function fakeSchedule(): FakeSchedule {
  let release = () => undefined as void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const calls: string[] = [];
  return {
    calls,
    release: () => release(),
    townSlugs: () => ['adel-ga', 'moultrie-ga'],
    exclusive: async (work) => {
      await gate;
      return work();
    },
    pullNow: async ([town]) => {
      calls.push(`pull ${town}`);
      return [{ town: town ?? '', action: 'pulled' }];
    },
    backfill: async ([town], days) => {
      calls.push(`backfill ${town} ${days ?? 'default'}`);
      return [{ town: town ?? '', action: 'backfilled' }];
    },
  };
}

describe('BackfillService', () => {
  it('says so when no town registry is configured', () => {
    const service = new BackfillService();
    const status = service.start();
    expect(status.configured).toBe(false);
    expect(status.running).toBe(false);
    expect(status.problem).toContain('CIVIC_LOCALITIES_DIR');
  });

  it('pulls then backfills each town in turn, one backfill at a time', async () => {
    const service = new BackfillService();
    const schedule = fakeSchedule();
    service.attach(schedule);

    const started = service.start({ days: 30 });
    expect(started).toMatchObject({
      running: true,
      towns: ['adel-ga', 'moultrie-ga'],
      days: 30,
    });
    // A second request while one runs gets the running one's status.
    expect(service.start({ towns: ['adel-ga'] }).towns).toEqual([
      'adel-ga',
      'moultrie-ga',
    ]);

    schedule.release();
    await service.settled();
    expect(schedule.calls).toEqual([
      'pull adel-ga',
      'backfill adel-ga 30',
      'pull moultrie-ga',
      'backfill moultrie-ga 30',
    ]);
    const done = service.status();
    expect(done.running).toBe(false);
    expect(done.finishedAt).not.toBeNull();
    expect(done.steps).toHaveLength(4);
  });

  it('refuses a town that is not scheduled', () => {
    const service = new BackfillService();
    service.attach(fakeSchedule());
    const status = service.start({ towns: ['nowhere-ga'] });
    expect(status.running).toBe(false);
    expect(status.problem).toBe('Not a scheduled town: nowhere-ga.');
  });

  it('records why a backfill stopped', async () => {
    const service = new BackfillService();
    service.attach({
      ...fakeSchedule(),
      exclusive: async () => {
        throw new Error('A scheduled run is in progress; try again shortly.');
      },
    });
    service.start();
    await service.settled();
    expect(service.status()).toMatchObject({
      running: false,
      problem: 'A scheduled run is in progress; try again shortly.',
    });
  });
});

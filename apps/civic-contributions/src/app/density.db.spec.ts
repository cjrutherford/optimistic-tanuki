import {
  renderDensityReport,
  standingOfDensity,
} from '@optimistic-tanuki/civic-community';
import type { DataSource } from 'typeorm';
import type { DensityService } from './density.service';
import type { IntakeService } from './intake.service';
import {
  createHarness,
  type Harness,
  actor,
  request,
  contributionOf,
} from './testing/community-fixture';

/** Contributor density. */

let h: Harness;
let db: DataSource;
let intake: IntakeService;
let density: DensityService;

beforeAll(async () => {
  h = await createHarness();
  db = h.db;
  intake = h.intake;
  density = h.density;
});

afterAll(async () => {
  await h?.close();
});

beforeEach(async () => {
  await h.reset();
});

describe('contributor density', () => {
  it('counts people rather than contributions, and includes a town with nobody in it', async () => {
    const who = actor();
    contributionOf(await intake.submit(request(who)));
    contributionOf(
      await intake.submit(
        request(who, {
          body: 'A second account of the same evening, from the same person.',
        })
      )
    );

    const rows = await density.density();
    const town = rows.find((row) => row.localitySlug === 'town-ga');
    if (!town) throw new Error('town-ga is missing from the density report');
    expect(town.active).toBe(1);
    expect(town.reports).toBe(2);
    expect(standingOfDensity(town.active)).toBe('short');
    expect(rows.every((row) => typeof row.town === 'string')).toBeTruthy();
  });

  it('stops counting someone who has gone quiet', async () => {
    const who = actor();
    const view = contributionOf(await intake.submit(request(who)));
    await db.query(
      'UPDATE contributions SET "submittedAt" = now() - interval \'90 days\' WHERE id = $1',
      [view.id]
    );

    const town = (await density.density()).find(
      (row) => row.localitySlug === 'town-ga'
    );
    expect(town?.active).toBe(0);
    expect(town?.everContributed).toBe(1);
  });

  it('writes a week of it as a report an operator can keep', async () => {
    contributionOf(await intake.submit(request(actor())));
    const report = await density.writeReport(new Date('2026-09-24T12:00:00Z'));
    expect(report.week).toBe('2026-09-21');
    const markdown = renderDensityReport(report.rows, report.week);
    expect(markdown).toMatch(/Contributor density, week of 2026-09-21/u);
    expect(markdown).toMatch(/Where to recruit/u);
  });
});

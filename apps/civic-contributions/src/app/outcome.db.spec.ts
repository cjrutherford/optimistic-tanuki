import type { Actor, SubmitRequest } from '@optimistic-tanuki/civic-community';
import type { CorroborationService } from './corroboration.service';
import type { DataSource } from 'typeorm';
import type { IntakeService } from './intake.service';
import type { OfficialsService } from './officials.service';
import type { OutcomeService } from './outcome.service';
import type { PromotionService } from './promotion.service';
import type { SurfaceService } from './surface.service';
import {
  createHarness,
  type Harness,
  type StandInModel,
  type FakeBriefing,
  actor,
  request,
  contributionOf,
} from './testing/community-fixture';

/** Outcomes and standing, and what a briefing may quote. */

let h: Harness;
let db: DataSource;
let intake: IntakeService;
let officials: OfficialsService;
let surface: SurfaceService;
let outcomes: OutcomeService;
let promotion: PromotionService;
let corroboration: CorroborationService;
let model: StandInModel;
let briefing: FakeBriefing;

beforeAll(async () => {
  h = await createHarness();
  db = h.db;
  intake = h.intake;
  officials = h.officials;
  surface = h.surface;
  outcomes = h.outcomes;
  promotion = h.promotion;
  corroboration = h.corroboration;
  model = h.model;
  briefing = h.briefing;
});

afterAll(async () => {
  await h?.close();
});

beforeEach(async () => {
  await h.reset();
});

describe('outcomes and standing', () => {
  /** A report the corpus has a later article about: the council kept the millage rate. */
  const millage = (who: Actor) =>
    request(who, {
      subject: {
        kind: 'other',
        ref: null,
        text: 'Council holds the millage rate',
      },
      body: "At Monday night's meeting the council voted to hold the millage rate where it is, after residents asked for relief for older homes on fixed incomes.",
    });

  it("records what a later article said, and moves the contributor's standing", async () => {
    const who = actor();
    const report = contributionOf(await intake.submit(millage(who)));
    model.answers = { sameMatter: true, supports: true };

    expect(await outcomes.sweep()).toEqual({
      compared: 1,
      confirmed: 1,
      contradicted: 0,
    });
    expect(await outcomes.history(await contributorIdOf(report.id))).toEqual({
      confirmed: 1,
      contradicted: 0,
      pending: 0,
    });

    const events = (await db.getRepository('ReputationEventEntity').find()) as {
      delta: number;
      topic: string;
      kind: string;
    }[];
    expect(events.length).toBe(1);
    expect(events[0]!.kind).toBe('confirmed');
    expect(events[0]!.topic).toBe('government');
    expect(events[0]!.delta).toBe(0.05);
  });

  it("shows the record beside the report, on the town page and the contributor's", async () => {
    const who = actor();
    contributionOf(await intake.submit(millage(who)));
    model.answers = { sameMatter: true, supports: true };
    await outcomes.sweep();

    const [item] = (await surface.surface('town-ga')).items;
    expect(item!.outcomes.length).toBe(1);
    expect(item!.outcomes[0]!.verdict).toBe('confirmed');
    expect(item!.outcomes[0]!.title).toBe('Council holds millage rate');
    expect(item!.outcomes[0]!.publisher).toBe('Tifton Gazette');
  });

  it('records a contradiction too, and takes more away than a confirmation gave', async () => {
    const who = actor();
    const report = contributionOf(await intake.submit(millage(who)));
    model.answers = { sameMatter: true, contradicts: true };
    expect(await outcomes.sweep()).toEqual({
      compared: 1,
      confirmed: 0,
      contradicted: 1,
    });

    expect(await outcomes.history(await contributorIdOf(report.id))).toEqual({
      confirmed: 0,
      contradicted: 1,
      pending: 0,
    });
    const events = (await db.getRepository('ReputationEventEntity').find()) as {
      delta: number;
    }[];
    expect(events[0]!.delta).toBe(-0.3);
    const [item] = (await surface.surface('town-ga')).items;
    expect(item!.outcomes[0]!.verdict).toBe('contradicted');
  });

  it('leaves a report pending when no record settles it, and moves nothing', async () => {
    const who = actor();
    const report = contributionOf(await intake.submit(millage(who)));
    model.answers = { sameMatter: true };
    await outcomes.sweep();

    expect(await outcomes.history(await contributorIdOf(report.id))).toEqual({
      confirmed: 0,
      contradicted: 0,
      pending: 1,
    });
    expect(await db.getRepository('ReputationEventEntity').count()).toBe(0);
    const [item] = (await surface.surface('town-ga')).items;
    expect(item!.outcomes).toEqual([]);
  });

  it('will not compare the same record with the same report twice', async () => {
    const who = actor();
    contributionOf(await intake.submit(millage(who)));
    model.answers = { sameMatter: false };
    expect((await outcomes.sweep()).compared).toBe(1);
    expect((await outcomes.sweep()).compared).toBe(0);
  });

  it('gives back the standing a withdrawn report earned', async () => {
    const who = actor();
    const report = contributionOf(await intake.submit(millage(who)));
    model.answers = { sameMatter: true, supports: true };
    await outcomes.sweep();

    await intake.withdraw(who, report.id);
    const events = (await db.getRepository('ReputationEventEntity').find()) as {
      delta: number;
      kind: string;
    }[];
    expect(events.length).toBe(2);
    expect(events[1]!.kind).toBe('reversed');
    expect(events.reduce((sum, event) => sum + event.delta, 0)).toBe(0);
  });

  it('carries standing into the gate, so being right before counts next time', async () => {
    const who = actor();
    const first = contributionOf(await intake.submit(millage(who)));
    model.answers = { sameMatter: true, supports: true };
    await outcomes.sweep();

    const row = await db
      .getRepository('ContributionEntity')
      .findOneByOrFail({ id: first.id });
    const evaluation = await corroboration.compute(row as never);
    expect(evaluation.gate.mass).toBe(0.35);
  });

  const contributorIdOf = async (contributionId: string): Promise<string> => {
    const row = (await db
      .getRepository('ContributionEntity')
      .findOneByOrFail({ id: contributionId })) as { contributorId: string };
    return row.contributorId;
  };
});

describe('what a briefing may quote', () => {
  const millage = (who: Actor) =>
    request(who, {
      subject: {
        kind: 'other',
        ref: null,
        text: 'Council holds the millage rate',
      },
      body: "At Monday night's meeting the council voted to hold the millage rate where it is, after residents asked for relief for older homes on fixed incomes.",
    });

  /** Corroboration enough to cross the gate: the report, plus two independent accounts. */
  const corroborate = async (
    reportId: string,
    times: number
  ): Promise<void> => {
    for (let index = 0; index < times; index += 1) {
      const who = actor();
      contributionOf(await intake.submit(request(who)));
      await db.query(
        'UPDATE contributions SET "submittedAt" = now() - interval \'2 hours\' WHERE "contributorId" = (SELECT id FROM contributors WHERE "userId" = $1)',
        [who.userId]
      );
      await db.query(
        'UPDATE contributors SET "createdAt" = now() - interval \'30 days\' WHERE "userId" = $1',
        [who.userId]
      );
      const support = contributionOf(
        await intake.submit(
          request(who, {
            subject: { kind: 'contribution', ref: reportId, text: '' },
            body: `I was there too, and that is what happened. Account ${index}.`,
          })
        )
      );
      // Corroborations arriving together count as one; these came hours apart.
      await db.query(
        `UPDATE contributions SET "submittedAt" = now() - interval '${
          index + 1
        } hours' WHERE id = $1`,
        [support.id]
      );
    }
  };

  it('quotes nothing from a resident report that only residents support', async () => {
    const who = actor();
    const report = contributionOf(await intake.submit(millage(who)));
    await corroborate(report.id, 3);

    const snapshot = await promotion.snapshot('town-ga');
    expect(snapshot.quotes).toEqual([]);
  });

  it('quotes a corroborated report once a record bears it out, with the record named', async () => {
    const who = actor();
    const report = contributionOf(await intake.submit(millage(who)));
    await corroborate(report.id, 3);
    model.answers = { sameMatter: true, supports: true };
    await outcomes.sweep();

    const snapshot = await promotion.snapshot('town-ga');
    const quoted = snapshot.quotes.find((quote) => quote.id === report.id);
    if (!quoted) throw new Error(JSON.stringify(snapshot.quotes));
    expect(quoted.path).toBe('confirmed');
    expect(quoted.quote).toBe(report.body);
    expect(quoted.confirmedBy?.title).toBe('Council holds millage rate');
  });

  it("quotes an official's material once the callback is on the record", async () => {
    const who = actor();
    await officials.apply({
      actor: who,
      email: 'jdoe@town-ga.gov',
      emailVerified: true,
      name: 'Jane Q. Doe',
      localitySlug: 'town-ga',
    });
    contributionOf(await intake.submit(millage(who)));
    expect((await promotion.snapshot('town-ga')).quotes).toEqual([]);

    await officials.confirmCallback({
      userId: who.userId,
      localitySlug: 'town-ga',
      operator: 'tester',
      note: 'called the published number',
    });
    contributionOf(
      await intake.submit(
        request(who, {
          body: 'The council set the hearing for the first Monday in October.',
        })
      )
    );
    const quotes = (await promotion.snapshot('town-ga')).quotes;
    expect(quotes.length).toBe(1);
    expect(quotes[0]!.path).toBe('official-record');
    expect(quotes[0]!.office).toBe('City Clerk');
  });

  it('stops quoting what was withdrawn, and owes the edition a correction', async () => {
    const who = actor();
    const report = contributionOf(await intake.submit(millage(who)));
    await corroborate(report.id, 3);
    model.answers = { sameMatter: true, supports: true };
    await outcomes.sweep();
    expect((await promotion.snapshot('town-ga')).quotes.length).toBe(1);

    await intake.withdraw(who, report.id);
    const after = await promotion.snapshot('town-ga');
    expect(after.quotes).toEqual([]);
    expect(after.corrections.length).toBe(1);
    expect(after.corrections[0]!.affects).toBe('2026-09-14');
    expect(after.corrections[0]!.text).toMatch(/has been withdrawn/u);
  });

  it('stops quoting a report a later record went against', async () => {
    const who = actor();
    const report = contributionOf(await intake.submit(millage(who)));
    await corroborate(report.id, 3);
    model.answers = { sameMatter: true, supports: true };
    await outcomes.sweep();
    expect((await promotion.snapshot('town-ga')).quotes.length).toBe(1);

    await db.query(
      'UPDATE outcome_matches SET verdict = $1 WHERE "contributionId" = $2',
      ['contradicted', report.id]
    );
    const after = await promotion.snapshot('town-ga');
    expect(after.quotes).toEqual([]);
    expect(after.corrections[0]!.text).toMatch(/says otherwise/u);
  });
});

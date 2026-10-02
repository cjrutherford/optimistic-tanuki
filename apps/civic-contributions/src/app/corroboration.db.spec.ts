import type { Actor, SubmitRequest } from '@optimistic-tanuki/civic-community';
import type { CorroborationService } from './corroboration.service';
import type { DataSource } from 'typeorm';
import type { IntakeService } from './intake.service';
import type { OfficialsService } from './officials.service';
import type { SurfaceService } from './surface.service';
import {
  createHarness,
  type Harness,
  type StandInModel,
  actor,
  request,
  contributionOf,
  refusedOf,
  PDF,
} from './testing/community-fixture';

/** Corroboration: the verification floor, the gate, and its effect on the surface. */

let h: Harness;
let db: DataSource;
let intake: IntakeService;
let officials: OfficialsService;
let surface: SurfaceService;
let corroboration: CorroborationService;
let model: StandInModel;

beforeAll(async () => {
  h = await createHarness();
  db = h.db;
  intake = h.intake;
  officials = h.officials;
  surface = h.surface;
  corroboration = h.corroboration;
  model = h.model;
});

afterAll(async () => {
  await h?.close();
});

beforeEach(async () => {
  await h.reset();
});

describe('corroboration', () => {
  /** An account past the verification floor: a week old, with a report that cleared review. */
  const veteran = async (roles?: readonly string[]): Promise<Actor> => {
    const who = actor(roles);
    contributionOf(
      await intake.submit(
        request(who, {
          body: 'An earlier report of mine about the library hours changing this autumn.',
        })
      )
    );
    const contributor = await intake.contributor(who);
    await db.query(
      'UPDATE contributors SET "createdAt" = now() - interval \'30 days\' WHERE id = $1',
      [contributor.id]
    );
    return who;
  };
  /**
   * Corroborations submitted within minutes of each other are one burst, and
   * count once. Everything already recorded is moved an hour back first, so
   * each arrives on its own, as real ones would.
   */
  const corroborate = async (
    who: Actor,
    report: string,
    overrides: Partial<SubmitRequest> = {}
  ) => {
    await db.query(
      'UPDATE contributions SET "submittedAt" = "submittedAt" - interval \'1 hour\''
    );
    return await submitCorroboration(who, report, overrides);
  };
  const submitCorroboration = (
    who: Actor,
    report: string,
    overrides: Partial<SubmitRequest> = {}
  ) =>
    intake.submit(
      request(who, {
        subject: { kind: 'contribution', ref: report, text: '' },
        occurredOn: null,
        body: 'I was there too, and I saw the council keep the rate after the residents spoke.',
        ...overrides,
      })
    );
  const withArtifact = (name: string): Partial<SubmitRequest> => ({
    kind: 'artifact',
    body: 'The agenda as it was posted, photographed on the night.',
    representations: { ownWords: true, rightsToAttachments: true },
    attachment: {
      name,
      base64: Buffer.from(`%PDF-1.4 ${name}`).toString('base64'),
    },
  });
  const statusOf = async (reportId: string) =>
    (await surface.surface('town-ga')).items.find(
      (item) => item.id === reportId
    );

  it('returns the first submission when a retry carries the same key', async () => {
    const who = actor();
    const first = contributionOf(
      await intake.submit(request(who, { idempotencyKey: 'k-1' }))
    );
    const retry = contributionOf(
      await intake.submit(request(who, { idempotencyKey: 'k-1' }))
    );
    expect(retry.id).toBe(first.id);
    expect(await db.getRepository('ContributionEntity').count()).toBe(1);
  });

  describe('a verified official never corroborates (D20)', () => {
    const corroboratorWith = async (roles: readonly string[]) => {
      const report = contributionOf(await intake.submit(request(actor())));
      const who = await veteran(roles);
      const result = await corroborate(who, report.id);
      return { report, result };
    };

    it('lets a member corroborate', async () => {
      const { report, result } = await corroboratorWith(['local_hub_member']);
      expect(contributionOf(result).state).toBe('accepted');
      expect((await statusOf(report.id))?.corroborations.length).toBe(1);
    });

    it('refuses a verified official, whose own member grant is taken back', async () => {
      const { result } = await corroboratorWith([
        'local_hub_verified_official',
      ]);
      const refused = refusedOf(result);
      expect(refused.stage).toBe('validation');
      expect(refused.reasons.join(' ')).toMatch(
        /verified official cannot corroborate/u
      );
    });

    it('refuses an official who is also a member', async () => {
      const { report, result } = await corroboratorWith([
        'local_hub_member',
        'local_hub_verified_official',
      ]);
      expect(refusedOf(result).reasons.join(' ')).toMatch(
        /verified official cannot corroborate/u
      );
      expect(
        await db
          .getRepository('ContributionEntity')
          .countBy({ subjectRef: report.id })
      ).toBe(0);
    });

    it('refuses when the request carries no roles (fail closed)', async () => {
      const report = contributionOf(await intake.submit(request(actor())));
      const { roles: _sent, ...withoutRoles } = await veteran();
      const result = await corroborate(withoutRoles, report.id);
      expect(refusedOf(result).reasons.join(' ')).toMatch(
        /roles were not provided/u
      );
    });

    it('refuses an account whose roles do not grant corroboration', async () => {
      const { result } = await corroboratorWith([]);
      expect(refusedOf(result).reasons.join(' ')).toMatch(
        /not permitted to corroborate/u
      );
    });

    it('refuses an official this service itself has verified, whatever roles it was sent', async () => {
      const report = contributionOf(await intake.submit(request(actor())));
      const who = await veteran(['local_hub_member']);
      await officials.apply({
        actor: who,
        email: 'jdoe@town-ga.gov',
        emailVerified: true,
        name: 'Jane Q. Doe',
        localitySlug: 'town-ga',
      });
      const result = await corroborate(who, report.id);
      expect(refusedOf(result).reasons.join(' ')).toMatch(
        /verified official cannot corroborate/u
      );
    });
  });

  it('holds new accounts below the verification floor', async () => {
    const report = contributionOf(await intake.submit(request(actor())));
    const newcomer = actor();
    const result = await corroborate(newcomer, report.id);
    expect(refusedOf(result).stage).toBe('floor');
    expect(refusedOf(result).reasons.join(' ')).toMatch(/7 days/u);
  });

  it('does not let a contributor corroborate their own report', async () => {
    const who = await veteran();
    const report = contributionOf(await intake.submit(request(who)));
    const result = await corroborate(who, report.id);
    expect(refusedOf(result).reasons.join(' ')).toMatch(/your own report/u);
  });

  it('shows a single report, then a corroborated one once independent weight crosses the gate', async () => {
    const report = contributionOf(await intake.submit(request(actor())));
    expect((await statusOf(report.id))?.status).toBe('single');
    contributionOf(
      await corroborate(await veteran(), report.id, withArtifact('a'))
    );
    expect((await statusOf(report.id))?.status).toBe('single');
    const second = contributionOf(
      await corroborate(await veteran(), report.id, withArtifact('b'))
    );
    const item = await statusOf(report.id);
    expect(item?.status).toBe('corroborated');
    expect(item?.corroborations.length).toBe(2);
    expect(second.review.at(-1)!.outcome).toBe('counted');
    const [mine] = await intake.mine(
      (await db
        .getRepository('ContributorEntity')
        .findOneByOrFail({ id: item!.contributor.id })) as {
        userId: string;
        profileId: string;
        handle: string;
      }
    );
    expect(
      mine!.review.some(
        (step) =>
          step.stage === 'corroboration' && step.outcome === 'corroborated'
      )
    ).toBeTruthy();
  });

  it('counts a burst of corroborations minutes apart as one', async () => {
    const report = contributionOf(await intake.submit(request(actor())));
    contributionOf(await corroborate(await veteran(), report.id));
    const burst = contributionOf(
      await submitCorroboration(await veteran(), report.id)
    );
    expect(burst.review.at(-1)!.outcome).toBe('not-counted');
    expect(burst.review.at(-1)!.reasons[0]!).toMatch(/within 5 minutes/u);
  });

  it('counts contributions from one network as one, and says so', async () => {
    const report = contributionOf(await intake.submit(request(actor())));
    const first = await veteran();
    const second = await veteran();
    contributionOf(
      await corroborate(first, report.id, {
        origin: { network: 'shared', client: 'a' },
      })
    );
    const collapsed = contributionOf(
      await corroborate(second, report.id, {
        origin: { network: 'shared', client: 'b' },
      })
    );
    expect(collapsed.review.at(-1)!.outcome).toBe('not-counted');
    expect(collapsed.review.at(-1)!.reasons[0]!).toMatch(
      /same network or device/u
    );
    const secondContributor = await intake.contributor(second);
    const page = await surface.contributorPage(secondContributor.id);
    expect(page!.corroborated.length).toBe(0);
  });

  it('releases a held allegation only with evidence, not with volume', async () => {
    const report = contributionOf(
      await intake.submit(
        request(actor(), {
          body: 'The clerk lied about the vote count at the September meeting; I was in the room.',
        })
      )
    );
    expect(report.state).toBe('held');
    expect(await statusOf(report.id)).toBe(undefined);
    for (let index = 0; index < 4; index += 1) {
      contributionOf(
        await corroborate(await veteran(), report.id, {
          body: `I was in the room as well and heard the count read out differently, account ${index}.`,
        })
      );
    }
    expect(await statusOf(report.id)).toBe(undefined);
    contributionOf(
      await corroborate(await veteran(), report.id, withArtifact('minutes'))
    );
    const released = await statusOf(report.id);
    expect(released?.status).toBe('corroborated');
    expect(released?.releasedByEvidence).toBe(true);
  });

  it('takes a withdrawn corroboration out of the count at once', async () => {
    const report = contributionOf(await intake.submit(request(actor())));
    const a = await veteran();
    contributionOf(await corroborate(a, report.id, withArtifact('x')));
    const b = await veteran();
    const last = contributionOf(
      await corroborate(b, report.id, withArtifact('y'))
    );
    expect((await statusOf(report.id))?.status).toBe('corroborated');
    await intake.withdraw(b, last.id);
    expect((await statusOf(report.id))?.status).toBe('single');
  });

  it("shows an official's material apart, labeled with what was checked", async () => {
    const who = actor();
    await officials.apply({
      actor: who,
      email: 'jdoe@town-ga.gov',
      emailVerified: true,
      name: 'Jane Q. Doe',
      localitySlug: 'town-ga',
    });
    contributionOf(await intake.submit(request(who)));
    const view = await surface.surface('town-ga');
    expect(view.items.length).toBe(0);
    expect(view.official.length).toBe(1);
    expect(view.official[0]!.label).toMatch(/town-ga\.gov address/u);
    expect(view.official[0]!.label).toMatch(/not yet been confirmed/u);
    expect(view.official[0]!.officialRecord).toBe(false);
  });

  it('serves an attachment only once its contribution is on the surface', async () => {
    const who = actor();
    const report = contributionOf(
      await intake.submit(
        request(who, {
          kind: 'artifact',
          body: 'The posted notice, photographed Monday.',
          representations: { ownWords: true, rightsToAttachments: true },
          attachment: { name: 'n.pdf', base64: PDF },
        })
      )
    );
    const sha = report.artifact!.sha256;
    expect(await surface.artifact(sha)).toBeTruthy();
    await intake.withdraw(who, report.id);
    expect(await surface.artifact(sha)).toBe(null);
  });

  it('reviews again what was held because the model could not be reached', async () => {
    model.unreachable = true;
    const held = contributionOf(await intake.submit(request(actor())));
    expect(held.state).toBe('held');
    model.unreachable = false;
    expect(await intake.rereview()).toBe(1);
    const row = (await db
      .getRepository('ContributionEntity')
      .findOneByOrFail({ id: held.id })) as { state: string };
    expect(row.state).toBe('accepted');
  });

  it('forgets where submissions came from after the retention period', async () => {
    const view = contributionOf(await intake.submit(request(actor())));
    await db.query(
      'UPDATE contributions SET "submittedAt" = now() - interval \'400 days\' WHERE id = $1',
      [view.id]
    );
    expect(await intake.purgeOrigins()).toBe(1);
    const row = (await db
      .getRepository('ContributionEntity')
      .findOneByOrFail({ id: view.id })) as { originNetwork: string | null };
    expect(row.originNetwork).toBe(null);
  });
});

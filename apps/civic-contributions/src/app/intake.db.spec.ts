import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Actor, SubmitRequest } from '@optimistic-tanuki/civic-community';
import type { CommunityConfig } from '../config';
import type { CopyrightService } from './copyright.service';
import type { DataSource } from 'typeorm';
import type { IntakeService } from './intake.service';
import type { OfficialsService } from './officials.service';
import {
  createHarness,
  type Harness,
  type FakeScanner,
  type StandInModel,
  actor,
  request,
  contributionOf,
  refusedOf,
  PDF,
  ARTICLE,
} from './testing/community-fixture';

/** Intake, uploads, officials and copyright notices, through the service as AppModule wires it, against Postgres. */

let h: Harness;
let db: DataSource;
let config: CommunityConfig;
let intake: IntakeService;
let officials: OfficialsService;
let copyright: CopyrightService;
let scanner: FakeScanner;
let model: StandInModel;

beforeAll(async () => {
  h = await createHarness();
  db = h.db;
  config = h.config;
  intake = h.intake;
  officials = h.officials;
  copyright = h.copyright;
  scanner = h.scanner;
  model = h.model;
});

afterAll(async () => {
  await h?.close();
});

beforeEach(async () => {
  await h.reset();
});

describe('intake', () => {
  it('keeps the handle a contributor signed up with (P5.1)', async () => {
    const who = actor();
    const signedUp = await intake.registerContributor({
      ...who,
      handle: 'lovelaneWatcher',
    });
    expect(signedUp.created).toBe(true);
    expect(signedUp.contributor.handle).toBe('lovelaneWatcher');

    // A later request under another name (say, the account's real name)
    // changes nothing: attribution stays with the handle chosen at sign-up.
    const again = await intake.registerContributor({
      ...who,
      handle: 'Ada Lovelace',
    });
    expect(again.created).toBe(false);
    expect(again.contributor.handle).toBe('lovelaneWatcher');
    const view = contributionOf(
      await intake.submit(request({ ...who, handle: 'Ada Lovelace' }))
    );
    expect(view.state).toBe('accepted');
    expect((await intake.contributor(who)).handle).toBe('lovelaneWatcher');
  });

  it('accepts a plain account and records every step', async () => {
    const view = contributionOf(await intake.submit(request(actor())));
    expect(view.state).toBe('accepted');
    expect(view.review.map((step) => step.stage)).toEqual([
      'duplication',
      'model',
    ]);
  });

  it("refuses before review, keeping nothing, without the contributor's affirmations", async () => {
    const result = await intake.submit(
      request(actor(), { representations: { ownWords: true } })
    );
    expect(refusedOf(result).stage).toBe('representations');
    expect(await db.getRepository('ContributionEntity').count()).toBe(0);
  });

  it("attaches only to a meeting or story it has published, under that meeting's own title", async () => {
    const bad = await intake.submit(
      request(actor(), { subject: { kind: 'meeting', ref: '999', text: '' } })
    );
    expect(refusedOf(bad).stage).toBe('validation');
    const good = contributionOf(
      await intake.submit(
        request(actor(), {
          subject: { kind: 'meeting', ref: '2', text: 'my wording' },
        })
      )
    );
    expect(good.subject.text).toBe('Agenda 09/14/2026');
  });

  it('rejects a repost, names the source by its name, and does not keep the copied text', async () => {
    const view = contributionOf(
      await intake.submit(request(actor(), { body: ARTICLE }))
    );
    expect(view.state).toBe('rejected');
    expect(view.review.at(-1)!.reasons[0]!).toMatch(/Tifton Gazette/u);
    expect(view.review.at(-1)!.reasons[0]!).not.toMatch(/A Reporter/u);
    expect(view.body).toMatch(/not kept/u);
  });

  it('holds when the model is unreachable', async () => {
    model.unreachable = true;
    expect(contributionOf(await intake.submit(request(actor()))).state).toBe(
      'held'
    );
  });

  it('holds an allegation however the model answers', async () => {
    expect(
      contributionOf(
        await intake.submit(
          request(actor(), {
            body: 'The treasurer embezzled money from the water fund last year, I saw the ledger.',
          })
        )
      ).state
    ).toBe('held');
  });

  it("limits a contributor's submissions per hour", async () => {
    const who = actor();
    for (let index = 0; index < config.hourlyLimit; index += 1)
      contributionOf(await intake.submit(request(who)));
    const result = await intake.submit(request(who));
    expect(refusedOf(result).stage).toBe('rate-limit');
  });

  it("withdraws only the contributor's own contribution", async () => {
    const owner = actor();
    const view = contributionOf(await intake.submit(request(owner)));
    expect(await intake.withdraw(actor(), view.id)).toBe(null);
    expect((await intake.withdraw(owner, view.id))!.state).toBe('withdrawn');
  });
});

describe('uploads', () => {
  const artifact = (base64: string, name = 'minutes.pdf') =>
    request(actor(), {
      kind: 'artifact',
      body: 'Minutes posted at city hall, photographed Monday.',
      attachment: { name, base64 },
      representations: { ownWords: true, rightsToAttachments: true },
    });

  it("scans every upload, then stores it under its content hash, never the uploader's name", async () => {
    const before = scanner.scanned.length;
    const view = contributionOf(
      await intake.submit(artifact(PDF, '../../escape.pdf'))
    );
    expect(view.state).toBe('accepted');
    expect(scanner.scanned.length).toBe(before + 1);
    expect(view.artifact?.mediaType).toBe('application/pdf');
    const stored = readdirSync(join(config.artifactRoot, 'assets')).flatMap(
      (dir) => readdirSync(join(config.artifactRoot, 'assets', dir))
    );
    expect(stored.every((file) => /^[0-9a-f]{64}\.pdf$/u.test(file))).toBe(
      true
    );
    expect(existsSync(join(h.scratch, 'escape.pdf'))).toBe(false);
  });

  it('keeps one artifact for the same bytes submitted twice', async () => {
    const first = contributionOf(await intake.submit(artifact(PDF)));
    const second = contributionOf(await intake.submit(artifact(PDF)));
    expect(first.artifact?.sha256).toBe(second.artifact?.sha256);
    expect(await db.getRepository('ArtifactEntity').count()).toBe(1);
  });

  it('refuses an infected file before storing anything', async () => {
    const eicar = Buffer.from(
      'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'
    ).toString('base64');
    const result = await intake.submit(artifact(eicar));
    expect(refusedOf(result).reasons[0]).toMatch(/threat/u);
    expect(await db.getRepository('ArtifactEntity').count()).toBe(0);
  });

  it('refuses a file whose bytes are not an accepted type, whatever its name', async () => {
    const result = await intake.submit(
      artifact(
        Buffer.from('<svg onload="alert(1)"/>').toString('base64'),
        'photo.jpg'
      )
    );
    expect(refusedOf(result).reasons[0]).toMatch(/not accepted/u);
  });

  it('refuses uploads while the scanner is unreachable', async () => {
    scanner.unavailable = true;
    const result = await intake.submit(artifact(PDF));
    expect(refusedOf(result).reasons[0]).toMatch(/cannot be checked/u);
    expect(await db.getRepository('ArtifactEntity').count()).toBe(0);
  });
});

describe('officials', () => {
  const apply = (
    who: Actor,
    email: string,
    name: string,
    emailVerified = true
  ) =>
    officials.apply({
      actor: who,
      email,
      emailVerified,
      name,
      localitySlug: 'town-ga',
    });

  it("verifies an address on the town's domain whose name is on its roster, then records the callback", async () => {
    const who = actor();
    const result = await apply(who, 'jdoe@town-ga.gov', 'jane q doe');
    expect(result.granted).toBe(true);
    expect(result.standing).toBe('submitting-official');
    expect(result.office).toBe('City Clerk');
    expect(
      (
        await officials.confirmCallback({
          userId: who.userId,
          localitySlug: 'town-ga',
          operator: 'op',
          note: "Called the clerk's office number on the contact page; confirmed.",
        })
      ).standing
    ).toBe('official-record');
    const events = (await db
      .getRepository('OfficialEventEntity')
      .find({ order: { id: 'ASC' } })) as { kind: string; by: string }[];
    expect(events.map((event) => event.kind)).toEqual([
      'domain-verified',
      'callback-confirmed',
    ]);
    expect(events[1]!.by).toBe('op');
  });

  it('marks what an official submits in their own town', async () => {
    const who = actor();
    await apply(who, 'jdoe@town-ga.gov', 'Jane Q. Doe');
    contributionOf(await intake.submit(request(who)));
    const row = (await db
      .getRepository('ContributionEntity')
      .findOneByOrFail({})) as { officialStanding: string | null };
    expect(row.officialStanding).toBe('submitting-official');
  });

  it('refuses another domain, a name off the roster, or an unverified address, and records why', async () => {
    expect(
      (await apply(actor(), 'jdoe@gmail.com', 'Jane Q. Doe')).granted
    ).toBe(false);
    expect(
      (await apply(actor(), 'someone@town-ga.gov', 'John Smith')).granted
    ).toBe(false);
    expect(
      (await apply(actor(), 'jdoe@town-ga.gov', 'Jane Q. Doe', false)).granted
    ).toBe(false);
    expect(
      await db.getRepository('OfficialEventEntity').countBy({ kind: 'refused' })
    ).toBe(3);
  });

  it('takes no callback for someone who has not passed the automatic check', async () => {
    const who = actor();
    await intake.contributor(who);
    await await expect(
      officials.confirmCallback({
        userId: who.userId,
        localitySlug: 'town-ga',
        operator: 'op',
        note: 'called',
      })
    ).rejects.toThrow(/automatic check/u);
  });
});

describe('copyright', () => {
  const notice = (ids: string[]) => ({
    claimantName: 'A Publisher',
    claimantEmail: 'legal@example.com',
    claimantAddress: '1 Main St',
    work: 'Our article',
    locations: ids.map((id) => `https://daylight.example/contributions/${id}`),
    goodFaith: true,
    accurateUnderPenalty: true,
    signature: 'A Publisher',
  });

  it('refuses a notice missing a statutory element', async () => {
    await await expect(
      copyright.file({
        ...notice(['00000000-0000-4000-8000-000000000000']),
        accurateUnderPenalty: false,
      })
    ).rejects.toThrow(/penalty of perjury/u);
  });

  it('takes down on an upheld notice, strikes, and suspends a repeat infringer', async () => {
    const who = actor();
    const first = contributionOf(await intake.submit(request(who)));
    const second = contributionOf(await intake.submit(request(who)));
    for (const view of [first, second]) {
      const filed = await copyright.file(notice([view.id]));
      await copyright.act({
        noticeId: filed.id,
        action: 'upheld',
        operator: 'op',
        note: 'copied',
      });
    }
    const [taken] = await intake.mine(who);
    expect(taken!.state).toBe('taken-down');
    const suspended = await intake.submit(request(who));
    expect(refusedOf(suspended).stage).toBe('suspension');
  });

  it("restores only after the contributor's own counter-notice, back into review", async () => {
    const who = actor();
    const view = contributionOf(await intake.submit(request(who)));
    const filed = await copyright.file(notice([view.id]));
    await copyright.act({
      noticeId: filed.id,
      action: 'upheld',
      operator: 'op',
      note: 'copied',
    });
    await await expect(
      copyright.act({
        noticeId: filed.id,
        action: 'restored',
        operator: 'op',
        note: 'no counter',
      })
    ).rejects.toThrow(/counter-notice/u);
    await await expect(
      copyright.counter({
        actor: actor(),
        noticeId: filed.id,
        contributionId: view.id,
        statement: 'mine',
        consentToJurisdiction: true,
        underPenalty: true,
        signature: 'x',
      })
    ).rejects.toThrow(/not one of your/u);
    await copyright.counter({
      actor: who,
      noticeId: filed.id,
      contributionId: view.id,
      statement: 'These are my own words.',
      consentToJurisdiction: true,
      underPenalty: true,
      signature: 'Resident',
    });
    await copyright.act({
      noticeId: filed.id,
      action: 'restored',
      operator: 'op',
      note: 'no suit filed',
    });
    const [restored] = await intake.mine(who);
    expect(restored!.state).toBe('held');
    expect(restored!.review.map((step) => step.stage).slice(-2)).toEqual([
      'takedown',
      'restoration',
    ]);
  });
});

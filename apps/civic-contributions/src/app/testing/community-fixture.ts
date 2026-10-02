import 'reflect-metadata';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ServiceUnavailableException,
  type INestApplicationContext,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  Actor,
  ContributionView,
  CorpusDocument,
  PrimaryRecord,
  SubjectOption,
  SubmitRequest,
  SubmitResult,
} from '@optimistic-tanuki/civic-community';
import { CivicBriefingCommands } from '@optimistic-tanuki/constants';
import {
  VirusScanService,
  VAULT_STORAGE_KEK_ENV,
} from '@optimistic-tanuki/storage';
import { of, throwError, type Observable } from 'rxjs';
import { DataSource } from 'typeorm';
import { createTestSchema } from '../../../../../libs/civic/core/test/db/helpers/postgres';
import loadConfig, {
  COMMUNITY_CONFIG,
  type CommunityConfig,
} from '../../config';
import { AppModule } from '../app.module';
import { ContributionsDatabaseModule } from '../contributions-database.module';
import { CopyrightService } from '../copyright.service';
import { CIVIC_BRIEFING_CLIENT, CorpusService } from '../corpus.service';
import { CorroborationService } from '../corroboration.service';
import { DensityService } from '../density.service';
import { COMMUNITY_ENTITIES } from '../entities';
import { IntakeService } from '../intake.service';
import { OfficialsService } from '../officials.service';
import { OutcomeService } from '../outcome.service';
import { PromotionService } from '../promotion.service';
import { PROMPT_PROXY_CLIENT, REVIEW_MODEL } from '../review-model';
import { SurfaceService } from '../surface.service';

/**
 * The service as it is wired in production (AppModule), over a Postgres
 * schema of its own and with its three outside dependencies faked: the
 * briefing service (the corpus, over TCP), the virus scanner, and the review
 * model. Nothing here touches the network.
 */

export const ARTICLE =
  'The Tifton City Council voted Monday night to hold the property tax millage rate at its current level for the coming fiscal year, ' +
  'after a public hearing in which several residents asked the council to consider relief for owners of older homes on fixed incomes. ' +
  'The city manager told the council the rate would pay for two additional firefighter positions and the resurfacing of several streets ' +
  'in the downtown district, work that has been delayed twice for lack of funds. Council members said they would revisit the question ' +
  'next spring when the county issues its revised tax digest and the state releases its figures for the rollback rate.';

/** civic-briefing's corpus views, answered from a small fixed corpus. */
export class FakeBriefing {
  unavailable = false;
  readonly sent: string[] = [];
  news: CorpusDocument[] = [
    {
      id: 'gazette:1',
      publisher: 'Tifton Gazette',
      title: 'Council holds millage rate',
      body: ARTICLE,
      url: 'https://gazette.example/millage',
    },
  ];
  subjectOptions: SubjectOption[] = [
    {
      kind: 'meeting',
      ref: '2',
      title: 'Agenda 09/14/2026',
      date: new Date().toISOString().slice(0, 10),
      url: null,
    },
    {
      kind: 'story',
      ref: '7',
      title: 'Millage rate',
      date: '2026-09-15',
      url: null,
    },
  ];
  private readonly topics: Record<string, string> = {
    'meeting:2': 'government',
    'story:7': 'local-reporting',
  };
  records: PrimaryRecord[] = [
    {
      kind: 'news',
      ref: 'civic:1',
      title: 'Council holds millage rate',
      excerpt: ARTICLE.slice(0, 1_200),
      date: '2026-09-15',
      url: 'https://gazette.example/millage',
      publisher: 'Tifton Gazette',
    },
    {
      kind: 'record',
      ref: 'civic:2',
      title: 'Agenda 09/14/2026',
      excerpt: 'agenda text',
      date: new Date().toISOString().slice(0, 10),
      url: null,
      publisher: 'Town of Tifton documents',
    },
  ];

  send<T>(pattern: { cmd: string }, payload: unknown): Observable<T> {
    this.sent.push(pattern.cmd);
    if (this.unavailable) {
      return throwError(() => new Error('civic-briefing is unreachable'));
    }
    const data = payload as {
      localitySlug?: string;
      day?: string;
      limit?: number;
      subject?: { kind: string; ref: string | null };
    };
    switch (pattern.cmd) {
      case CivicBriefingCommands.CORPUS_NEWS:
        return of(this.news as T);
      case CivicBriefingCommands.SUBJECTS:
        return of(
          (data.localitySlug === 'town-ga' ? this.subjectOptions : []) as T
        );
      case CivicBriefingCommands.TOPIC_FOR:
        return of(
          (this.topics[`${data.subject?.kind}:${data.subject?.ref}`] ??
            'government') as T
        );
      case CivicBriefingCommands.RECORDS_SINCE:
        return of(
          (data.localitySlug === 'town-ga'
            ? this.records.filter(
                (record) => (record.date ?? '') >= (data.day ?? '')
              )
            : []) as T
        );
      default:
        return throwError(() => new Error(`unexpected command ${pattern.cmd}`));
    }
  }

  close(): void {
    // nothing to close
  }
}

/** The platform scanner's interface, answered locally: EICAR is a threat, and it can be made unreachable. */
export class FakeScanner {
  unavailable = false;
  configured = true;
  readonly scanned: Buffer[] = [];

  isConfigured(): boolean {
    return this.configured;
  }

  async scanFile(content: Buffer) {
    if (this.unavailable) {
      throw new ServiceUnavailableException('ClamAV service is unavailable');
    }
    this.scanned.push(content);
    const infected = content.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE');
    return {
      isClean: !infected,
      scanDate: new Date(),
      ...(infected ? { threats: ['Eicar-Test-Signature'] } : {}),
      scanner: 'fake-clamav',
    };
  }
}

export class StandInModel {
  answers: Record<string, boolean> = {};
  unreachable = false;

  readonly provider = {
    name: 'stand-in',
    call: async (messages: { role: string; content: string }[]) => {
      if (this.unreachable) throw new Error('connection refused');
      // Which questions were asked decides which stand-in answers come back.
      const keys = messages[0]?.content.includes('one official record')
        ? ['sameMatter', 'supports', 'contradicts']
        : [
            'allegesWrongdoing',
            'namesPrivateIndividual',
            'concernsMinor',
            'personalAttack',
            'offTopic',
          ];
      return JSON.stringify(
        Object.fromEntries(
          keys.map((key) => [
            key,
            { answer: this.answers[key] ?? false, reason: 'stand-in' },
          ])
        )
      );
    },
  };

  reset(): void {
    this.answers = {};
    this.unreachable = false;
  }
}

export interface Harness {
  app: INestApplicationContext;
  db: DataSource;
  config: CommunityConfig;
  scratch: string;
  briefing: FakeBriefing;
  scanner: FakeScanner;
  model: StandInModel;
  intake: IntakeService;
  officials: OfficialsService;
  copyright: CopyrightService;
  surface: SurfaceService;
  outcomes: OutcomeService;
  promotion: PromotionService;
  density: DensityService;
  corroboration: CorroborationService;
  corpus: CorpusService;
  /** Empties every table, between tests. */
  reset(): Promise<void>;
  close(): Promise<void>;
}

function writeLocalities(scratch: string): string {
  const dir = join(scratch, 'localities');
  mkdirSync(dir, { recursive: true });
  const common =
    'timezone: America/New_York\nlat: 31\nlon: -83\ntopics: []\nsources: []\n';
  writeFileSync(
    join(dir, 'county.yaml'),
    `slug: county-ga\nname: County\nstate: GA\nkind: county\nparents: []\nedition: false\n${common}`
  );
  writeFileSync(
    join(dir, 'town.yaml'),
    `slug: town-ga\nname: Town\nstate: GA\nkind: town\nparents: [county-ga]\nedition: true\ncadence: [daily]\n${common}` +
      'officials:\n  domains: [town-ga.gov]\n  roster:\n    - { name: "Jane Q. Doe", office: City Clerk, source: "https://town-ga.gov/staff" }\n' +
      '  callbackNumberSource: https://town-ga.gov/contact\n'
  );
  return dir;
}

export async function createHarness(): Promise<Harness> {
  process.env[VAULT_STORAGE_KEK_ENV] = 'civic-contributions-spec-kek';
  const scratch = mkdtempSync(join(tmpdir(), 'civic-contributions-'));
  const config: CommunityConfig = {
    ...loadConfig({ ...process.env }),
    artifactRoot: join(scratch, 'artifacts'),
    localitiesDir: writeLocalities(scratch),
    promotionDirectory: join(scratch, 'promotions'),
    densityDirectory: join(scratch, 'density'),
    hourlyLimit: 5,
    strikeLimit: 2,
  };
  const briefing = new FakeBriefing();
  const scanner = new FakeScanner();
  const model = new StandInModel();
  // createTestDataSource(COMMUNITY_ENTITIES) in all but one respect: its
  // schema-pinned search_path hides uuid-ossp's uuid_generate_v4(), which
  // TypeORM defaults uuid keys to, so keys come from pgcrypto's
  // gen_random_uuid() (built in to Postgres 13+) instead.
  const db = new DataSource({
    type: 'postgres',
    url: (await createTestSchema()).url,
    entities: COMMUNITY_ENTITIES,
    synchronize: true,
    uuidExtension: 'pgcrypto',
  });
  await db.initialize();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideModule(ContributionsDatabaseModule)
    .useModule(ContributionsDatabaseModule.forDataSource(db))
    .overrideProvider(COMMUNITY_CONFIG)
    .useValue(config)
    .overrideProvider(CIVIC_BRIEFING_CLIENT)
    .useValue(briefing)
    .overrideProvider(PROMPT_PROXY_CLIENT)
    .useValue(null)
    .overrideProvider(REVIEW_MODEL)
    .useValue(model.provider)
    .overrideProvider(VirusScanService)
    .useValue(scanner)
    .compile();
  const app = await moduleRef.init();

  return {
    app,
    db,
    config,
    scratch,
    briefing,
    scanner,
    model,
    intake: app.get(IntakeService),
    officials: app.get(OfficialsService),
    copyright: app.get(CopyrightService),
    surface: app.get(SurfaceService),
    outcomes: app.get(OutcomeService),
    promotion: app.get(PromotionService),
    density: app.get(DensityService),
    corroboration: app.get(CorroborationService),
    corpus: app.get(CorpusService),
    async reset() {
      model.reset();
      scanner.unavailable = false;
      briefing.unavailable = false;
      for (const entity of [...COMMUNITY_ENTITIES].reverse()) {
        await db.getRepository(entity).clear();
      }
    },
    async close() {
      await app.close();
      if (db.isInitialized) await db.destroy();
      rmSync(scratch, { recursive: true, force: true });
    },
  };
}

let counter = 0;
export const actor = (
  roles?: readonly string[]
): Actor & { roles?: readonly string[] } => {
  counter += 1;
  const id = `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
  return {
    userId: id,
    profileId: id,
    handle: `resident ${counter}`,
    ...(roles ? { roles } : {}),
  };
};

export const request = (
  who: Actor,
  overrides: Partial<SubmitRequest> = {}
): SubmitRequest & { actor: Actor } => ({
  actor: who,
  localitySlug: 'town-ga',
  kind: 'account',
  subject: { kind: 'other', ref: null, text: 'Council meeting' },
  occurredOn: '2026-09-14',
  body: 'I was at the meeting. Three of us asked for relief for older homes, and the council kept the rate where it was.',
  links: [],
  disclosedInterest: null,
  representations: { witnessed: true, ownWords: true },
  attachment: null,
  idempotencyKey: null,
  origin: { network: `net-${who.userId}`, client: `dev-${who.userId}` },
  emailVerified: true,
  ...overrides,
});

export const contributionOf = (result: SubmitResult): ContributionView => {
  if (!('contribution' in result)) {
    throw new Error(`expected a contribution, got ${JSON.stringify(result)}`);
  }
  return result.contribution;
};

export const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n'
).toString('base64');

/** The refusal in a submit result, or a failure saying what came back instead. */
export const refusedOf = (
  result: SubmitResult
): { stage: string; reasons: string[] } => {
  if (!('refused' in result)) {
    throw new Error(`expected a refusal, got ${JSON.stringify(result)}`);
  }
  return result.refused;
};

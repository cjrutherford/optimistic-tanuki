import { readFileSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import 'reflect-metadata';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { of } from 'rxjs';
import loadDatabase from './loadDatabase';
import { AccountExportOwnerSpoolService } from '@optimistic-tanuki/storage';
import {
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
} from '@optimistic-tanuki/models';
import { AuthCommands } from '@optimistic-tanuki/constants';
import {
  SocialAccountExportOwnerService,
  SocialAccountExportSource,
} from './account-export-owner.service';
import {
  SOCIAL_AUTHORED_SOURCES,
  createAuthoredSources,
} from './account-export-authored.sources';
import {
  PERSONAL_SOURCES,
  createPersonalSources,
} from './account-export-personal.sources';
import {
  COMMUNITY_SOURCES,
  createCommunitySources,
} from './account-export-community.sources';
import {
  SAFETY_SOURCES,
  createSafetySources,
} from './account-export-safety.sources';

const marker = 'private-social-owner-capture-j24-v1';
const DB = 'social_owner_capture_j24_fixture';
const HOST = '127.0.0.1';
const PORT = '15553';
const USER = 'social_owner_capture_fixture';
const optedIn = process.env.SOCIAL_OWNER_CAPTURE_J24_MARKER === marker;
if (process.env.SOCIAL_OWNER_CAPTURE_J24_MARKER !== undefined && !optedIn)
  throw new Error('Invalid J24 owner-capture fixture marker');
const describePrivate = optedIn ? describe : describe.skip;
const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const OTHER_ACCOUNT = '22222222-2222-4222-8222-222222222222';
const PROFILE = '33333333-3333-4333-8333-333333333333';
const OTHER_PROFILE = '44444444-4444-4444-8444-444444444444';
const ids = {
  ownPost: randomUUID(),
  foreignPost: randomUUID(),
  mismatchPost: randomUUID(),
  ownComment: randomUUID(),
  ownCommentForeignParent: randomUUID(),
  foreignComment: randomUUID(),
  mismatchComment: randomUUID(),
  ownReaction: randomUUID(),
  ownReactionForeignParent: randomUUID(),
  foreignReaction: randomUUID(),
  ownVote: randomUUID(),
  ownVoteForeignParent: randomUUID(),
  foreignVote: randomUUID(),
  ownAttachment: randomUUID(),
  foreignAttachment: randomUUID(),
  ownPoll: randomUUID(),
  foreignPoll: randomUUID(),
  ownComponent: randomUUID(),
  foreignComponent: randomUUID(),
  ownShare: randomUUID(),
  foreignShare: randomUUID(),
  malformedPost: randomUUID(),
  ownEvent: randomUUID(),
  foreignEvent: randomUUID(),
  mismatchEvent: randomUUID(),
  ownLink: 880001,
  foreignLink: 880002,
  standaloneLink: 880003,
};
const fixture = {
  host: HOST,
  port: Number(PORT),
  username: USER,
  password: 'synthetic-j24-only',
  database: DB,
};
const grant: AccountExportCaptureGrant = {
  accountId: ACCOUNT,
  appId: 'social',
  token: 'synthetic-j24-lease',
  jobId: randomUUID(),
  attempt: 1,
  leaseOwner: randomUUID(),
};
const descriptor: AccountExportSnapshotDescriptor = {
  handleId: randomUUID(),
  participantId: 'profile',
  accountId: ACCOUNT,
  captureId: randomUUID(),
  snapshotAt: '2026-10-20T12:00:00.000Z',
  sizeBytes: 1,
  sha256: 'a'.repeat(64),
  rowCount: 1,
  sources: ['profileIdentity'],
  sourceRowCounts: { profileIdentity: 1 },
  sourceDispositions: { profileIdentity: 'retained' },
  identityCount: 1,
  expiresAt: '2099-01-01T00:00:00.000Z',
};

describePrivate('J24 Social owner capture against migrated PostgreSQL', () => {
  jest.setTimeout(60_000);
  let writer: DataSource;
  let reader: DataSource;
  let owner: SocialAccountExportOwnerService;
  let seeded = false;
  const spoolRoot = `/tmp/social-owner-capture-j24-${randomUUID()}`;
  const auth = {
    send: jest.fn((pattern: { cmd: string }) => {
      if (pattern.cmd !== AuthCommands.ValidateAccountExportLease)
        throw new Error('unexpected Auth command');
      return of({ valid: true });
    }),
  };
  const identities = {
    readIdentities: jest.fn(
      async (
        _g: unknown,
        _d: unknown,
        receive: (ids: readonly string[]) => Promise<void>
      ) => {
        await receive([PROFILE]);
        return {
          accountId: ACCOUNT,
          handleId: descriptor.handleId,
          captureId: descriptor.captureId,
          snapshotAt: descriptor.snapshotAt,
          identityCount: 1,
        };
      }
    ),
  };

  async function counts(db: DataSource): Promise<Record<string, string>> {
    const tables: Array<{ table_name: string }> = await db.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`
    );
    const result: Record<string, string> = {};
    for (const { table_name } of tables) {
      const safe = table_name.replace(/"/g, '""');
      result[table_name] = (
        await db.query(`SELECT count(*)::text AS count FROM public."${safe}"`)
      )[0].count;
    }
    return result;
  }

  async function capture(
    onChunk?: (chunk: any) => Promise<void>,
    signal?: AbortSignal,
    sources?: (profileTable: string) => any[],
    sourceNames: readonly string[] = SOCIAL_AUTHORED_SOURCES
  ) {
    return new AccountExportOwnerSpoolService().capture(
      {
        participantId: 'social',
        accountId: ACCOUNT,
        sources: sourceNames as readonly SocialAccountExportSource[],
        spoolRoot,
        signal,
      },
      (sink, combined) =>
        owner
          .captureAccount({
            grant,
            profileSnapshot: descriptor,
            signal: combined,
            sources: (table) =>
              (sources ?? createAuthoredSources)(table).map((source) => ({
                ...source,
                project: (row, accountId) => {
                  try {
                    return source.project(row, accountId);
                  } catch (error) {
                    // Names and primitive types only: never print captured account data.
                    console.error(
                      'J24_PROJECTOR_FAILURE',
                      source.source,
                      Object.fromEntries(
                        Object.entries(row).map(([key, value]) => [
                          key,
                          value === null ? 'null' : typeof value,
                        ])
                      )
                    );
                    throw error;
                  }
                },
              })),
            onChunk: async (chunk) => {
              await onChunk?.(chunk);
              await sink(chunk);
            },
          })
          .catch((error) => {
            console.error('J24_OWNER_FAILURE', error?.code ?? 'unknown');
            throw error;
          })
    );
  }

  beforeAll(async () => {
    if (process.env.POSTGRES_HOST !== HOST || process.env.POSTGRES_DB !== DB)
      throw new Error('Wrong J24 database overrides');
    const password = process.env.SOCIAL_OWNER_CAPTURE_PG_PASSWORD;
    if (!password || password !== fixture.password)
      throw new Error('Missing or invalid synthetic J24 password');
    const options = loadDatabase({ get: () => fixture } as any);
    writer = new DataSource({
      ...options,
      type: 'postgres',
      ...fixture,
      migrations: [],
      migrationsRun: false,
      synchronize: false,
      logging: false,
    } as any);
    reader = new DataSource({
      ...options,
      type: 'postgres',
      ...fixture,
      migrations: [],
      migrationsRun: false,
      synchronize: false,
      logging: false,
      extra: { ...(options.extra ?? {}), max: 3 },
    } as any);
    await writer.initialize();
    await reader.initialize();
    expect(
      (await writer.query('SELECT current_database() AS name'))[0].name
    ).toBe(DB);
    expect(
      Number((await writer.query('SELECT count(*) FROM migrations'))[0].count)
    ).toBeGreaterThan(0);
    const makeRunner = reader.createQueryRunner.bind(reader);
    reader.createQueryRunner = (...args) => {
      const runner = makeRunner(...args);
      const query = runner.query.bind(runner);
      runner.query = async (...queryArgs) => {
        try {
          return await query(...queryArgs);
        } catch (error) {
          const failure = error as { code?: string; message?: string };
          console.error(
            'J24_QUERY_FAILURE',
            failure.code,
            failure.code?.startsWith('42')
              ? failure.message
              : 'values-redacted',
            queryArgs[0]
          );
          throw error;
        }
      };
      return runner;
    };
    owner = new SocialAccountExportOwnerService(
      reader,
      identities as any,
      auth as any
    );
    await seed();
  });

  async function seed() {
    seeded = true;
    const post = async (
      id: string,
      userId: string,
      profileId: string,
      text: string
    ) =>
      writer.query(
        `INSERT INTO post(id,title,content,"profileId","userId","appScope",visibility,"publicAudienceExplicit") VALUES($1,$2,$3,$4,$5,'social','public',true)`,
        [id, text, text, profileId, userId]
      );
    await post(
      ids.ownPost,
      ACCOUNT,
      PROFILE.toUpperCase(),
      'J24 own authored post'
    );
    await post(
      ids.foreignPost,
      OTHER_ACCOUNT,
      OTHER_PROFILE,
      'J24 private foreign counterpart payload'
    );
    await post(
      ids.mismatchPost,
      ACCOUNT,
      OTHER_PROFILE,
      'J24 selector mismatch post'
    );
    await writer.query(
      `INSERT INTO comment(id,content,"userId","profileId","postId","appScope") VALUES
      ($1,'J24 own comment',$2,$3,$4,'social'),($5,'J24 owned comment on foreign parent',$2,$3,$6,'social'),($7,'J24 foreign comment',$8,$9,$4,'social'),($10,'J24 profile mismatch comment',$2,$11,$4,'social')`,
      [
        ids.ownComment,
        ACCOUNT,
        PROFILE,
        ids.ownPost,
        ids.ownCommentForeignParent,
        ids.foreignPost,
        ids.foreignComment,
        OTHER_ACCOUNT,
        OTHER_PROFILE,
        ids.mismatchComment,
        OTHER_PROFILE,
      ]
    );
    await writer.query(
      `INSERT INTO reaction(id,value,"userId","profileId","postId","appScope") VALUES
      ($1,1,$2,$3,$4,'social'),($5,2,$2,$3,$6,'social'),($7,3,$8,$9,$4,'social')`,
      [
        ids.ownReaction,
        ACCOUNT,
        PROFILE,
        ids.ownPost,
        ids.ownReactionForeignParent,
        ids.foreignPost,
        ids.foreignReaction,
        OTHER_ACCOUNT,
        OTHER_PROFILE,
      ]
    );
    await writer.query(
      `INSERT INTO vote(id,value,"userId","profileId","postId","appScope") VALUES
      (880101,1,$1,$2,$3,'social'),(880102,2,$1,$2,$4,'social'),(880103,3,$5,$6,$3,'social')`,
      [
        ACCOUNT,
        PROFILE,
        ids.ownPost,
        ids.foreignPost,
        OTHER_ACCOUNT,
        OTHER_PROFILE,
      ]
    );
    await writer.query(
      `INSERT INTO attachment(id,name,"filePath",type,"appScope","postId") VALUES
      ($1,'J24 safe URL asset','https://assets.example.invalid/opaque/J24-token','IMAGE','social',$2),($3,'J24 foreign attachment','https://assets.example.invalid/opaque/foreign','IMAGE','social',$4)`,
      [ids.ownAttachment, ids.ownPost, ids.foreignAttachment, ids.foreignPost]
    );
    await writer.query(
      `INSERT INTO poll(id,question,options,votes,"isMultipleChoice","profileId","userId") VALUES
      ($1,'J24 own poll','A,B','secret-voter-id',false,$2,$3),($4,'J24 foreign poll','X','foreign-vote-id',false,$5,$6)`,
      [
        ids.ownPoll,
        PROFILE,
        ACCOUNT,
        ids.foreignPoll,
        OTHER_PROFILE,
        OTHER_ACCOUNT,
      ]
    );
    await writer.query(
      `INSERT INTO social_components(id,"postId","instanceId","componentType","componentData",position) VALUES
      ($1,$2,'j24-own','text','{"payload":"J24 component data must not export"}',0),($3,$4,'j24-foreign','text','{"payload":"J24 foreign component"}',0)`,
      [ids.ownComponent, ids.ownPost, ids.foreignComponent, ids.foreignPost]
    );
    await writer.query(
      `INSERT INTO link(id,url,"appScope") VALUES($1,'https://assets.example.invalid/opaque/link','social'),($2,'https://counterpart.example.invalid/J24-secret','social'),($3,'https://standalone.example.invalid/J24-standalone','social')`,
      [ids.ownLink, ids.foreignLink, ids.standaloneLink]
    );
    await writer.query(
      `INSERT INTO post_link("postId","linkId") VALUES($1,$2),($3,$4)`,
      [ids.ownPost, ids.ownLink, ids.foreignPost, ids.foreignLink]
    );
    await writer.query(
      `INSERT INTO post_share(id,"originalPostId","sharedById",comment,visibility) VALUES($1,$2,$3,'J24 own share note','public'),($4,$5,$6,'J24 foreign share note','public')`,
      [
        ids.ownShare,
        ids.foreignPost,
        PROFILE,
        ids.foreignShare,
        ids.ownPost,
        OTHER_PROFILE,
      ]
    );
    await writer.query(
      `INSERT INTO event(id,title,description,"startDate","profileId","userId",status,privacy,"locationUrl","coverImageUrl") VALUES
      ($1,'J24 own event','J24 event description','2026-10-20',$2,$3,'draft','public','https://events.example.invalid/opaque','https://assets.example.invalid/opaque/cover'),($4,'J24 foreign event','foreign payload','2026-10-20',$5,$6,'draft','public',NULL,NULL),($7,'J24 mismatch event','mismatch payload','2026-10-20',$5,$3,'draft','public',NULL,NULL)`,
      [
        ids.ownEvent,
        PROFILE,
        ACCOUNT,
        ids.foreignEvent,
        OTHER_PROFILE,
        OTHER_ACCOUNT,
        ids.mismatchEvent,
      ]
    );
    seeded = true;
  }

  async function cleanup() {
    if (!writer?.isInitialized || !seeded) return;
    await writer.query(
      'DELETE FROM post_link WHERE "postId" = ANY($1::uuid[]) OR "linkId" = ANY($2::int[])',
      [
        [ids.ownPost, ids.foreignPost, ids.mismatchPost],
        [ids.ownLink, ids.foreignLink, ids.standaloneLink],
      ]
    );
    await writer.query('DELETE FROM attachment WHERE id=ANY($1::uuid[])', [
      [ids.ownAttachment, ids.foreignAttachment],
    ]);
    await writer.query(
      'DELETE FROM social_components WHERE id=ANY($1::uuid[])',
      [[ids.ownComponent, ids.foreignComponent]]
    );
    await writer.query('DELETE FROM poll WHERE id=ANY($1::uuid[])', [
      [ids.ownPoll, ids.foreignPoll],
    ]);
    await writer.query('DELETE FROM reaction WHERE id=ANY($1::uuid[])', [
      [ids.ownReaction, ids.ownReactionForeignParent, ids.foreignReaction],
    ]);
    await writer.query('DELETE FROM vote WHERE id=ANY($1::int[])', [
      [880101, 880102, 880103],
    ]);
    await writer.query('DELETE FROM comment WHERE id=ANY($1::uuid[])', [
      [
        ids.ownComment,
        ids.ownCommentForeignParent,
        ids.foreignComment,
        ids.mismatchComment,
      ],
    ]);
    await writer.query('DELETE FROM post_share WHERE id=ANY($1::uuid[])', [
      [ids.ownShare, ids.foreignShare],
    ]);
    await writer.query('DELETE FROM event WHERE id=ANY($1::uuid[])', [
      [ids.ownEvent, ids.foreignEvent, ids.mismatchEvent],
    ]);
    await writer.query('DELETE FROM post WHERE id=ANY($1::uuid[])', [
      [ids.ownPost, ids.foreignPost, ids.mismatchPost],
    ]);
    await writer.query('DELETE FROM link WHERE id=ANY($1::int[])', [
      [ids.ownLink, ids.foreignLink, ids.standaloneLink],
    ]);
    seeded = false;
  }

  afterAll(async () => {
    try {
      await cleanup();
    } finally {
      if (reader?.isInitialized) await reader.destroy();
      if (writer?.isInitialized) await writer.destroy();

      await rm(spoolRoot, { recursive: true, force: true });
    }
  });

  it('captures only account and profile scoped authored rows through bounded real PostgreSQL reads', async () => {
    const baselinePath = process.env.SOCIAL_OWNER_CAPTURE_BASELINE_COUNTS;
    if (!baselinePath) throw new Error('Missing private baseline counts');
    const expected = JSON.parse(readFileSync(baselinePath, 'utf8'));
    const handle = await capture();
    try {
      const chunks: any[] = [];
      const allBytes: Buffer[] = [];
      for await (const chunk of handle.createReadStream())
        allBytes.push(Buffer.from(chunk));
      chunks.push(
        ...Buffer.concat(allBytes)
          .toString('utf8')
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line))
      );
      const records = chunks.flatMap((chunk) => chunk.records ?? []);
      expect(handle.metadata.rowCount).toBeGreaterThan(0);
      expect(chunks.at(-1)?.source).toBe('end');
      expect(chunks.at(-1)?.complete).toBe(true);
      expect(records.length).toBe(handle.metadata.rowCount);
      expect(handle.metadata.sourceRowCounts).toEqual(
        expect.objectContaining({
          Post: 1,
          Comment: 2,
          Reaction: 2,
          Vote: 2,
          Attachment: 1,
          Poll: 1,
          SocialComponent: 1,
          Link: 1,
          PostShare: 1,
          Event: 1,
        })
      );
      const text = JSON.stringify(chunks);
      for (const forbidden of [
        'J24 private foreign counterpart payload',
        'J24 selector mismatch post',
        'J24 foreign comment',
        'J24 profile mismatch comment',
        'J24 foreign attachment',
        'J24 foreign poll',
        'foreign-vote-id',
        'J24 foreign component',
        'J24 foreign share note',
        'J24 foreign event',
        'J24 mismatch event',
        'J24-secret',
        'J24-standalone',
        'filePath',
        'componentData',
        'votes',
        'attendeeIds',
        'attendeeCount',
      ])
        expect(text).not.toContain(forbidden);
      expect(text).toContain('J24 own authored post');
      expect(text).toContain('J24 owned comment on foreign parent');
      expect(auth.send).toHaveBeenCalled();
      expect(identities.readIdentities).toHaveBeenCalled();
      const post = records.find(
        (r) => r.source === 'Post' && r.data?.id === ids.ownPost
      );
      expect(post).toBeDefined();
      const report = {
        result: 'PASS',
        readOnlyPostgresCapture: true,
        authoredSources: SOCIAL_AUTHORED_SOURCES,
        projectedCounts: handle.metadata.sourceRowCounts,
        checksumVerified: true,
        terminalChunkVerified: true,
        attachmentAndLinkAssociationViaOwnedPost: true,
        rawStorageComponentPollAndAttendeeDataExcluded: true,
        authAndProfile:
          'controlled capability mocks; no live Auth/Profile RPC exercised',
        opaqueAssetUrlOwnership: 'not asserted',
      };
      const reportPath = process.env.SOCIAL_OWNER_CAPTURE_REPORT_PATH;
      if (!reportPath) throw new Error('Missing J24 report path');
      writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    } finally {
      await handle.cleanup();
    }
    await cleanup();
    expect(await counts(writer)).toEqual(expected);
    expect(
      (
        await reader.query(
          "SELECT count(*)::int AS n FROM pg_class WHERE relpersistence='t'"
        )
      )[0].n
    ).toBe(0);
  });

  it('executes all 23 Personal, Community and Safety owner queries against migrated PostgreSQL', async () => {
    const suites = [
      { names: PERSONAL_SOURCES, factory: createPersonalSources },
      { names: COMMUNITY_SOURCES, factory: createCommunitySources },
      { names: SAFETY_SOURCES, factory: createSafetySources },
    ];
    for (const suite of suites) {
      const handle = await capture(
        undefined,
        undefined,
        suite.factory,
        suite.names
      );
      try {
        expect(handle.metadata.sourceRowCounts).toEqual(
          Object.fromEntries(suite.names.map((name) => [name, 0]))
        );
        expect(handle.metadata.rowCount).toBe(0);
      } finally {
        await handle.cleanup();
      }
    }
    expect(
      (
        await reader.query(
          "SELECT count(*)::int AS n FROM pg_class WHERE relpersistence='t'"
        )
      )[0].n
    ).toBe(0);
    const reportPath = process.env.SOCIAL_OWNER_CAPTURE_REPORT_PATH;
    if (!reportPath) throw new Error('Missing J24 report path');
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    report.additionalSchemaQueryCoverage = suites.map((suite) => ({
      sourceCount: suite.names.length,
      sources: suite.names,
      rows: 0,
      evidence:
        'Each owner SQL query executed against migrated PostgreSQL with an empty source table; schema/query coverage only, not seeded behavioral acceptance.',
    }));
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  });

  it('rejects abort, consumer failure and malformed source rows without issuing terminal success', async () => {
    const assertNoTerminal = async (
      operation: (seen: any[]) => Promise<any>
    ) => {
      const seen: any[] = [];
      await expect(operation(seen)).rejects.toBeDefined();
      expect(
        seen.some((chunk) => chunk?.complete === true || chunk?.type === 'end')
      ).toBe(false);
    };
    const aborter = new AbortController();
    await assertNoTerminal((seen) =>
      capture(async (chunk) => {
        seen.push(chunk);
        aborter.abort();
      }, aborter.signal)
    );
    await assertNoTerminal((seen) =>
      capture(async (chunk) => {
        seen.push(chunk);
        throw new Error('consumer failed');
      })
    );
    await writer.query(
      `INSERT INTO post(id,title,content,"profileId","userId","appScope") VALUES($1,$2,'oversized fixture body',$3,$4,'social')`,
      [ids.malformedPost, 'x'.repeat(66_000), PROFILE, ACCOUNT]
    );
    try {
      await assertNoTerminal((seen) =>
        capture(async (chunk) => {
          seen.push(chunk);
        })
      );
    } finally {
      await writer.query('DELETE FROM post WHERE id=$1', [ids.malformedPost]);
    }
    expect(
      (
        await reader.query(
          "SELECT count(*)::int AS n FROM pg_class WHERE relpersistence='t'"
        )
      )[0].n
    ).toBe(0);
  });
});

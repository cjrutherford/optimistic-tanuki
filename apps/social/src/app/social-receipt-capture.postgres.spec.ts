import { readFileSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import 'reflect-metadata';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
import { randomUUID } from 'node:crypto';
import { DataSource, EntityMetadata, QueryRunner } from 'typeorm';
import { of } from 'rxjs';
import { AuthCommands } from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
} from '@optimistic-tanuki/models';
import { AccountExportOwnerSpoolService } from '@optimistic-tanuki/storage';
import loadDatabase from './loadDatabase';
import { SocialAccountExportOwnerService } from './account-export-owner.service';
import { SocialCaptureSource } from './account-export-authored.sources';
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

const MARKER = 'private-social-owner-capture-j24-v1';
const DB = 'social_owner_capture_j24_fixture';
const HOST = '127.0.0.1';
const PORT = 15553;
const USER = 'social_owner_capture_fixture';
const fixture = {
  host: HOST,
  port: PORT,
  username: USER,
  password: 'synthetic-j24-only',
  database: DB,
};
const optedIn = process.env.SOCIAL_OWNER_CAPTURE_J24_MARKER === MARKER;
if (process.env.SOCIAL_OWNER_CAPTURE_J24_MARKER !== undefined && !optedIn)
  throw new Error('Invalid J24 receipt fixture marker');
const describePrivate = optedIn ? describe : describe.skip;
const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const FOREIGN_ACCOUNT = '22222222-2222-4222-8222-222222222222';
const PROFILE = '33333333-3333-4333-8333-333333333333';
const FOREIGN_PROFILE = '44444444-4444-4444-8444-444444444444';
const CREATED = '2026-10-21 12:00:00';
const PRIVATE = 'J24_PRIVATE_RECEIPT_PAYLOAD';

type Group = 'Personal' | 'Community' | 'Safety';
type RowIds = Record<string, string[]>;

const sourceGroups = {
  Personal: { names: PERSONAL_SOURCES, factory: createPersonalSources },
  Community: { names: COMMUNITY_SOURCES, factory: createCommunitySources },
  Safety: { names: SAFETY_SOURCES, factory: createSafetySources },
} as const;

describePrivate(
  'J24 seeded Personal, Community and Safety receipts against migrated PostgreSQL',
  () => {
    jest.setTimeout(60_000);
    let writer: DataSource;
    let reader: DataSource;
    let owner: SocialAccountExportOwnerService;
    let baseline: Record<string, string>;
    let inserted: RowIds = {};
    let stageRows: Record<Group, Record<string, number>> = {
      Personal: {},
      Community: {},
      Safety: {},
    };
    let cleanupProof: Record<Group, boolean> = {
      Personal: false,
      Community: false,
      Safety: false,
    };
    const passedGroups = new Set<Group>();
    let currentGroup: Group | undefined;
    let ownedBusinessPaymentRef = '';
    let ownedSponsorshipPaymentRef = '';
    let selectedOpaqueCandidateRef = '';
    const spoolRoot = `/tmp/social-receipt-capture-j24-${randomUUID()}`;
    const grant: AccountExportCaptureGrant = {
      accountId: ACCOUNT,
      appId: 'social',
      token: 'synthetic-j24-receipt-lease',
      jobId: randomUUID(),
      attempt: 1,
      leaseOwner: randomUUID(),
    };
    const descriptor: AccountExportSnapshotDescriptor = {
      handleId: randomUUID(),
      participantId: 'profile',
      accountId: ACCOUNT,
      captureId: randomUUID(),
      snapshotAt: '2026-10-21T12:00:00.000Z',
      sizeBytes: 1,
      sha256: 'b'.repeat(64),
      rowCount: 1,
      sources: ['profileIdentity'],
      sourceRowCounts: { profileIdentity: 1 },
      sourceDispositions: { profileIdentity: 'retained' },
      identityCount: 1,
      expiresAt: '2099-01-01T00:00:00.000Z',
    };
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
          _grant: unknown,
          _snapshot: unknown,
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

    beforeAll(async () => {
      if (process.env.POSTGRES_HOST !== HOST || process.env.POSTGRES_DB !== DB)
        throw new Error('Wrong J24 receipt database overrides');
      if (
        process.env.SOCIAL_OWNER_CAPTURE_PG_HOST !== HOST ||
        process.env.SOCIAL_OWNER_CAPTURE_PG_PORT !== String(PORT) ||
        process.env.SOCIAL_OWNER_CAPTURE_PG_DATABASE !== DB ||
        process.env.SOCIAL_OWNER_CAPTURE_PG_USER !== USER ||
        process.env.SOCIAL_OWNER_CAPTURE_PG_PASSWORD !== fixture.password
      )
        throw new Error('Wrong J24 receipt PostgreSQL capability');
      const baselinePath = process.env.SOCIAL_OWNER_CAPTURE_BASELINE_COUNTS;
      if (!baselinePath) throw new Error('Missing J24 baseline table counts');
      baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
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
      expect(await tableCounts(writer)).toEqual(baseline);
      owner = new SocialAccountExportOwnerService(
        reader,
        identities as any,
        auth as any
      );
      const reportPath = process.env.SOCIAL_RECEIPT_CAPTURE_REPORT_PATH;
      if (!reportPath) throw new Error('Missing J24 receipt report path');
      writeFileSync(
        reportPath,
        JSON.stringify(
          { result: 'RUNNING', scope: 'seeded B/C/D source acceptance' },
          null,
          2
        ) + '\n'
      );
    });

    async function tableCounts(
      db: DataSource
    ): Promise<Record<string, string>> {
      const tables: Array<{ table_name: string }> = await db.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`
      );
      const counts: Record<string, string> = {};
      for (const { table_name } of tables) {
        const safe = table_name.replace(/"/g, '""');
        counts[table_name] = (
          await db.query(`SELECT count(*)::text AS count FROM public."${safe}"`)
        )[0].count;
      }
      return counts;
    }

    function metadata(table: string): EntityMetadata {
      const found = writer.entityMetadatas.find(
        (entry) => entry.tableName === table
      );
      if (!found)
        throw new Error(`No migrated Social entity metadata for ${table}`);
      return found;
    }

    function scalarValue(
      column: EntityMetadata['columns'][number],
      tag: string
    ): unknown {
      const type =
        typeof column.type === 'string'
          ? column.type.toLowerCase()
          : (column.type as any)?.name?.toLowerCase?.() ?? '';
      const enumValues = column.enum ?? (column as any).enumValues;
      if (Array.isArray(enumValues) && enumValues.length) return enumValues[0];
      if (type === 'uuid') return randomUUID();
      if (type.includes('bool')) return false;
      if (
        type === 'number' ||
        type.includes('int') ||
        type.includes('numeric') ||
        type.includes('decimal') ||
        type.includes('float')
      )
        return 1;
      if (type.includes('timestamp') || type === 'date' || type === 'time')
        return CREATED;
      if (type.includes('json'))
        return type === 'simple-json'
          ? JSON.stringify({ privateMarker: tag })
          : { privateMarker: tag };
      if (type.includes('array')) return 'J24';
      if (type === 'bytea') return Buffer.from('J24');
      if (column.length && column.length < tag.length)
        return 'x'.repeat(Math.max(1, column.length));
      return tag
        .replace('J24_PRIVATE_RECEIPT_PAYLOAD', 'J24_SAFE')
        .slice(0, 80);
    }

    async function insert(
      runner: QueryRunner,
      table: string,
      values: Record<string, unknown>
    ): Promise<string> {
      const entity = metadata(table);
      const id = typeof values.id === 'string' ? values.id : randomUUID();
      const overrides = { ...values, id };
      const payload: Record<string, unknown> = {};
      for (const column of entity.columns) {
        const prop = column.propertyName;
        if (Object.prototype.hasOwnProperty.call(overrides, prop)) {
          payload[column.databaseName] = overrides[prop];
        } else if (
          column.isGenerated ||
          column.isNullable ||
          column.default !== undefined
        ) {
          continue;
        } else {
          payload[column.databaseName] = scalarValue(
            column,
            `J24_${id.slice(0, 8)}_${prop}`
          );
        }
      }
      const columns = Object.keys(payload);
      const names = columns
        .map((name) => `"${name.replace(/"/g, '""')}"`)
        .join(',');
      const binds = columns.map((_, index) => `$${index + 1}`).join(',');
      await runner.query(
        `INSERT INTO "${table.replace(
          /"/g,
          '""'
        )}" (${names}) VALUES (${binds})`,
        columns.map((name) => payload[name])
      );
      (inserted[table] ??= []).push(id);
      return id;
    }

    async function inTransaction<T>(
      work: (runner: QueryRunner) => Promise<T>
    ): Promise<T> {
      const runner = writer.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        const value = await work(runner);
        await runner.commitTransaction();
        return value;
      } catch (error) {
        try {
          await runner.rollbackTransaction();
        } catch {
          /* preserve seed failure */
        }
        throw error;
      } finally {
        await runner.release();
      }
    }

    async function cleanup(): Promise<void> {
      if (!writer?.isInitialized) return;
      const rows = inserted;
      inserted = {};
      await inTransaction(async (runner) => {
        for (const [table, ids] of Object.entries(rows)) {
          if (!ids.length) continue;
          await runner.query(
            `DELETE FROM "${table.replace(
              /"/g,
              '""'
            )}" WHERE "id" = ANY($1::uuid[])`,
            [ids]
          );
        }
      });
    }

    async function capture(group: Group): Promise<{
      handle: Awaited<ReturnType<AccountExportOwnerSpoolService['capture']>>;
      chunks: any[];
      records: any[];
    }> {
      const suite = sourceGroups[group];
      const names = suite.names as readonly string[];
      const handle = await new AccountExportOwnerSpoolService().capture(
        {
          participantId: 'social',
          accountId: ACCOUNT,
          sources: names,
          spoolRoot,
        },
        (sink, signal) =>
          owner.captureAccount({
            grant,
            profileSnapshot: descriptor,
            signal,
            sources: suite.factory,
            onChunk: sink,
          })
      );
      try {
        const parts: Buffer[] = [];
        for await (const part of handle.createReadStream())
          parts.push(Buffer.from(part));
        const chunks = Buffer.concat(parts)
          .toString('utf8')
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line));
        const records = chunks.flatMap((chunk) => chunk.records ?? []);
        expect(chunks.at(-1)?.source).toBe('end');
        expect(chunks.at(-1)?.complete).toBe(true);
        expect(records.length).toBe(handle.metadata.rowCount);
        return { handle, chunks, records };
      } catch (error) {
        await handle.cleanup();
        throw error;
      }
    }

    function expectCounts(
      group: Group,
      handle: { metadata: { sourceRowCounts: Record<string, number> } },
      expected: Record<string, number>
    ): void {
      const names = sourceGroups[group].names;
      expect(handle.metadata.sourceRowCounts).toEqual(
        Object.fromEntries(names.map((name) => [name, expected[name] ?? 0]))
      );
    }

    async function writeReport(): Promise<void> {
      const reportPath = process.env.SOCIAL_RECEIPT_CAPTURE_REPORT_PATH;
      if (!reportPath) throw new Error('Missing J24 receipt report path');
      const result = Object.values(cleanupProof).every(Boolean)
        ? 'PASS'
        : 'RUNNING';
      writeFileSync(
        reportPath,
        JSON.stringify(
          {
            result,
            sourceRowCounts: stageRows,
            cleanupProof,
            authAndProfile:
              'Controlled lease and Profile capability mocks; no live Auth/Profile RPC exercised.',
            provenance:
              'All legacy attribution is recorded-unverified; consent is not inferred.',
          },
          null,
          2
        ) + '\n'
      );
    }

    afterEach(async () => {
      await cleanup();
      if (writer?.isInitialized)
        expect(await tableCounts(writer)).toEqual(baseline);
      if (reader?.isInitialized)
        expect(
          (
            await reader.query(
              `SELECT count(*)::int AS n FROM pg_class WHERE relpersistence='t'`
            )
          )[0].n
        ).toBe(0);
      if (currentGroup && passedGroups.delete(currentGroup))
        cleanupProof[currentGroup] = true;
      currentGroup = undefined;
      await writeReport();
    });

    afterAll(async () => {
      try {
        await cleanup();
        if (writer?.isInitialized)
          expect(await tableCounts(writer)).toEqual(baseline);
        if (reader?.isInitialized) await reader.destroy();
        if (writer?.isInitialized) await writer.destroy();

        await rm(spoolRoot, { recursive: true, force: true });
        await writeReport();
      } finally {
        if (reader?.isInitialized) await reader.destroy();
        if (writer?.isInitialized) await writer.destroy();
      }
    });

    async function remember(
      runner: QueryRunner,
      source: string,
      table: string,
      mode: 'owned' | 'foreign',
      values: Record<string, unknown>,
      ownership: Record<string, { owned: string[]; foreign: string[] }>
    ): Promise<string> {
      const id = await insert(runner, table, values);
      const pair = (ownership[source] ??= { owned: [], foreign: [] });
      pair[mode].push(id);
      return id;
    }

    async function seedPersonal(): Promise<
      Record<string, { owned: string[]; foreign: string[] }>
    > {
      const result: Record<string, { owned: string[]; foreign: string[] }> = {};
      await inTransaction(async (runner) => {
        await remember(
          runner,
          'SavedItem',
          'saved_item',
          'owned',
          {
            profileId: PROFILE,
            itemType: 'post',
            itemId: 'opaque-target-J24',
            savedAt: CREATED,
          },
          result
        );
        await remember(
          runner,
          'SavedItem',
          'saved_item',
          'foreign',
          {
            profileId: FOREIGN_PROFILE,
            itemType: 'post',
            itemId: 'foreign-target-J24',
            savedAt: CREATED,
          },
          result
        );
        await remember(
          runner,
          'SearchHistory',
          'search_history',
          'owned',
          {
            profileId: PROFILE,
            query: 'J24 safe saved search',
            searchType: 'posts',
            resultCount: 3,
            createdAt: CREATED,
          },
          result
        );
        await remember(
          runner,
          'SearchHistory',
          'search_history',
          'foreign',
          {
            profileId: FOREIGN_PROFILE,
            query: 'J24 foreign search',
            searchType: 'posts',
            resultCount: 1,
            createdAt: CREATED,
          },
          result
        );
        for (let index = 0; index < 260; index++) {
          await remember(
            runner,
            'SearchHistory',
            'search_history',
            'owned',
            {
              profileId: PROFILE,
              query: `J24 owned search page ${index}`,
              searchType: 'posts',
              resultCount: index,
              createdAt: CREATED,
            },
            result
          );
        }
        await remember(
          runner,
          'FollowEntity',
          'follow_entity',
          'owned',
          {
            followerId: PROFILE,
            followeeId: 'opaque-follow-target-J24',
            appScope: 'social',
            createdAt: CREATED,
            updatedAt: CREATED,
          },
          result
        );
        await remember(
          runner,
          'FollowEntity',
          'follow_entity',
          'foreign',
          {
            followerId: FOREIGN_PROFILE,
            followeeId: PROFILE,
            appScope: 'social',
            createdAt: CREATED,
            updatedAt: CREATED,
          },
          result
        );
        await remember(
          runner,
          'UserBlock',
          'user_block',
          'owned',
          {
            blockerId: PROFILE,
            blockedId: 'opaque-block-target-J24',
            reason: 'J24 safe block reason',
            createdAt: CREATED,
          },
          result
        );
        await remember(
          runner,
          'UserBlock',
          'user_block',
          'foreign',
          {
            blockerId: FOREIGN_PROFILE,
            blockedId: PROFILE,
            reason: 'J24 foreign block reason',
            createdAt: CREATED,
          },
          result
        );
        await remember(
          runner,
          'UserMute',
          'user_mute',
          'owned',
          {
            muterId: PROFILE,
            mutedId: 'opaque-mute-target-J24',
            duration: 30,
            createdAt: CREATED,
          },
          result
        );
        await remember(
          runner,
          'UserMute',
          'user_mute',
          'foreign',
          {
            muterId: FOREIGN_PROFILE,
            mutedId: PROFILE,
            duration: 30,
            createdAt: CREATED,
          },
          result
        );
        await remember(
          runner,
          'Activity',
          'activity',
          'owned',
          {
            profileId: PROFILE,
            type: 'post',
            resourceId: 'opaque-activity-resource-J24',
            description: 'J24 safe activity',
            createdAt: CREATED,
          },
          result
        );
        await remember(
          runner,
          'Activity',
          'activity',
          'foreign',
          {
            profileId: FOREIGN_PROFILE,
            type: 'post',
            resourceId: 'foreign-activity-resource-J24',
            description: 'J24 foreign activity',
            createdAt: CREATED,
          },
          result
        );
        // Presence is account-bound. Its profile belongs to another identity to prove that this source uses account binding.
        await remember(
          runner,
          'UserPresence',
          'user_presence',
          'owned',
          {
            userId: ACCOUNT,
            profileId: FOREIGN_PROFILE,
            status: 'online',
            lastSeen: CREATED,
            createdAt: CREATED,
            isExplicit: true,
          },
          result
        );
        await remember(
          runner,
          'UserPresence',
          'user_presence',
          'foreign',
          {
            userId: FOREIGN_ACCOUNT,
            profileId: FOREIGN_PROFILE,
            status: 'offline',
            lastSeen: CREATED,
            createdAt: CREATED,
            isExplicit: true,
          },
          result
        );
        // A profile view is selected by its viewer account; the viewed profile remains an opaque target.
        await remember(
          runner,
          'ProfileView',
          'profile_view',
          'owned',
          {
            viewerId: ACCOUNT,
            profileId: FOREIGN_PROFILE,
            source: 'J24_legacy_unsafe_source',
            viewedAt: CREATED,
          },
          result
        );
        await remember(
          runner,
          'ProfileView',
          'profile_view',
          'foreign',
          {
            viewerId: FOREIGN_ACCOUNT,
            profileId: PROFILE,
            source: 'profile',
            viewedAt: CREATED,
          },
          result
        );
        await remember(
          runner,
          'Notification',
          'notification',
          'owned',
          {
            recipientId: PROFILE,
            type: 'system',
            title: `${PRIVATE}_TITLE`,
            body: `${PRIVATE}_BODY`,
            isRead: false,
          },
          result
        );
        await remember(
          runner,
          'Notification',
          'notification',
          'foreign',
          {
            recipientId: FOREIGN_PROFILE,
            type: 'system',
            title: 'J24 foreign notification',
            body: 'J24 foreign notification body',
            isRead: false,
          },
          result
        );
      });
      return result;
    }

    async function seedCommunity(): Promise<
      Record<string, { owned: string[]; foreign: string[] }>
    > {
      const result: Record<string, { owned: string[]; foreign: string[] }> = {};
      await inTransaction(async (runner) => {
        const ownedCommunityId = await remember(
          runner,
          'Community',
          'community',
          'owned',
          {
            ownerId: ACCOUNT,
            ownerProfileId: PROFILE,
            isSystemCommunity: false,
            appScope: 'social',
            parentId: null,
          },
          result
        );
        const foreignCommunityId = await remember(
          runner,
          'Community',
          'community',
          'foreign',
          {
            ownerId: FOREIGN_ACCOUNT,
            ownerProfileId: FOREIGN_PROFILE,
            isSystemCommunity: false,
            appScope: 'social',
            parentId: null,
          },
          result
        );
        await remember(
          runner,
          'CommunityMember',
          'community_member',
          'owned',
          {
            communityId: ownedCommunityId,
            userId: ACCOUNT,
            profileId: PROFILE,
            role: 'member',
            status: 'approved',
            joinedAt: CREATED,
          },
          result
        );
        await remember(
          runner,
          'CommunityMember',
          'community_member',
          'foreign',
          {
            communityId: foreignCommunityId,
            userId: FOREIGN_ACCOUNT,
            profileId: FOREIGN_PROFILE,
            role: 'member',
            status: 'approved',
            joinedAt: CREATED,
          },
          result
        );
        await remember(
          runner,
          'CommunityInvite',
          'community_invite',
          'owned',
          {
            communityId: randomUUID(),
            inviterId: ACCOUNT,
            inviteeId: FOREIGN_ACCOUNT,
            inviteeEmail: `${PRIVATE}_EMAIL@invalid.test`,
            token: `${PRIVATE}_TOKEN`,
            status: 'pending',
            expiresAt: CREATED,
          },
          result
        );
        await remember(
          runner,
          'CommunityInvite',
          'community_invite',
          'owned',
          {
            communityId: randomUUID(),
            inviterId: FOREIGN_ACCOUNT,
            inviteeId: ACCOUNT,
            inviteeEmail: `${PRIVATE}_SUBJECT_EMAIL@invalid.test`,
            token: `${PRIVATE}_SUBJECT_TOKEN`,
            status: 'pending',
            expiresAt: CREATED,
          },
          result
        );
        await remember(
          runner,
          'CommunityInvite',
          'community_invite',
          'foreign',
          {
            communityId: randomUUID(),
            inviterId: FOREIGN_ACCOUNT,
            inviteeId: randomUUID(),
            inviteeEmail: 'J24_foreign_invite@invalid.test',
            token: 'J24_FOREIGN_TOKEN',
            status: 'pending',
            expiresAt: CREATED,
          },
          result
        );
        await remember(
          runner,
          'CommunityMembershipAudit',
          'community_membership_audit',
          'owned',
          {
            workspaceId: randomUUID(),
            actorId: ACCOUNT,
            subjectId: FOREIGN_PROFILE,
            actor: 'owner',
            action: 'member_added',
            from: 'pending',
            to: 'approved',
          },
          result
        );
        await remember(
          runner,
          'CommunityMembershipAudit',
          'community_membership_audit',
          'owned',
          {
            workspaceId: randomUUID(),
            actorId: FOREIGN_ACCOUNT,
            subjectId: PROFILE,
            actor: 'owner',
            action: 'member_removed',
            from: 'approved',
            to: 'revoked',
          },
          result
        );
        await remember(
          runner,
          'CommunityMembershipAudit',
          'community_membership_audit',
          'foreign',
          {
            workspaceId: randomUUID(),
            actorId: FOREIGN_ACCOUNT,
            subjectId: FOREIGN_PROFILE,
            actor: 'owner',
            action: 'member_added',
            from: 'pending',
            to: 'approved',
          },
          result
        );
        const ownedElectionId = await remember(
          runner,
          'CommunityElection',
          'community_election',
          'owned',
          {
            initiatedBy: ACCOUNT,
            communityId: ownedCommunityId,
            status: 'open',
          },
          result
        );
        const foreignElectionId = await remember(
          runner,
          'CommunityElection',
          'community_election',
          'foreign',
          {
            initiatedBy: FOREIGN_ACCOUNT,
            communityId: foreignCommunityId,
            status: 'open',
          },
          result
        );
        await remember(
          runner,
          'ElectionCandidate',
          'election_candidate',
          'owned',
          {
            electionId: ownedElectionId,
            userId: ACCOUNT,
            profileId: PROFILE,
            isWithdrawn: false,
            nominatedAt: CREATED,
          },
          result
        );
        const opaqueOtherCandidateId = await remember(
          runner,
          'ElectionCandidate',
          'election_candidate',
          'foreign',
          {
            electionId: ownedElectionId,
            userId: FOREIGN_ACCOUNT,
            profileId: FOREIGN_PROFILE,
            isWithdrawn: false,
            nominatedAt: CREATED,
          },
          result
        );
        selectedOpaqueCandidateRef = opaqueOtherCandidateId;
        const foreignCandidateId = await remember(
          runner,
          'ElectionCandidate',
          'election_candidate',
          'foreign',
          {
            electionId: foreignElectionId,
            userId: FOREIGN_ACCOUNT,
            profileId: FOREIGN_PROFILE,
            isWithdrawn: false,
            nominatedAt: CREATED,
          },
          result
        );
        await remember(
          runner,
          'ElectionVote',
          'election_vote',
          'owned',
          {
            electionId: ownedElectionId,
            voterId: ACCOUNT,
            voterProfileId: PROFILE,
            candidateId: opaqueOtherCandidateId,
            candidateUserId: FOREIGN_ACCOUNT,
            votedAt: CREATED,
          },
          result
        );
        await remember(
          runner,
          'ElectionVote',
          'election_vote',
          'foreign',
          {
            electionId: foreignElectionId,
            voterId: FOREIGN_ACCOUNT,
            voterProfileId: FOREIGN_PROFILE,
            candidateId: foreignCandidateId,
            candidateUserId: ACCOUNT,
            votedAt: CREATED,
          },
          result
        );
      });
      return result;
    }

    async function seedSafety(): Promise<
      Record<string, { owned: string[]; foreign: string[] }>
    > {
      const result: Record<string, { owned: string[]; foreign: string[] }> = {};
      await inTransaction(async (runner) => {
        ownedBusinessPaymentRef = randomUUID();
        const ownedPage = await insert(runner, 'business_page_contents', {
          ownerId: ACCOUNT,
          communityId: randomUUID(),
          tier: 'basic',
          subscriptionStatus: 'active',
          paymentsBusinessPageId: ownedBusinessPaymentRef,
        });
        (result.BusinessPageContent ??= { owned: [], foreign: [] }).owned.push(
          ownedPage
        );
        const foreignPage = await insert(runner, 'business_page_contents', {
          ownerId: FOREIGN_ACCOUNT,
          communityId: randomUUID(),
          tier: 'basic',
          subscriptionStatus: 'active',
          paymentsBusinessPageId: randomUUID(),
        });
        (result.BusinessPageContent ??= {
          owned: [],
          foreign: [],
        }).foreign.push(foreignPage);
        ownedSponsorshipPaymentRef = randomUUID();
        await remember(
          runner,
          'BusinessThemeContent',
          'business_theme_contents',
          'owned',
          { businessPageId: ownedPage, customCss: `${PRIVATE}_CSS` },
          result
        );
        await remember(
          runner,
          'BusinessThemeContent',
          'business_theme_contents',
          'foreign',
          { businessPageId: foreignPage, customCss: `${PRIVATE}_FOREIGN_CSS` },
          result
        );
        await remember(
          runner,
          'CommunitySponsorshipContent',
          'community_sponsorship_contents',
          'owned',
          {
            userId: ACCOUNT,
            type: 'banner',
            status: 'active',
            startsAt: CREATED,
            expiresAt: CREATED,
            months: 1,
            communityId: randomUUID(),
            businessPageId: foreignPage,
            paymentsSponsorshipId: ownedSponsorshipPaymentRef,
            adContent: `${PRIVATE}_AD`,
          },
          result
        );
        await remember(
          runner,
          'CommunitySponsorshipContent',
          'community_sponsorship_contents',
          'foreign',
          {
            userId: FOREIGN_ACCOUNT,
            type: 'banner',
            status: 'active',
            startsAt: CREATED,
            expiresAt: CREATED,
            months: 1,
            communityId: randomUUID(),
            businessPageId: ownedPage,
            paymentsSponsorshipId: randomUUID(),
            adContent: `${PRIVATE}_FOREIGN_AD`,
          },
          result
        );
        await remember(
          runner,
          'GuardianContentAudit',
          'guardian_content_audit',
          'owned',
          {
            actorUserId: ACCOUNT,
            dependentUserId: FOREIGN_ACCOUNT,
            dependentProfileId: FOREIGN_PROFILE,
            appId: 'social',
            resourceType: 'post',
            operation: 'edit',
            resourceId: randomUUID(),
            changedFields: JSON.stringify({
              privatePayload: `${PRIVATE}_AUDIT`,
            }),
          },
          result
        );
        await remember(
          runner,
          'GuardianContentAudit',
          'guardian_content_audit',
          'owned',
          {
            actorUserId: FOREIGN_ACCOUNT,
            dependentUserId: ACCOUNT,
            dependentProfileId: PROFILE,
            appId: 'social',
            resourceType: 'comment',
            operation: 'hide',
            resourceId: randomUUID(),
            changedFields: JSON.stringify({
              privatePayload: `${PRIVATE}_DEPENDENT_AUDIT`,
            }),
          },
          result
        );
        await remember(
          runner,
          'GuardianContentAudit',
          'guardian_content_audit',
          'foreign',
          {
            actorUserId: FOREIGN_ACCOUNT,
            dependentUserId: FOREIGN_ACCOUNT,
            dependentProfileId: FOREIGN_PROFILE,
            appId: 'social',
            resourceType: 'post',
            operation: 'edit',
            resourceId: randomUUID(),
            changedFields: JSON.stringify({
              privatePayload: 'J24_FOREIGN_AUDIT',
            }),
          },
          result
        );
        await remember(
          runner,
          'GuardianPublishedAssetGrant',
          'guardian_published_asset_grant',
          'owned',
          {
            actorUserId: ACCOUNT,
            dependentProfileId: FOREIGN_PROFILE,
            assetId: randomUUID(),
            resourceType: 'post',
            resourceId: randomUUID(),
            appId: 'social',
          },
          result
        );
        await remember(
          runner,
          'GuardianPublishedAssetGrant',
          'guardian_published_asset_grant',
          'owned',
          {
            actorUserId: FOREIGN_ACCOUNT,
            dependentProfileId: PROFILE,
            assetId: randomUUID(),
            resourceType: 'comment',
            resourceId: randomUUID(),
            appId: 'social',
          },
          result
        );
        await remember(
          runner,
          'GuardianPublishedAssetGrant',
          'guardian_published_asset_grant',
          'foreign',
          {
            actorUserId: FOREIGN_ACCOUNT,
            dependentProfileId: FOREIGN_PROFILE,
            assetId: randomUUID(),
            resourceType: 'post',
            resourceId: randomUUID(),
            appId: 'social',
          },
          result
        );
        await remember(
          runner,
          'ContentReport',
          'content_report',
          'owned',
          {
            reporterId: PROFILE,
            contentType: 'post',
            contentId: randomUUID(),
            appScope: 'social',
            workspaceId: null,
            reason: 'spam',
            description: `${PRIVATE}_REPORT_DESCRIPTION`,
            adminNotes: `${PRIVATE}_REPORT_ADMIN_NOTES`,
            status: 'pending',
          },
          result
        );
        await remember(
          runner,
          'ContentReport',
          'content_report',
          'foreign',
          {
            reporterId: FOREIGN_PROFILE,
            contentType: 'post',
            contentId: randomUUID(),
            appScope: 'social',
            workspaceId: null,
            reason: 'spam',
            description: 'J24_FOREIGN_REPORT_DESCRIPTION',
            adminNotes: 'J24_FOREIGN_REPORT_ADMIN',
            status: 'pending',
          },
          result
        );
        await remember(
          runner,
          'ContentModerationAction',
          'content_moderation_action',
          'owned',
          {
            actorProfileId: PROFILE,
            appScope: 'social',
            action: 'content_moderation',
            subjectType: 'post',
            subjectId: randomUUID(),
            workspaceId: null,
            reportId: null,
            details: { privatePayload: `${PRIVATE}_MODERATION_DETAILS` },
          },
          result
        );
        await remember(
          runner,
          'ContentModerationAction',
          'content_moderation_action',
          'foreign',
          {
            actorProfileId: FOREIGN_PROFILE,
            appScope: 'social',
            action: 'content_moderation',
            subjectType: 'post',
            subjectId: randomUUID(),
            workspaceId: null,
            reportId: null,
            details: { privatePayload: 'J24_FOREIGN_MODERATION_DETAILS' },
          },
          result
        );
      });
      return result;
    }

    function expectOwnership(
      group: Group,
      records: any[],
      ownership: Record<string, { owned: string[]; foreign: string[] }>,
      expectedCounts: Record<string, number>
    ): void {
      const names = sourceGroups[group].names as readonly string[];
      const actual = Object.fromEntries(
        names.map((name) => [
          name,
          records.filter((record) => record.source === name).length,
        ])
      );
      expect(actual).toEqual(
        Object.fromEntries(
          names.map((name) => [name, expectedCounts[name] ?? 0])
        )
      );
      for (const name of names) {
        const sourceRows = records.filter((record) => record.source === name);
        const ownedIds = ownership[name]?.owned ?? [];
        const foreignIds = ownership[name]?.foreign ?? [];
        expect(
          sourceRows.every((record) => ownedIds.includes(record.data.id))
        ).toBe(true);
        expect(
          sourceRows.some((record) => foreignIds.includes(record.data.id))
        ).toBe(false);
        expect(sourceRows.length).toBeGreaterThan(0);
      }
    }

    function metadataRows(records: any[], source: string): any[] {
      return records
        .filter((record) => record.source === source)
        .map((record) => record.data);
    }

    async function finishGroup(
      group: Group,
      ownership: Record<string, { owned: string[]; foreign: string[] }>,
      expectedCounts: Record<string, number>,
      assertions: (records: any[], end: any, chunks: any[]) => void
    ): Promise<void> {
      currentGroup = group;
      const { handle, chunks, records } = await capture(group);
      try {
        expectCounts(group, handle, expectedCounts);
        expect(handle.metadata.rowCount).toBe(records.length);
        const end = chunks.at(-1);
        expect(end.sourceRowCounts).toEqual(handle.metadata.sourceRowCounts);
        expectOwnership(group, records, ownership, expectedCounts);
        assertions(records, end, chunks);
        stageRows[group] = { ...handle.metadata.sourceRowCounts };
        passedGroups.add(group);
      } finally {
        await handle.cleanup();
      }
    }

    it('B: captures all nine Personal sources with actor-side selection and opaque targets', async () => {
      const ownership = await seedPersonal();
      await finishGroup(
        'Personal',
        ownership,
        {
          SavedItem: 1,
          SearchHistory: 261,
          FollowEntity: 1,
          UserBlock: 1,
          UserMute: 1,
          Activity: 1,
          UserPresence: 1,
          ProfileView: 1,
          Notification: 1,
        },
        (records, _end, chunks) => {
          const searchRows = metadataRows(records, 'SearchHistory');
          expect(searchRows.map((row) => row.id).sort()).toEqual(
            ownership.SearchHistory.owned.slice().sort()
          );
          const searchChunks = chunks.filter(
            (chunk) => chunk.source === 'SearchHistory' && chunk.records?.length
          );
          expect(searchChunks.map((chunk) => chunk.records.length)).toEqual([
            250, 11,
          ]);
          const follow = metadataRows(records, 'FollowEntity')[0];
          expect(follow.followerId).toBe(PROFILE);
          expect(follow.followeeId).toBe('opaque-follow-target-J24');
          expect(follow.references).toBe('opaque-no-access-grant');
          const presence = metadataRows(records, 'UserPresence')[0];
          expect(presence.userId).toBe(ACCOUNT);
          expect(presence.profileId).toBeUndefined();
          const view = metadataRows(records, 'ProfileView')[0];
          expect(view.viewerId).toBe(ACCOUNT);
          expect(view.profileId).toBe(FOREIGN_PROFILE);
          expect(view.source).toBe('other');
          const notification = metadataRows(records, 'Notification')[0];
          expect(notification.title).toBe('Notification');
          expect(notification.body).toBe('You have a new notification');
          const text = JSON.stringify(records);
          for (const privateValue of [
            `${PRIVATE}_TITLE`,
            `${PRIVATE}_BODY`,
            'J24_legacy_unsafe_source',
            'J24 foreign search',
            'J24 foreign notification',
          ])
            expect(text).not.toContain(privateValue);
        }
      );
    });

    it('C: captures all seven Community sources and fails closed on paired identity mismatch', async () => {
      const ownership = await seedCommunity();
      await finishGroup(
        'Community',
        ownership,
        {
          Community: 1,
          CommunityMember: 1,
          CommunityInvite: 2,
          CommunityMembershipAudit: 2,
          CommunityElection: 1,
          ElectionCandidate: 1,
          ElectionVote: 1,
        },
        (records) => {
          const invites = metadataRows(records, 'CommunityInvite');
          expect(invites).toHaveLength(2);
          expect(
            invites
              .map((row) => row.participation)
              .sort((a, b) => a[0].role.localeCompare(b[0].role))
          ).toEqual([
            [{ role: 'invitee', accountId: ACCOUNT }],
            [{ role: 'inviter', accountId: ACCOUNT }],
          ]);
          const audits = metadataRows(records, 'CommunityMembershipAudit');
          expect(
            audits
              .map((row) => row.participation)
              .sort((a, b) => a[0].role.localeCompare(b[0].role))
          ).toEqual([
            [{ role: 'actor', accountId: ACCOUNT }],
            [{ role: 'subject', profileId: PROFILE }],
          ]);
          const votes = metadataRows(records, 'ElectionVote');
          expect(votes).toHaveLength(1);
          expect(votes[0].candidateId).toBe(selectedOpaqueCandidateRef);
          expect(metadataRows(records, 'ElectionCandidate')).toHaveLength(1);
          expect(JSON.stringify(records)).not.toMatch(
            /J24_PRIVATE_RECEIPT_PAYLOAD_(?:EMAIL|TOKEN)/
          );
        }
      );

      await cleanup();
      await inTransaction(async (runner) => {
        const foreignCommunityId = await insert(runner, 'community', {
          ownerId: FOREIGN_ACCOUNT,
          ownerProfileId: FOREIGN_PROFILE,
          isSystemCommunity: false,
          appScope: 'social',
          parentId: null,
        });
        await insert(runner, 'community_member', {
          communityId: foreignCommunityId,
          userId: ACCOUNT,
          profileId: FOREIGN_PROFILE,
          role: 'member',
          status: 'approved',
          joinedAt: CREATED,
        });
      });
      const seen: any[] = [];
      const names = COMMUNITY_SOURCES as readonly string[];
      await expect(
        new AccountExportOwnerSpoolService().capture(
          {
            participantId: 'social',
            accountId: ACCOUNT,
            sources: names,
            spoolRoot,
          },
          (sink, signal) =>
            owner.captureAccount({
              grant,
              profileSnapshot: descriptor,
              signal,
              sources: createCommunitySources,
              onChunk: async (chunk) => {
                seen.push(chunk);
                await sink(chunk);
              },
            })
        )
      ).rejects.toBeDefined();
      expect(seen.some((chunk) => chunk.complete === true)).toBe(false);
      await cleanup();
    });

    it('D: captures all seven Safety sources as profile/account-bound references and excludes private audit payloads', async () => {
      const ownership = await seedSafety();
      await finishGroup(
        'Safety',
        ownership,
        {
          BusinessPageContent: 1,
          BusinessThemeContent: 1,
          CommunitySponsorshipContent: 1,
          GuardianContentAudit: 2,
          GuardianPublishedAssetGrant: 2,
          ContentReport: 1,
          ContentModerationAction: 1,
        },
        (records) => {
          const page = metadataRows(records, 'BusinessPageContent')[0];
          expect(page.ownerId).toBe(ACCOUNT);
          expect(typeof page.paymentsBusinessPageId).toBe('string');
          expect(page.paymentsBusinessPageId).toBe(ownedBusinessPaymentRef);
          const sponsor = metadataRows(
            records,
            'CommunitySponsorshipContent'
          )[0];
          expect(sponsor.userId).toBe(ACCOUNT);
          expect(typeof sponsor.paymentsSponsorshipId).toBe('string');
          expect(sponsor.paymentsSponsorshipId).toBe(
            ownedSponsorshipPaymentRef
          );
          const audits = metadataRows(records, 'GuardianContentAudit');
          expect(
            audits
              .map((row) => row.participation)
              .sort((a, b) => a[0].role.localeCompare(b[0].role))
          ).toEqual([
            [{ role: 'actor', accountId: ACCOUNT }],
            [{ role: 'dependent', accountId: ACCOUNT }],
          ]);
          const grants = metadataRows(records, 'GuardianPublishedAssetGrant');
          expect(
            grants
              .map((row) => row.participation)
              .sort((a, b) => a[0].role.localeCompare(b[0].role))
          ).toEqual([
            [{ role: 'actor', accountId: ACCOUNT }],
            [{ role: 'dependent', profileId: PROFILE }],
          ]);
          expect(metadataRows(records, 'ContentReport')[0].reporterId).toBe(
            PROFILE
          );
          const text = JSON.stringify(records);
          for (const privateValue of [
            `${PRIVATE}_CSS`,
            `${PRIVATE}_AD`,
            `${PRIVATE}_AUDIT`,
            `${PRIVATE}_DEPENDENT_AUDIT`,
            `${PRIVATE}_REPORT_DESCRIPTION`,
            `${PRIVATE}_REPORT_ADMIN_NOTES`,
            `${PRIVATE}_MODERATION_DETAILS`,
          ])
            expect(text).not.toContain(privateValue);
        }
      );
    });
  }
);

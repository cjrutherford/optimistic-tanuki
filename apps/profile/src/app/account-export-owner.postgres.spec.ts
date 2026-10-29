import { ClientProxy } from '@nestjs/microservices';
import { createHash, randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { of } from 'rxjs';
import loadDatabase from './loadDatabase';
import {
  PROFILE_ACCOUNT_EXPORT_SOURCES,
  ProfileAccountExportOwnerService,
  ProfileAccountExportChunk,
} from './account-export-owner.service';
import { AccountExportOwnerSpoolService } from '@optimistic-tanuki/storage';
import { Profile } from '../profiles/entities/profile.entity';
import { Timeline } from '../timelines/entities/timeline.entity';
import { GuardianProfileActivity } from '../profiles/entities/guardian-profile-activity.entity';

jest.mock('uuid', () => ({
  v4: () => require('node:crypto').randomUUID(),
}));

const DB_NAME = 'profile_owner_j5_fixture';
const DB_HOST = '127.0.0.1';
const DB_PORT = '15549';
const DB_USER = 'owner_fixture';
const enabled =
  process.env.PROFILE_OWNER_PG_OPT_IN === DB_NAME &&
  process.env.PROFILE_OWNER_PG_NAME === DB_NAME &&
  process.env.PROFILE_OWNER_PG_HOST === DB_HOST &&
  process.env.PROFILE_OWNER_PG_PORT === DB_PORT &&
  process.env.PROFILE_OWNER_PG_USER === DB_USER &&
  typeof process.env.PROFILE_OWNER_PG_PASSWORD === 'string' &&
  process.env.PROFILE_OWNER_PG_PASSWORD.length > 0;

const ACCOUNT_ID = 'd816be66-4fb6-4ed6-a91d-cc058bd5c816';
const GUARDIAN_ID = 'f1384460-a162-49d4-89a0-5f7a07d8bd06';
const DEPENDENT_ID = 'd59f45d5-d63a-4b29-b3b0-5d8377fe77a1';
const FOREIGN_ID = '9c9e2b0a-7a74-4cda-a0cf-13f8fc89922a';
const MIN_PROFILE_ID = '00000000-0000-0000-0000-000000000000';
const FOREIGN_PROFILE_ID = '00000000-0000-0000-0000-000000000001';
const LONG_REFERENCE_PROFILE_ID = '00000000-0000-0000-0000-000000000002';
const ACCOUNT_APP = 'client-interface';
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAABAAAAAQBPJcTWAAAAEklEQVR4nGNkYPjHwMDAwgAGAAsiAQRmV5cZAAAAAElFTkSuQmCC',
  'base64'
);
const JPEG_BYTES = Buffer.from(
  '/9j/4AAQSkZJRgABAgAAAQABAAD//gAQTGF2YzYyLjExLjEwMAD/2wBDAAgEBAQEBAUFBQUFBQYGBgYGBgYGBgYGBgYGBgYHBwcICAgHBwcGBgcHCAgICAkJCQgICAgJCQoKCgwMCwsODg4RERT/xABMAAEBAAAAAAAAAAAAAAAAAAAABgEBAQAAAAAAAAAAAAAAAAAABgcQAQAAAAAAAAAAAAAAAAAAAAARAQAAAAAAAAAAAAAAAAAAAAD/wAARCAACAAIDASIAAhEAAxEA/9oADAMBAAIRAxEAPwCLAE1/f//Z',
  'base64'
);
const dataUrl = (mime: string, bytes: Buffer) =>
  `data:${mime};base64,${bytes.toString('base64')}`;

type CapturedRecord = { source: string; data: Record<string, any> };

const describePg = enabled ? describe : describe.skip;

describePg('ProfileAccountExportOwnerService PostgreSQL snapshot', () => {
  let dataSource: DataSource;
  let service: ProfileAccountExportOwnerService;
  const ownedTimelineIds: string[] = [];
  const ownedLegacyGoalId = '00000000-0000-0000-0000-000000000101';
  const foreignLegacyGoalId = '00000000-0000-0000-0000-000000000102';
  const ownedLegacyProjectId = '00000000-0000-0000-0000-000000000103';
  const foreignLegacyProjectId = '00000000-0000-0000-0000-000000000104';
  const authClient = {
    send: jest.fn(() =>
      of({ isValid: true, data: { userId: ACCOUNT_ID, appId: ACCOUNT_APP } })
    ),
  } as unknown as ClientProxy;

  beforeAll(async () => {
    const config = {
      get: (key: string) =>
        key === 'database'
          ? {
              host: process.env.PROFILE_OWNER_PG_HOST,
              port: Number(process.env.PROFILE_OWNER_PG_PORT),
              username: process.env.PROFILE_OWNER_PG_USER,
              password: process.env.PROFILE_OWNER_PG_PASSWORD,
              database: process.env.PROFILE_OWNER_PG_NAME,
            }
          : undefined,
    } as any;
    dataSource = new DataSource({
      ...loadDatabase(config),
      migrationsRun: false,
      synchronize: false,
      logging: false,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();
    service = new ProfileAccountExportOwnerService(dataSource, authClient);

    const longBio = `bio-start-${'😀漢字'.repeat(1100)}-bio-end`;
    const profiles = [
      {
        id: MIN_PROFILE_ID,
        userId: ACCOUNT_ID.toUpperCase(),
        appScope: 'scope-minimum-uuid',
        profileName: 'minimum UUID profile',
        profilePic: dataUrl('image/png', PNG_BYTES),
        coverPic: dataUrl('image/jpeg', JPEG_BYTES),
        bio: longBio,
        location: 'owned location',
        occupation: 'owned occupation',
        interests: 'owned interests',
        skills: 'owned skills',
        blogRole: 'none',
      },
      ...Array.from({ length: 1004 }, (_, index) => ({
        userId: index === 0 ? ACCOUNT_ID.toUpperCase() : ACCOUNT_ID,
        appScope: `scope-${index.toString().padStart(4, '0')}`,
        profileName: `profile-${index}`,
        profilePic: 'https://cdn.example.test/owned.png?exact=1',
        coverPic: '/asset/00000000-0000-4000-8000-000000000009?exact=2',
        bio: 'bio',
        location: 'location',
        occupation: 'occupation',
        interests: 'interests',
        skills: 'skills',
        blogRole: 'none',
      })),
      {
        id: LONG_REFERENCE_PROFILE_ID,
        userId: ACCOUNT_ID,
        appScope: 'scope-long-reference',
        profileName: 'long reference profile',
        profilePic: `https://cdn.example.test/${'r'.repeat(2700)}`,
        coverPic: 'opaque-cover-reference',
        bio: 'long reference bio',
        location: 'location',
        occupation: 'occupation',
        interests: 'interests',
        skills: 'skills',
        blogRole: 'none',
      },
      {
        id: FOREIGN_PROFILE_ID,
        userId: FOREIGN_ID,
        appScope: 'foreign-scope',
        profileName: 'foreign profile',
        profilePic: 'foreign-ref',
        coverPic: 'foreign-cover',
        bio: 'foreign bio',
        location: 'foreign location',
        occupation: 'foreign occupation',
        interests: 'foreign interests',
        skills: 'foreign skills',
        blogRole: 'none',
      },
      {
        userId: DEPENDENT_ID,
        appScope: 'dependent-scope',
        profileName: 'dependent profile',
        profilePic: 'dependent-ref',
        coverPic: 'dependent-cover',
        bio: 'dependent bio',
        location: 'dependent location',
        occupation: 'dependent occupation',
        interests: 'dependent interests',
        skills: 'dependent skills',
        blogRole: 'none',
      },
    ];
    const inserted = await dataSource
      .getRepository(Profile)
      .insert(profiles as any);
    const dependentProfileId = inserted.identifiers[1007].id as string;

    const timelineRows = Array.from({ length: 1005 }, (_, index) => {
      const id = randomUUID();
      ownedTimelineIds.push(id);
      return {
        id,
        userId: index === 0 ? ACCOUNT_ID.toUpperCase() : ACCOUNT_ID,
        title: `timeline-${index}`,
        description:
          index === 0
            ? `timeline-start-${'🧭é'.repeat(1600)}-timeline-end`
            : 'timeline description',
        eventType: 'Posted',
        related_profile: {
          id: index === 0 ? FOREIGN_PROFILE_ID : MIN_PROFILE_ID,
        },
      };
    });
    await dataSource.getRepository(Timeline).insert(timelineRows as any);
    await dataSource.getRepository(GuardianProfileActivity).insert([
      {
        actorUserId: ACCOUNT_ID,
        dependentUserId: DEPENDENT_ID,
        profileId: dependentProfileId,
        appId: ACCOUNT_APP,
        operation: 'profile.view',
        changedFieldNames: ['must-not-appear-for-guardian'],
      },
      {
        actorUserId: GUARDIAN_ID,
        dependentUserId: ACCOUNT_ID,
        profileId: MIN_PROFILE_ID,
        appId: ACCOUNT_APP,
        operation: 'profile.manage',
        changedFieldNames: ['bio', 'skills'],
      },
    ] as any);

    await dataSource.query(
      `UPDATE "profile" SET "created_at" = '2024-03-04 05:06:07.123456'::timestamp WHERE "id" = $1::uuid`,
      [MIN_PROFILE_ID]
    );
    await dataSource.query(
      `INSERT INTO "goal" ("id", "name", "description", "target", "progress", "userId", "startDate") VALUES ($1, 'foreign goal', 'fixture', 1, 0, $2, CURRENT_TIMESTAMP)`,
      [foreignLegacyGoalId, FOREIGN_ID]
    );
    await dataSource.query(
      `INSERT INTO "project" ("id", "name", "description", "userId") VALUES ($1, 'foreign project', 'fixture', $2)`,
      [foreignLegacyProjectId, FOREIGN_ID]
    );
  }, 60_000);

  afterAll(async () => {
    if (!dataSource?.isInitialized) return;
    await dataSource.query(
      'UPDATE "timeline" SET "relatedGoalId"=NULL, "relatedProjectId"=NULL WHERE lower("userId")=lower($1)',
      [ACCOUNT_ID]
    );
    await dataSource.query(
      'UPDATE "project" SET "goalsId"=NULL, "timeLineEventsId"=NULL WHERE lower("userId")=lower($1)',
      [ACCOUNT_ID]
    );
    await dataSource.query(
      'UPDATE "goal" SET "relatedProjectId"=NULL WHERE lower("userId")=lower($1)',
      [ACCOUNT_ID]
    );
    await dataSource.query(
      `DELETE FROM "timeline" WHERE lower("userId") = lower($1)`,
      [ACCOUNT_ID]
    );
    await dataSource.query(
      `DELETE FROM "guardian_profile_activity" WHERE "actorUserId" = ANY($1::uuid[]) OR "dependentUserId" = ANY($1::uuid[])`,
      [[ACCOUNT_ID, GUARDIAN_ID, DEPENDENT_ID]]
    );
    await dataSource.query(`DELETE FROM "goal" WHERE "id" = ANY($1::uuid[])`, [
      [ownedLegacyGoalId, foreignLegacyGoalId],
    ]);
    await dataSource.query(
      `DELETE FROM "project" WHERE "id" = ANY($1::uuid[])`,
      [[ownedLegacyProjectId, foreignLegacyProjectId]]
    );
    await dataSource.query(
      `DELETE FROM "profile" WHERE lower("userId") = ANY($1::text[])`,
      [[ACCOUNT_ID, DEPENDENT_ID, FOREIGN_ID]]
    );
    await dataSource.destroy();
  }, 30_000);

  it('captures complete bounded data from one stable snapshot with real media bytes and owner privacy', async () => {
    expect(
      await dataSource.query(
        'SELECT "userId" FROM "profile" WHERE "id"=$1::uuid',
        [MIN_PROFILE_ID]
      )
    ).toEqual([{ userId: ACCOUNT_ID.toUpperCase() }]);
    expect(
      await dataSource.query(
        'SELECT "userId" FROM "timeline" WHERE "id"=$1::uuid',
        [ownedTimelineIds[0]]
      )
    ).toEqual([{ userId: ACCOUNT_ID.toUpperCase() }]);
    const chunks: CapturedRecord[] = [];
    let insertedDuringCapture = false;
    const end = await service.captureAccount({
      accountId: ACCOUNT_ID,
      sessionToken: 'test-session-token',
      appId: ACCOUNT_APP,
      onChunk: async (chunk) => {
        if (
          !insertedDuringCapture &&
          chunk.source === 'profileIdentity' &&
          chunk.pageOrdinal === 1
        ) {
          insertedDuringCapture = true;
          await dataSource.getRepository(Profile).insert({
            userId: ACCOUNT_ID.toUpperCase(),
            appScope: 'late-concurrent-profile',
            profileName: 'must not enter snapshot',
            profilePic: '',
            coverPic: '',
            bio: '',
            location: '',
            occupation: '',
            interests: '',
            skills: '',
            blogRole: 'none',
          } as any);
        }
        chunks.push(
          ...chunk.records.map((record) => ({
            source: chunk.source,
            data: record.data,
          }))
        );
      },
    });
    expect(insertedDuringCapture).toBe(true);
    expect(end.endOfStream).toBe(true);
    expect(end.sourceRowCounts?.profileIdentity).toBe(1006);
    expect(end.sourceRowCounts?.profile).toBe(1006);
    expect(end.sourceRowCounts?.timeline).toBe(1005);
    expect(end.sourceRowCounts?.guardianActivity).toBe(2);

    const profile = chunks.find(
      (record) =>
        record.source === 'profile' && record.data.id === MIN_PROFILE_ID
    )!.data;
    expect(profile.userId).toBe(ACCOUNT_ID);
    expect(profile.bio).toMatchObject({
      disposition: 'full-text-in-profileText-source',
    });
    expect(profile.created_at).toBe('2024-03-04 05:06:07.123456');
    const bio = chunks
      .filter(
        (record) =>
          record.source === 'profileText' &&
          record.data.profileId === MIN_PROFILE_ID &&
          record.data.field === 'bio'
      )
      .sort((a, b) => a.data.charOffset - b.data.charOffset)
      .map((record) => record.data.value)
      .join('');
    expect(bio).toBe(`bio-start-${'😀漢字'.repeat(1100)}-bio-end`);

    const identityIds = chunks
      .filter((record) => record.source === 'profileIdentity')
      .map((record) => record.data.id)
      .sort();
    const profileIds = chunks
      .filter((record) => record.source === 'profile')
      .map((record) => record.data.id)
      .sort();
    expect(identityIds).toEqual(profileIds);
    expect(
      chunks
        .filter((record) => record.source === 'timeline')
        .every((record) => record.data.userId === ACCOUNT_ID)
    ).toBe(true);
    expect(JSON.stringify(chunks)).not.toContain(FOREIGN_ID);
    expect(JSON.stringify(chunks)).not.toContain(FOREIGN_PROFILE_ID);

    const longReferenceRecord = chunks.find(
      (record) =>
        record.source === 'profileMedia' &&
        record.data.profileId === LONG_REFERENCE_PROFILE_ID &&
        record.data.field === 'profilePic'
    )!;
    const longReference = chunks
      .filter(
        (record) =>
          record.source === 'profileText' &&
          record.data.profileId === LONG_REFERENCE_PROFILE_ID &&
          record.data.field === 'profilePic'
      )
      .sort((a, b) => a.data.charOffset - b.data.charOffset)
      .map((record) => record.data.value)
      .join('');
    expect(longReferenceRecord.data.referenceText.source).toBe('profileText');
    expect(
      chunks.some(
        (record) =>
          record.source === 'profileText' &&
          record.data.id.startsWith(
            longReferenceRecord.data.referenceText.chunkIdPrefix
          )
      )
    ).toBe(true);
    expect(longReference).toBe(`https://cdn.example.test/${'r'.repeat(2700)}`);
    const shortRemote = chunks.find(
      (record) =>
        record.source === 'profileMedia' &&
        record.data.value === 'https://cdn.example.test/owned.png?exact=1'
    );
    expect(shortRemote?.data.value).toBe(
      'https://cdn.example.test/owned.png?exact=1'
    );

    for (const [field, expected] of [
      ['profilePic', PNG_BYTES],
      ['coverPic', JPEG_BYTES],
    ] as const) {
      const media = chunks
        .filter(
          (record) =>
            record.source === 'profileMedia' &&
            record.data.profileId === MIN_PROFILE_ID &&
            record.data.field === field &&
            record.data.disposition === 'inline-image-bytes'
        )
        .sort((a, b) => a.data.chunkIndex - b.data.chunkIndex);
      const reconstructed = Buffer.concat(
        media.map((record) => Buffer.from(record.data.bytesBase64, 'base64'))
      );
      expect(reconstructed.equals(expected)).toBe(true);
      expect(media[0].data.sha256).toBe(
        createHash('sha256').update(expected).digest('hex')
      );
      expect(media[0].data.byteCount).toBe(expected.length);
    }

    const ownedRelated = chunks.find(
      (record) =>
        record.source === 'timeline' &&
        record.data.relatedProfile?.disposition === 'owned-profile-reference'
    );
    const foreignRelated = chunks.find(
      (record) =>
        record.source === 'timeline' &&
        record.data.relatedProfile?.disposition ===
          'redacted-unowned-profile-reference'
    );
    expect(ownedRelated?.data.relatedProfile.id).toBe(MIN_PROFILE_ID);
    expect(foreignRelated?.data.relatedProfile).not.toHaveProperty('id');
    const timelineText = chunks
      .filter((record) => record.source === 'timelineText')
      .sort((a, b) => a.data.charOffset - b.data.charOffset)
      .map((record) => record.data.value)
      .join('');
    expect(timelineText).toBe(
      `timeline-start-${'🧭é'.repeat(1600)}-timeline-end`
    );

    const guardianActivity = chunks.filter(
      (record) => record.source === 'guardianActivity'
    );
    const guardian = guardianActivity.find(
      (record) => record.data.role === 'guardian'
    )!;
    expect(guardian.data).not.toHaveProperty('profileId');
    expect(guardian.data).not.toHaveProperty('changedFieldNames');
    expect(guardian.data).not.toHaveProperty('actorUserId');
    expect(guardian.data).not.toHaveProperty('dependentUserId');
    const dependent = guardianActivity.find(
      (record) => record.data.role === 'dependent'
    )!;
    expect(dependent.data.profileId).toBe(MIN_PROFILE_ID);
    expect(dependent.data.changedFieldNames).toEqual(['bio', 'skills']);
    expect(
      chunks.some(
        (record) => record.data.appScope === 'late-concurrent-profile'
      )
    ).toBe(false);
  }, 60_000);

  it('captures owned legacy data and links while redacting foreign references and preserving counterpart rows', async () => {
    const capture = async () => {
      const records: CapturedRecord[] = [];
      let end: ProfileAccountExportChunk | undefined;
      const handle = await new AccountExportOwnerSpoolService().capture(
        {
          participantId: 'profile',
          accountId: ACCOUNT_ID,
          sources: PROFILE_ACCOUNT_EXPORT_SOURCES,
        },
        (onChunk, signal) =>
          service.captureAccount({
            accountId: ACCOUNT_ID,
            sessionToken: 'test-session-token',
            appId: ACCOUNT_APP,
            signal,
            onChunk: async (chunk) => {
              records.push(...chunk.records);
              if (chunk.endOfStream) end = chunk;
              await onChunk(chunk);
            },
          })
      );
      try {
        expect(handle.metadata.sourceRowCounts).toEqual(end?.sourceRowCounts);
        return { end: end!, records };
      } finally {
        await handle.cleanup();
      }
    };
    const empty = await capture();
    expect(empty.end.sourceRowCounts?.legacyGoal).toBe(0);
    expect(empty.end.sourceRowCounts?.legacyProject).toBe(0);
    const longName = `goal-${'😀漢字'.repeat(1000)}`;
    const longDescription = `project-${'🧭é'.repeat(1600)}`;
    await dataSource.query(
      `INSERT INTO "goal" ("id", "name", "description", "target", "progress", "userId", "startDate", "relatedProfileId") VALUES ($1, $4, 'fixture goal', -3, 7, $2, '2024-02-03 04:05:06.123456'::timestamp, $3)`,
      [ownedLegacyGoalId, ACCOUNT_ID.toUpperCase(), MIN_PROFILE_ID, longName]
    );
    await dataSource.query(
      `INSERT INTO "project" ("id", "name", "description", "userId", "relatedProfileId", "timeLineEventsId", "goalsId") VALUES ($1, 'owned project', $6, $2, $3, $4, $5)`,
      [
        ownedLegacyProjectId,
        ACCOUNT_ID.toUpperCase(),
        FOREIGN_PROFILE_ID,
        ownedTimelineIds[0],
        ownedLegacyGoalId,
        longDescription,
      ]
    );
    await dataSource.query(
      'UPDATE "goal" SET "relatedProjectId"=$1::uuid WHERE "id"=$2::uuid',
      [ownedLegacyProjectId, ownedLegacyGoalId]
    );
    await dataSource.query(
      'UPDATE "timeline" SET "relatedGoalId"=$1::uuid, "relatedProjectId"=$2::uuid WHERE "id"=$3::uuid',
      [ownedLegacyGoalId, foreignLegacyProjectId, ownedTimelineIds[0]]
    );
    const foreignBefore = await dataSource.query(
      'SELECT row_to_json(g) AS "row" FROM "goal" g WHERE "id"=$1::uuid',
      [foreignLegacyGoalId]
    );
    const first = await capture();
    expect(first.end.sourceRowCounts?.legacyGoal).toBe(1);
    expect(first.end.sourceRowCounts?.legacyProject).toBe(1);
    expect(
      await dataSource.query(
        'SELECT "userId" FROM "goal" WHERE "id"=$1::uuid',
        [ownedLegacyGoalId]
      )
    ).toEqual([{ userId: ACCOUNT_ID.toUpperCase() }]);
    expect(
      await dataSource.query(
        'SELECT "userId" FROM "project" WHERE "id"=$1::uuid',
        [ownedLegacyProjectId]
      )
    ).toEqual([{ userId: ACCOUNT_ID.toUpperCase() }]);
    const reconstruct = (source: string, field: string) =>
      first.records
        .filter((row) => row.source === source && row.data.field === field)
        .sort((a, b) => Number(a.data.charOffset) - Number(b.data.charOffset))
        .map((row) => row.data.value)
        .join('');
    expect(reconstruct('legacyGoalText', 'name')).toBe(longName);
    expect(reconstruct('legacyProjectText', 'description')).toBe(
      longDescription
    );
    const goal = first.records.find((row) => row.source === 'legacyGoal')!.data;
    const project = first.records.find(
      (row) => row.source === 'legacyProject'
    )!.data;
    expect(goal).toMatchObject({
      id: ownedLegacyGoalId,
      name: { disposition: 'full-text-in-legacy-text-source' },
      target: -3,
      progress: 7,
      startDate: '2024-02-03 04:05:06.123456',
      endDate: null,
      relatedProfileId: { disposition: 'owned-reference', id: MIN_PROFILE_ID },
      relatedProjectId: {
        disposition: 'owned-reference',
        id: ownedLegacyProjectId,
      },
    });
    expect(project).toMatchObject({
      id: ownedLegacyProjectId,
      relatedProfileId: { disposition: 'redacted-unowned-reference' },
      timeLineEventsId: {
        disposition: 'owned-reference',
        id: ownedTimelineIds[0],
      },
      goalsId: { disposition: 'owned-reference', id: ownedLegacyGoalId },
    });
    const timeline = first.records.find(
      (row) => row.source === 'timeline' && row.data.id === ownedTimelineIds[0]
    )!.data;
    expect(timeline.relatedGoalId).toEqual({
      disposition: 'owned-reference',
      id: ownedLegacyGoalId,
    });
    expect(timeline.relatedProjectId).toEqual({
      disposition: 'redacted-unowned-reference',
    });
    expect(JSON.stringify(first.records)).not.toContain(foreignLegacyGoalId);
    expect(JSON.stringify(first.records)).not.toContain(foreignLegacyProjectId);
    expect(JSON.stringify(first.records)).not.toContain(FOREIGN_PROFILE_ID);
    expect(
      await dataSource.query(
        'SELECT row_to_json(g) AS "row" FROM "goal" g WHERE "id"=$1::uuid',
        [foreignLegacyGoalId]
      )
    ).toEqual(foreignBefore);
  }, 60_000);
});

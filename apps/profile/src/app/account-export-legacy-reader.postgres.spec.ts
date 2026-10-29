import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import loadDatabase from './loadDatabase';
import {
  ProfileAccountExportLegacyReader,
  ProfileAccountExportLegacyRecord,
} from './account-export-legacy-reader';
import { Profile } from '../profiles/entities/profile.entity';

const DB_NAME = 'profile_owner_j5_fixture';
const enabled =
  process.env.PROFILE_OWNER_PG_OPT_IN === DB_NAME &&
  process.env.PROFILE_OWNER_PG_NAME === DB_NAME &&
  process.env.PROFILE_OWNER_PG_HOST === '127.0.0.1' &&
  process.env.PROFILE_OWNER_PG_PORT === '15549' &&
  process.env.PROFILE_OWNER_PG_USER === 'owner_fixture' &&
  typeof process.env.PROFILE_OWNER_PG_PASSWORD === 'string' &&
  process.env.PROFILE_OWNER_PG_PASSWORD.length > 0;

const ACCOUNT_ID = '7f4a3b2c-6d5e-4f01-8a9b-1234567890ab';
const FOREIGN_ID = '9c9e2b0a-7a74-4cda-a0cf-13f8fc89922a';
const MIN_GOAL_ID = '00000000-0000-0000-0000-000000000000';
const MIN_PROJECT_ID = '00000000-0000-0000-0000-000000000001';
const OWNED_PROFILE_ID = '00000000-0000-0000-0000-000000000002';
const FOREIGN_PROFILE_ID = '00000000-0000-0000-0000-000000000003';
const OWNED_TIMELINE_ID = '00000000-0000-0000-0000-000000000004';
const FOREIGN_TIMELINE_ID = '00000000-0000-0000-0000-000000000005';
const FOREIGN_GOAL_ID = '00000000-0000-0000-0000-000000000006';
const FOREIGN_PROJECT_ID = '00000000-0000-0000-0000-000000000007';

type Row = Record<string, any>;
type Captured = Record<
  'legacyGoalText' | 'legacyGoal' | 'legacyProjectText' | 'legacyProject',
  ProfileAccountExportLegacyRecord[]
>;

const describePg = enabled ? describe : describe.skip;

describePg('Profile legacy goal/project reader PostgreSQL snapshot', () => {
  let dataSource: DataSource;
  const goalIds: string[] = [MIN_GOAL_ID];
  const projectIds: string[] = [MIN_PROJECT_ID];

  const insertBatch = async (
    table: 'goal' | 'project',
    columns: readonly string[],
    rows: unknown[][]
  ): Promise<void> => {
    for (let offset = 0; offset < rows.length; offset += 200) {
      const page = rows.slice(offset, offset + 200);
      const values: unknown[] = [];
      const tuples = page.map((row) => {
        const placeholders = row.map((value) => {
          values.push(value);
          return `$${values.length}`;
        });
        return `(${placeholders.join(', ')})`;
      });
      await dataSource.query(
        `INSERT INTO "${table}" (${columns
          .map((column) => `"${column}"`)
          .join(', ')}) VALUES ${tuples.join(', ')}`,
        values
      );
    }
  };

  const fingerprint = async (): Promise<unknown> => {
    const [goals] = await dataSource.query(
      `SELECT md5(coalesce(string_agg(md5(row_to_json(g)::text), '' ORDER BY g."id"::text), '')) AS "hash" FROM "goal" g WHERE g."userId" = ANY($1::varchar[])`,
      [[ACCOUNT_ID, FOREIGN_ID]]
    );
    const [projects] = await dataSource.query(
      `SELECT md5(coalesce(string_agg(md5(row_to_json(p)::text), '' ORDER BY p."id"::text), '')) AS "hash" FROM "project" p WHERE p."userId" = ANY($1::varchar[])`,
      [[ACCOUNT_ID, FOREIGN_ID]]
    );
    return { goals: goals.hash, projects: projects.hash };
  };

  beforeAll(async () => {
    dataSource = new DataSource({
      ...loadDatabase({
        get: () => ({
          host: process.env.PROFILE_OWNER_PG_HOST,
          port: Number(process.env.PROFILE_OWNER_PG_PORT),
          username: process.env.PROFILE_OWNER_PG_USER,
          password: process.env.PROFILE_OWNER_PG_PASSWORD,
          database: process.env.PROFILE_OWNER_PG_NAME,
        }),
      } as never),
      synchronize: false,
      migrationsRun: false,
      logging: false,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();

    await dataSource.getRepository(Profile).insert([
      {
        id: OWNED_PROFILE_ID,
        userId: ACCOUNT_ID,
        appScope: 'legacy-owned-profile',
        profileName: 'legacy owned profile',
        profilePic: '',
        coverPic: '',
        bio: '',
        location: '',
        occupation: '',
        interests: '',
        skills: '',
      },
      {
        id: FOREIGN_PROFILE_ID,
        userId: FOREIGN_ID,
        appScope: 'legacy-foreign-profile',
        profileName: 'legacy foreign profile',
        profilePic: '',
        coverPic: '',
        bio: '',
        location: '',
        occupation: '',
        interests: '',
        skills: '',
      },
    ] as any);
    await dataSource.query(
      `INSERT INTO "timeline" ("id", "userId", "title", "description", "eventType") VALUES ($1, $2, 'owned timeline', 'fixture', 'Posted'), ($3, $4, 'foreign timeline', 'fixture', 'Posted')`,
      [OWNED_TIMELINE_ID, ACCOUNT_ID, FOREIGN_TIMELINE_ID, FOREIGN_ID]
    );

    const longGoalName = `goal-start-${'😀漢字'.repeat(900)}-goal-end`;
    const longProjectDescription = `project-start-${'🧭é'.repeat(
      1600
    )}-project-end`;
    const goals = Array.from({ length: 1006 }, (_, index) => {
      const id = index === 0 ? MIN_GOAL_ID : randomUUID();
      if (index > 0) goalIds.push(id);
      return [
        id,
        index === 0 ? longGoalName : `goal-${index}`,
        index === 0 ? 'goal-description' : 'description',
        index === 0 ? -13 : index,
        index === 0 ? -22 : 0,
        ACCOUNT_ID,
        index === 0 ? '2024-03-04 05:06:07.123456' : '2024-01-01 00:00:00',
        null,
        index === 0,
        index === 0 ? '2024-03-05 06:07:08.654321' : '2024-01-02 00:00:00',
        null,
        null,
      ];
    });
    await insertBatch(
      'goal',
      [
        'id',
        'name',
        'description',
        'target',
        'progress',
        'userId',
        'startDate',
        'endDate',
        'completed',
        'created_at',
        'relatedProfileId',
        'relatedProjectId',
      ],
      goals
    );

    const projects = Array.from({ length: 1006 }, (_, index) => {
      const id = index === 0 ? MIN_PROJECT_ID : randomUUID();
      if (index > 0) projectIds.push(id);
      return [
        id,
        index === 0 ? 'minimum project' : `project-${index}`,
        index === 0 ? longProjectDescription : 'description',
        ACCOUNT_ID,
        index === 0 ? '2024-04-06 07:08:09.123456' : '2024-01-02 00:00:00',
        null,
        null,
        null,
      ];
    });
    await insertBatch(
      'project',
      [
        'id',
        'name',
        'description',
        'userId',
        'created_at',
        'relatedProfileId',
        'timeLineEventsId',
        'goalsId',
      ],
      projects
    );
    await dataSource.query(
      `INSERT INTO "goal" ("id", "name", "description", "target", "progress", "userId", "startDate") VALUES ($1, 'foreign goal', 'fixture', 1, 0, $2, CURRENT_TIMESTAMP)`,
      [FOREIGN_GOAL_ID, FOREIGN_ID]
    );
    await dataSource.query(
      `INSERT INTO "project" ("id", "name", "description", "userId") VALUES ($1, 'foreign project', 'fixture', $2)`,
      [FOREIGN_PROJECT_ID, FOREIGN_ID]
    );
    await dataSource.query(
      `UPDATE "goal" SET "relatedProfileId"=$1::uuid, "relatedProjectId"=$2::uuid WHERE "id"=$3::uuid`,
      [FOREIGN_PROFILE_ID, FOREIGN_PROJECT_ID, FOREIGN_GOAL_ID]
    );
    await dataSource.query(
      `UPDATE "project" SET "relatedProfileId"=$1::uuid, "timeLineEventsId"=$2::uuid, "goalsId"=$3::uuid WHERE "id"=$4::uuid`,
      [
        FOREIGN_PROFILE_ID,
        FOREIGN_TIMELINE_ID,
        FOREIGN_GOAL_ID,
        FOREIGN_PROJECT_ID,
      ]
    );
    await dataSource.query(
      `UPDATE "goal" SET "relatedProfileId"=$1::uuid, "relatedProjectId"=$2::uuid WHERE "id"=$3::uuid`,
      [OWNED_PROFILE_ID, MIN_PROJECT_ID, MIN_GOAL_ID]
    );
    await dataSource.query(
      `UPDATE "project" SET "relatedProfileId"=$1::uuid, "timeLineEventsId"=$2::uuid, "goalsId"=$3::uuid WHERE "id"=$4::uuid`,
      [OWNED_PROFILE_ID, OWNED_TIMELINE_ID, MIN_GOAL_ID, MIN_PROJECT_ID]
    );
    await dataSource.query(
      `UPDATE "goal" SET "relatedProfileId"=$1::uuid, "relatedProjectId"=$2::uuid WHERE "id"=$3::uuid`,
      [FOREIGN_PROFILE_ID, FOREIGN_PROJECT_ID, goalIds[1]]
    );
    await dataSource.query(
      `UPDATE "project" SET "relatedProfileId"=$1::uuid, "timeLineEventsId"=$2::uuid, "goalsId"=$3::uuid WHERE "id"=$4::uuid`,
      [FOREIGN_PROFILE_ID, FOREIGN_TIMELINE_ID, FOREIGN_GOAL_ID, projectIds[1]]
    );
  }, 60_000);

  afterAll(async () => {
    if (!dataSource?.isInitialized) return;
    await dataSource.query(
      `UPDATE "project" SET "relatedProfileId"=NULL, "timeLineEventsId"=NULL, "goalsId"=NULL WHERE "userId"=ANY($1::varchar[])`,
      [[ACCOUNT_ID, FOREIGN_ID]]
    );
    await dataSource.query(
      `UPDATE "goal" SET "relatedProfileId"=NULL, "relatedProjectId"=NULL WHERE "userId"=ANY($1::varchar[])`,
      [[ACCOUNT_ID, FOREIGN_ID]]
    );
    await dataSource.query(
      `DELETE FROM "project" WHERE "userId"=ANY($1::varchar[])`,
      [[ACCOUNT_ID, FOREIGN_ID]]
    );
    await dataSource.query(
      `DELETE FROM "goal" WHERE "userId"=ANY($1::varchar[])`,
      [[ACCOUNT_ID, FOREIGN_ID]]
    );
    await dataSource.query(
      `DELETE FROM "timeline" WHERE "userId"=ANY($1::varchar[])`,
      [[ACCOUNT_ID, FOREIGN_ID]]
    );
    await dataSource.query(
      `DELETE FROM "profile" WHERE "userId"=ANY($1::varchar[])`,
      [[ACCOUNT_ID, FOREIGN_ID]]
    );
    await dataSource.destroy();
  }, 30_000);

  it('streams every owned row, all text, and only owned circular references without mutating rows', async () => {
    const before = await fingerprint();
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction('REPEATABLE READ');
    await runner.query('SET TRANSACTION READ ONLY');
    try {
      const reader = new ProfileAccountExportLegacyReader(
        ACCOUNT_ID,
        (sql, parameters) => runner.query(sql, parameters)
      );
      const captured: Captured = {
        legacyGoalText: [],
        legacyGoal: [],
        legacyProjectText: [],
        legacyProject: [],
      };
      for await (const record of reader.legacyGoalTextRows())
        captured.legacyGoalText.push(record);
      for await (const record of reader.legacyGoalRows())
        captured.legacyGoal.push(record);
      for await (const record of reader.legacyProjectTextRows())
        captured.legacyProjectText.push(record);
      for await (const record of reader.legacyProjectRows())
        captured.legacyProject.push(record);
      await runner.commitTransaction();

      expect(captured.legacyGoal).toHaveLength(1006);
      expect(captured.legacyProject).toHaveLength(1006);
      expect(captured.legacyGoal[0].data.id).toBe(MIN_GOAL_ID);
      expect(captured.legacyProject[0].data.id).toBe(MIN_PROJECT_ID);
      const goalText = captured.legacyGoalText
        .filter(
          (record) =>
            record.data.goalId === MIN_GOAL_ID && record.data.field === 'name'
        )
        .sort(
          (left, right) =>
            Number(left.data.charOffset) - Number(right.data.charOffset)
        )
        .map((record) => record.data.value)
        .join('');
      expect(goalText).toBe(`goal-start-${'😀漢字'.repeat(900)}-goal-end`);
      const projectText = captured.legacyProjectText
        .filter(
          (record) =>
            record.data.projectId === MIN_PROJECT_ID &&
            record.data.field === 'description'
        )
        .sort(
          (left, right) =>
            Number(left.data.charOffset) - Number(right.data.charOffset)
        )
        .map((record) => record.data.value)
        .join('');
      expect(projectText).toBe(
        `project-start-${'🧭é'.repeat(1600)}-project-end`
      );

      const goal = captured.legacyGoal.find(
        (record) => record.data.id === MIN_GOAL_ID
      )!.data;
      expect(goal).toMatchObject({
        target: -13,
        progress: -22,
        startDate: '2024-03-04 05:06:07.123456',
        endDate: null,
        created_at: '2024-03-05 06:07:08.654321',
        relatedProfileId: {
          disposition: 'owned-reference',
          id: OWNED_PROFILE_ID,
        },
        relatedProjectId: {
          disposition: 'owned-reference',
          id: MIN_PROJECT_ID,
        },
      });
      const project = captured.legacyProject.find(
        (record) => record.data.id === MIN_PROJECT_ID
      )!.data;
      expect(project).toMatchObject({
        created_at: '2024-04-06 07:08:09.123456',
        relatedProfileId: {
          disposition: 'owned-reference',
          id: OWNED_PROFILE_ID,
        },
        timeLineEventsId: {
          disposition: 'owned-reference',
          id: OWNED_TIMELINE_ID,
        },
        goalsId: { disposition: 'owned-reference', id: MIN_GOAL_ID },
      });
      const foreignGoal = captured.legacyGoal.find(
        (record) => record.data.id === goalIds[1]
      )!.data;
      const foreignProject = captured.legacyProject.find(
        (record) => record.data.id === projectIds[1]
      )!.data;
      expect(foreignGoal.relatedProfileId).toEqual({
        disposition: 'redacted-unowned-reference',
      });
      expect(foreignGoal.relatedProjectId).toEqual({
        disposition: 'redacted-unowned-reference',
      });
      expect(foreignProject.relatedProfileId).toEqual({
        disposition: 'redacted-unowned-reference',
      });
      expect(foreignProject.timeLineEventsId).toEqual({
        disposition: 'redacted-unowned-reference',
      });
      expect(foreignProject.goalsId).toEqual({
        disposition: 'redacted-unowned-reference',
      });
      expect(JSON.stringify(captured)).not.toContain(FOREIGN_ID);
      expect(JSON.stringify(captured)).not.toContain(FOREIGN_PROFILE_ID);
      expect(JSON.stringify(captured)).not.toContain(FOREIGN_GOAL_ID);
      expect(JSON.stringify(captured)).not.toContain(FOREIGN_PROJECT_ID);
      expect(await fingerprint()).toEqual(before);
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }, 60_000);
});

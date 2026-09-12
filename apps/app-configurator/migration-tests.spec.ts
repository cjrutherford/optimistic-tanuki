import { AddRelease1768774571173 } from './migrations/1768774571173-add-release';
import { AddAppWorkspaceMembershipPersistence1787777120328 } from './migrations/1787777120328-add-app-workspace-membership-persistence';

describe('AddRelease1768774571173', () => {
  it('adds the release column with an empty JSON object default', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new AddRelease1768774571173();

    await migration.up({ query } as any);

    expect(query).toHaveBeenCalledWith(
      `ALTER TABLE "app_configuration_entity" ADD COLUMN IF NOT EXISTS "release" jsonb NOT NULL DEFAULT '{}'`
    );
  });

  it('does not fail where the column is already present', async () => {
    // The reason for IF NOT EXISTS, kept as an assertion rather than a
    // comment: this column reached some databases without the migration
    // being recorded, and the bare ALTER then failed with 42701. Because
    // setup-and-migrate runs under `set -e`, that took down the whole loop
    // and every app after this one silently went unmigrated.
    const query = jest.fn().mockResolvedValue(undefined);

    await new AddRelease1768774571173().up({ query } as any);

    expect(query.mock.calls[0][0]).toContain('IF NOT EXISTS');
  });
});

describe('AddAppWorkspaceMembershipPersistence1787777120328', () => {
  async function runUp(): Promise<string[]> {
    const query = jest.fn().mockResolvedValue(undefined);
    await new AddAppWorkspaceMembershipPersistence1787777120328().up({
      query,
    } as any);
    return query.mock.calls.map(([sql]) => sql as string);
  }

  async function runDown(): Promise<string[]> {
    const query = jest.fn().mockResolvedValue(undefined);
    await new AddAppWorkspaceMembershipPersistence1787777120328().down({
      query,
    } as any);
    return query.mock.calls.map(([sql]) => sql as string);
  }

  it('alters the existing configuration table and guards rows with no proven backfill', async () => {
    const queries = await runUp();

    expect(queries).not.toContainEqual(
      expect.stringMatching(/CREATE TABLE "app_configuration_entity"/)
    );
    expect(queries).not.toContainEqual(
      expect.stringMatching(/DELETE FROM "app_configuration_entity"/)
    );
    expect(queries).not.toContainEqual(
      expect.stringMatching(/DROP TABLE "app_configuration_entity"/)
    );
    expect(queries).toContain(
      `ALTER TABLE "app_configuration_entity" ADD "workspaceId" uuid`
    );
    expect(queries).toContain(
      `ALTER TABLE "app_configuration_entity" ADD "appInstanceId" uuid`
    );
    expect(queries).toContainEqual(
      expect.stringMatching(
        /DO \$\$[\s\S]*IF EXISTS \(SELECT 1 FROM "app_configuration_entity"\)[\s\S]*RAISE EXCEPTION[\s\S]*END[\s\S]*\$\$/
      )
    );
    expect(queries).toContain(
      `ALTER TABLE "app_configuration_entity" ALTER COLUMN "workspaceId" SET NOT NULL`
    );
    expect(queries).toContain(
      `ALTER TABLE "app_configuration_entity" ALTER COLUMN "appInstanceId" SET NOT NULL`
    );
  });

  it('creates the persistence tables with required uniqueness and scoped app-instance foreign keys', async () => {
    const queries = await runUp();

    expect(queries).toContainEqual(
      expect.stringMatching(
        /CREATE TABLE "app_instances"[\s\S]*"workspaceId" uuid NOT NULL[\s\S]*"appScope" character varying\(128\) NOT NULL[\s\S]*"ownerUserId" uuid NOT NULL[\s\S]*"ownerProfileId" uuid NOT NULL/
      )
    );
    expect(queries).toContainEqual(
      expect.stringMatching(
        /CREATE UNIQUE INDEX "IDX_879d6ee5f16a2628ff4ec4a5c9" ON "app_instances" \("workspaceId"\)/
      )
    );
    expect(queries).toContainEqual(
      expect.stringMatching(
        /CREATE UNIQUE INDEX "IDX_app_instances_id_workspace_scope" ON "app_instances" \("id", "workspaceId", "appScope"\)/
      )
    );
    expect(queries).toContainEqual(
      expect.stringMatching(
        /CREATE TABLE "app_memberships"[\s\S]*"appInstanceId" uuid NOT NULL[\s\S]*"profileId" uuid NOT NULL[\s\S]*"role"[\s\S]*"status"/
      )
    );
    expect(queries).toContainEqual(
      expect.stringMatching(
        /CREATE UNIQUE INDEX "IDX_40e9c65466c3d7a1aa1646662d" ON "app_memberships" \("appInstanceId", "profileId"\)/
      )
    );
    expect(queries).toContainEqual(
      expect.stringMatching(
        /ALTER TABLE "app_configuration_entity" ADD CONSTRAINT "FK_app_configuration_app_instance_workspace_scope" FOREIGN KEY \("appInstanceId", "workspaceId", "appScope"\) REFERENCES "app_instances"\("id", "workspaceId", "appScope"\)/
      )
    );
    expect(queries).toContainEqual(
      expect.stringMatching(
        /ALTER TABLE "app_memberships" ADD CONSTRAINT "FK_app_memberships_app_instance_workspace_scope" FOREIGN KEY \("appInstanceId", "workspaceId", "appScope"\) REFERENCES "app_instances"\("id", "workspaceId", "appScope"\)/
      )
    );
  });

  it('replaces the superseded legacy uniqueness before adding app-instance uniqueness', async () => {
    const queries = await runUp();

    const legacyIndexDrop = queries.findIndex((query) =>
      query.includes(
        'DROP INDEX IF EXISTS "public"."IDX_f6771ab0886aff763b7e173ccb"'
      )
    );
    const appInstanceIndexCreate = queries.findIndex((query) =>
      query.includes('CREATE UNIQUE INDEX "IDX_73a8b814fb1c59169b84fa1f36"')
    );

    expect(legacyIndexDrop).toBeGreaterThanOrEqual(0);
    expect(appInstanceIndexCreate).toBeGreaterThan(legacyIndexDrop);
  });

  it('reverses the originally applied single-column-FK variant idempotently', async () => {
    const queries = await runDown();

    expect(queries).not.toContainEqual(
      expect.stringMatching(/DROP TABLE "app_configuration_entity"/)
    );
    expect(queries).toContain(
      `ALTER TABLE "app_configuration_entity" DROP COLUMN IF EXISTS "appInstanceId"`
    );
    expect(queries).toContain(
      `ALTER TABLE "app_configuration_entity" DROP COLUMN IF EXISTS "workspaceId"`
    );
    expect(queries).toContainEqual(
      expect.stringMatching(
        /ALTER TABLE "app_configuration_entity" DROP CONSTRAINT IF EXISTS "FK_e195bb27eb70238a7b338fbef6d"/
      )
    );
    expect(queries).toContainEqual(
      expect.stringMatching(
        /ALTER TABLE "app_memberships" DROP CONSTRAINT IF EXISTS "FK_831025e72d021fba304e9f59557"/
      )
    );
    expect(queries).toContainEqual(
      expect.stringMatching(
        /DROP INDEX IF EXISTS "public"\."IDX_73a8b814fb1c59169b84fa1f36"/
      )
    );
    expect(queries).toContainEqual(
      expect.stringMatching(
        /DROP INDEX IF EXISTS "public"\."IDX_40e9c65466c3d7a1aa1646662d"/
      )
    );
  });

  it('also drops corrected composite-FK names before indexes, columns, tables, and types', async () => {
    const queries = await runDown();

    expect(queries).toContainEqual(
      expect.stringMatching(
        /ALTER TABLE "app_configuration_entity" DROP CONSTRAINT IF EXISTS "FK_app_configuration_app_instance_workspace_scope"/
      )
    );
    expect(queries).toContainEqual(
      expect.stringMatching(
        /ALTER TABLE "app_memberships" DROP CONSTRAINT IF EXISTS "FK_app_memberships_app_instance_workspace_scope"/
      )
    );
    expect(queries).toContainEqual(
      expect.stringMatching(
        /DROP INDEX IF EXISTS "public"\."IDX_app_instances_id_workspace_scope"/
      )
    );
    expect(queries).toContainEqual(
      expect.stringMatching(/DROP TABLE IF EXISTS "app_memberships"/)
    );
    expect(queries).toContainEqual(
      expect.stringMatching(
        /DROP TYPE IF EXISTS "public"\."app_memberships_status_enum"/
      )
    );
    expect(queries).toContainEqual(
      expect.stringMatching(
        /DROP TYPE IF EXISTS "public"\."app_instances_status_enum"/
      )
    );

    const indexDrop = queries.findIndex((query) =>
      query.includes('DROP INDEX IF EXISTS')
    );
    const membershipTableDrop = queries.findIndex((query) =>
      query.includes('DROP TABLE IF EXISTS "app_memberships"')
    );
    const instancesTableDrop = queries.findIndex((query) =>
      query.includes('DROP TABLE IF EXISTS "app_instances"')
    );
    const membershipTypeDrop = queries.findIndex((query) =>
      query.includes(
        'DROP TYPE IF EXISTS "public"."app_memberships_status_enum"'
      )
    );
    const instancesTypeDrop = queries.findIndex((query) =>
      query.includes('DROP TYPE IF EXISTS "public"."app_instances_status_enum"')
    );

    expect(indexDrop).toBeGreaterThanOrEqual(0);
    expect(indexDrop).toBeLessThan(membershipTableDrop);
    expect(membershipTableDrop).toBeLessThan(instancesTableDrop);
    expect(instancesTableDrop).toBeLessThan(instancesTypeDrop);
    expect(membershipTypeDrop).toBeLessThan(instancesTableDrop);
  });

  it('restores the exact legacy owner-scoped uniqueness after removing P2 columns and index', async () => {
    const queries = await runDown();

    const newIndexDrop = queries.findIndex((query) =>
      query.includes(
        'DROP INDEX IF EXISTS "public"."IDX_73a8b814fb1c59169b84fa1f36"'
      )
    );
    const appInstanceColumnDrop = queries.findIndex((query) =>
      query.includes('DROP COLUMN IF EXISTS "appInstanceId"')
    );
    const workspaceColumnDrop = queries.findIndex((query) =>
      query.includes('DROP COLUMN IF EXISTS "workspaceId"')
    );
    const legacyIndexCreate = queries.findIndex((query) =>
      query.includes(
        'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_f6771ab0886aff763b7e173ccb" ON "app_configuration_entity" ("ownerProfileId", "appScope", "name")'
      )
    );

    expect(legacyIndexCreate).toBeGreaterThan(newIndexDrop);
    expect(legacyIndexCreate).toBeGreaterThan(appInstanceColumnDrop);
    expect(legacyIndexCreate).toBeGreaterThan(workspaceColumnDrop);
  });

  it('keeps the corrected composite-FK names in the rollback shape', async () => {
    const queries = await runDown();

    expect(queries).toContainEqual(
      expect.stringMatching(
        /ALTER TABLE "app_configuration_entity" DROP CONSTRAINT IF EXISTS "FK_app_configuration_app_instance_workspace_scope"/
      )
    );
    expect(queries).toContainEqual(
      expect.stringMatching(
        /ALTER TABLE "app_memberships" DROP CONSTRAINT IF EXISTS "FK_app_memberships_app_instance_workspace_scope"/
      )
    );
    expect(queries).toContainEqual(
      expect.stringMatching(/DROP TABLE IF EXISTS "app_memberships"/)
    );
    expect(queries).toContainEqual(
      expect.stringMatching(/DROP TABLE IF EXISTS "app_instances"/)
    );
  });
});

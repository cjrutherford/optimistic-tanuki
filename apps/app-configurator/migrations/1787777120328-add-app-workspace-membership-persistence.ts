import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppWorkspaceMembershipPersistence1787777120328
  implements MigrationInterface
{
  name = 'AddAppWorkspaceMembershipPersistence1787777120328';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `LOCK TABLE "app_configuration_entity" IN SHARE ROW EXCLUSIVE MODE`
    );
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" ADD "workspaceId" uuid`
    );
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" ADD "appInstanceId" uuid`
    );
    await queryRunner.query(`
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "app_configuration_entity") THEN
    RAISE EXCEPTION 'Cannot backfill workspaceId/appInstanceId for existing app configurations without proven ownership semantics';
  END IF;
END
$$`);
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" ALTER COLUMN "workspaceId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" ALTER COLUMN "appInstanceId" SET NOT NULL`
    );

    await queryRunner.query(
      `CREATE TYPE "public"."app_instances_status_enum" AS ENUM('pending', 'active', 'suspended', 'revoked')`
    );
    await queryRunner.query(
      `CREATE TABLE "app_instances" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "appScope" character varying(128) NOT NULL, "ownerUserId" uuid NOT NULL, "ownerProfileId" uuid NOT NULL, "status" "public"."app_instances_status_enum" NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a7ed311777a5775a699fa69dc6d" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_879d6ee5f16a2628ff4ec4a5c9" ON "app_instances" ("workspaceId")`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_app_instances_id_workspace_scope" ON "app_instances" ("id", "workspaceId", "appScope")`
    );

    await queryRunner.query(
      `CREATE TYPE "public"."app_memberships_role_enum" AS ENUM('owner', 'admin', 'moderator', 'member')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."app_memberships_status_enum" AS ENUM('pending', 'active', 'suspended', 'revoked')`
    );
    await queryRunner.query(
      `CREATE TABLE "app_memberships" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "appInstanceId" uuid NOT NULL, "appScope" character varying(128) NOT NULL, "userId" uuid NOT NULL, "profileId" uuid NOT NULL, "role" "public"."app_memberships_role_enum" NOT NULL DEFAULT 'member', "status" "public"."app_memberships_status_enum" NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d48e557a1c6a31e2288925e4cee" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_40e9c65466c3d7a1aa1646662d" ON "app_memberships" ("appInstanceId", "profileId")`
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_f6771ab0886aff763b7e173ccb"`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_73a8b814fb1c59169b84fa1f36" ON "app_configuration_entity" ("appInstanceId", "name")`
    );
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" ADD CONSTRAINT "FK_app_configuration_app_instance_workspace_scope" FOREIGN KEY ("appInstanceId", "workspaceId", "appScope") REFERENCES "app_instances"("id", "workspaceId", "appScope") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "app_memberships" ADD CONSTRAINT "FK_app_memberships_app_instance_workspace_scope" FOREIGN KEY ("appInstanceId", "workspaceId", "appScope") REFERENCES "app_instances"("id", "workspaceId", "appScope") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "app_memberships" DROP CONSTRAINT IF EXISTS "FK_831025e72d021fba304e9f59557"`
    );
    await queryRunner.query(
      `ALTER TABLE "app_memberships" DROP CONSTRAINT IF EXISTS "FK_app_memberships_app_instance_workspace_scope"`
    );
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" DROP CONSTRAINT IF EXISTS "FK_e195bb27eb70238a7b338fbef6d"`
    );
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" DROP CONSTRAINT IF EXISTS "FK_app_configuration_app_instance_workspace_scope"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_73a8b814fb1c59169b84fa1f36"`
    );
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" DROP COLUMN IF EXISTS "appInstanceId"`
    );
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" DROP COLUMN IF EXISTS "workspaceId"`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_f6771ab0886aff763b7e173ccb" ON "app_configuration_entity" ("ownerProfileId", "appScope", "name")`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_40e9c65466c3d7a1aa1646662d"`
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "app_memberships"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."app_memberships_status_enum"`
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."app_memberships_role_enum"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_879d6ee5f16a2628ff4ec4a5c9"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_app_instances_id_workspace_scope"`
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "app_instances"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."app_instances_status_enum"`
    );
  }
}

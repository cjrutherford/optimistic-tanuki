import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppAccessPolicy1788886797394 implements MigrationInterface {
  name = 'AddAppAccessPolicy1788886797394';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" DROP CONSTRAINT "FK_app_configuration_app_instance_workspace_scope"`
    );
    await queryRunner.query(
      `ALTER TABLE "app_memberships" DROP CONSTRAINT "FK_app_memberships_app_instance_workspace_scope"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_app_instances_id_workspace_scope"`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."app_configuration_entity_accesspolicy_enum" AS ENUM('public', 'joinable', 'request-only', 'private')`
    );
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" ADD "accessPolicy" "public"."app_configuration_entity_accesspolicy_enum" NOT NULL DEFAULT 'public'`
    );
    await queryRunner.query(
      `ALTER TYPE "public"."app_memberships_status_enum" RENAME TO "app_memberships_status_enum_old"`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."app_memberships_status_enum" AS ENUM('pending', 'active', 'denied', 'suspended', 'revoked')`
    );
    await queryRunner.query(
      `ALTER TABLE "app_memberships" ALTER COLUMN "status" DROP DEFAULT`
    );
    await queryRunner.query(
      `ALTER TABLE "app_memberships" ALTER COLUMN "status" TYPE "public"."app_memberships_status_enum" USING "status"::"text"::"public"."app_memberships_status_enum"`
    );
    await queryRunner.query(
      `ALTER TABLE "app_memberships" ALTER COLUMN "status" SET DEFAULT 'pending'`
    );
    await queryRunner.query(
      `DROP TYPE "public"."app_memberships_status_enum_old"`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_7eab2231eb529d834b9518b103" ON "app_instances" ("id", "workspaceId", "appScope") `
    );
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" ADD CONSTRAINT "FK_6dd7b952a83b50efdbf26a7019f" FOREIGN KEY ("appInstanceId", "workspaceId", "appScope") REFERENCES "app_instances"("id","workspaceId","appScope") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "app_memberships" ADD CONSTRAINT "FK_8d1426b7387545e56d3cc4b06e6" FOREIGN KEY ("appInstanceId", "workspaceId", "appScope") REFERENCES "app_instances"("id","workspaceId","appScope") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const deniedMemberships = await queryRunner.query(
      `SELECT COUNT(*)::int AS "count" FROM "app_memberships" WHERE "status" = 'denied'`
    );
    if (Number(deniedMemberships[0]?.count ?? 0) > 0) {
      throw new Error(
        'Cannot revert app access policy migration while denied memberships exist'
      );
    }
    await queryRunner.query(
      `ALTER TABLE "app_memberships" DROP CONSTRAINT "FK_8d1426b7387545e56d3cc4b06e6"`
    );
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" DROP CONSTRAINT "FK_6dd7b952a83b50efdbf26a7019f"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7eab2231eb529d834b9518b103"`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."app_memberships_status_enum_old" AS ENUM('pending', 'active', 'suspended', 'revoked')`
    );
    await queryRunner.query(
      `ALTER TABLE "app_memberships" ALTER COLUMN "status" DROP DEFAULT`
    );
    await queryRunner.query(
      `ALTER TABLE "app_memberships" ALTER COLUMN "status" TYPE "public"."app_memberships_status_enum_old" USING "status"::"text"::"public"."app_memberships_status_enum_old"`
    );
    await queryRunner.query(
      `ALTER TABLE "app_memberships" ALTER COLUMN "status" SET DEFAULT 'pending'`
    );
    await queryRunner.query(`DROP TYPE "public"."app_memberships_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."app_memberships_status_enum_old" RENAME TO "app_memberships_status_enum"`
    );
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" DROP COLUMN "accessPolicy"`
    );
    await queryRunner.query(
      `DROP TYPE "public"."app_configuration_entity_accesspolicy_enum"`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_app_instances_id_workspace_scope" ON "app_instances" ("id", "workspaceId", "appScope") `
    );
    await queryRunner.query(
      `ALTER TABLE "app_memberships" ADD CONSTRAINT "FK_app_memberships_app_instance_workspace_scope" FOREIGN KEY ("appInstanceId", "workspaceId", "appScope") REFERENCES "app_instances"("id","workspaceId","appScope") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" ADD CONSTRAINT "FK_app_configuration_app_instance_workspace_scope" FOREIGN KEY ("appInstanceId", "workspaceId", "appScope") REFERENCES "app_instances"("id","workspaceId","appScope") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }
}

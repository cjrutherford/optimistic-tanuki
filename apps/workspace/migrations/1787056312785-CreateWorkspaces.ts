import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWorkspaces1787056312785 implements MigrationInterface {
  name = 'CreateWorkspaces1787056312785';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "workspaces" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "kind" character varying(32) NOT NULL, "slug" character varying(255) NOT NULL, "displayName" character varying(255) NOT NULL, "appScope" character varying(128) NOT NULL, "ownerUserId" uuid NOT NULL, "ownerProfileId" uuid NOT NULL, "status" character varying(32) NOT NULL DEFAULT 'draft', "sourceService" character varying(32) NOT NULL, "sourceId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_098656ae401f3e1a4586f47fd8e" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_17e3308126424d1b637070be22" ON "workspaces" ("sourceService", "sourceId") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_3744f12362802083441b5c70c8" ON "workspaces" ("kind", "slug") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3744f12362802083441b5c70c8"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_17e3308126424d1b637070be22"`
    );
    await queryRunner.query(`DROP TABLE "workspaces"`);
  }
}

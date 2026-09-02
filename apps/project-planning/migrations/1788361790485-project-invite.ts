import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectInvite1788361790485 implements MigrationInterface {
  name = 'ProjectInvite1788361790485';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "project_invite" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" character varying NOT NULL, "email" character varying NOT NULL, "invitedBy" character varying NOT NULL, "token" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'PENDING', "claimedBy" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "respondedAt" TIMESTAMP, CONSTRAINT "UQ_84aaf9061d8fce5017d54e36c64" UNIQUE ("token"), CONSTRAINT "PK_59d8ef464579bd0cfcb78e6b16b" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_941f586acb91003f59b6a64914" ON "project_invite" ("projectId", "email") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_941f586acb91003f59b6a64914"`
    );
    await queryRunner.query(`DROP TABLE "project_invite"`);
  }
}

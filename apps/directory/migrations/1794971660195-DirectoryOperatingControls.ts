import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryOperatingControls1794971660195
  implements MigrationInterface
{
  name = 'DirectoryOperatingControls1794971660195';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_operating_control" ("key" text NOT NULL, "paused" boolean NOT NULL DEFAULT false, "reason" text, "version" integer NOT NULL DEFAULT '1', "updatedBy" uuid, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_directory_operating_control_paused_reason" CHECK ("paused" = false OR ("reason" IS NOT NULL AND char_length(btrim("reason")) > 0)), CONSTRAINT "CHK_directory_operating_control_reason_length" CHECK ("reason" IS NULL OR char_length("reason") <= 500), CONSTRAINT "CHK_directory_operating_control_key" CHECK ("key" IN ('provider_acquisition','export_worker','taxonomy_worker')), CONSTRAINT "PK_b9da34ff804f459091e2e81f7ef" PRIMARY KEY ("key"))`
    );
    await queryRunner.query(
      `CREATE TABLE "directory_operating_control_event" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "key" text NOT NULL, "paused" boolean NOT NULL, "reason" text, "actorId" uuid, "previousVersion" integer NOT NULL, "at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_83c39e4048cba35f2bd44966499" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_operating_control_event_key" ON "directory_operating_control_event" ("key", "at") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_operating_control_event_key"`
    );
    await queryRunner.query(`DROP TABLE "directory_operating_control_event"`);
    await queryRunner.query(`DROP TABLE "directory_operating_control"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryDuplicateCases1795011346582
  implements MigrationInterface
{
  name = 'DirectoryDuplicateCases1795011346582';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_duplicate_case" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "communityId" uuid NOT NULL, "keptScanId" character varying(64) NOT NULL, "keptRow" bigint NOT NULL, "hiddenScanId" character varying(64) NOT NULL, "hiddenRow" bigint NOT NULL, "suppressionId" uuid, "rule" character varying(16) NOT NULL, "weakerBasis" character varying(16) NOT NULL, "distanceMeters" integer NOT NULL, "state" character varying(16) NOT NULL DEFAULT 'queued', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "decidedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_directory_duplicate_case_basis" CHECK ("weakerBasis" IN ('sources','confidence','fields','updated','order')), CONSTRAINT "CHK_directory_duplicate_case_rule" CHECK ("rule" IN ('same_name_near','similar_name')), CONSTRAINT "CHK_directory_duplicate_case_state" CHECK ("state" IN ('queued','kept_separate','merged')), CONSTRAINT "PK_e124d27e764475e32a03bc525da" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_directory_duplicate_case_pair" ON "directory_duplicate_case" ("communityId", "keptScanId", "keptRow", "hiddenScanId", "hiddenRow") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_duplicate_case_town_state" ON "directory_duplicate_case" ("communityId", "state") `
    );
    await queryRunner.query(
      `CREATE TABLE "directory_duplicate_case_event" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "caseId" uuid NOT NULL, "kind" character varying(16) NOT NULL, "actorId" uuid, "note" character varying(1024), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_directory_duplicate_case_event_kind" CHECK ("kind" IN ('queued','kept_separate','merged','undone')), CONSTRAINT "PK_28877296fdeb52a9525f8d84737" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_duplicate_case_event_case" ON "directory_duplicate_case_event" ("caseId", "createdAt") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_duplicate_case_event_case"`
    );
    await queryRunner.query(`DROP TABLE "directory_duplicate_case_event"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_duplicate_case_town_state"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_directory_duplicate_case_pair"`
    );
    await queryRunner.query(`DROP TABLE "directory_duplicate_case"`);
  }
}

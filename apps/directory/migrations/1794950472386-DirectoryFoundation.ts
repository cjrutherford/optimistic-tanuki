import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryFoundation1794950472386 implements MigrationInterface {
  // Generated against a freshly migrated scratch database. The generator also emitted uuid_generate_v4() -> gen_random_uuid()
  // id-default drift on unrelated tables; that was trimmed because this change does not touch those tables.
  name = 'DirectoryFoundation1794950472386';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_taxonomy_mapping_version" ("id" character varying(100) NOT NULL, "sourceHash" character(64) NOT NULL, "unmappedPolicy" character varying(16) NOT NULL DEFAULT 'keep_legacy', "active" boolean NOT NULL DEFAULT false, "installedById" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "activatedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_directory_taxonomy_mapping_unmapped" CHECK ("unmappedPolicy" IN ('keep_legacy','exclude')), CONSTRAINT "PK_57dcd58fe2d34e65b4e8e00b308" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_directory_taxonomy_mapping_active" ON "directory_taxonomy_mapping_version" ("active") WHERE "active" = true`
    );
    await queryRunner.query(
      `CREATE TABLE "directory_taxonomy_mapping_row" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "versionId" character varying(100) NOT NULL, "kind" character varying(16) NOT NULL, "overtureKey" character varying(200) NOT NULL, "categoryId" character varying(100), "placeTypeId" character varying(100), "excluded" boolean NOT NULL DEFAULT false, "exclusionReason" character varying(40), CONSTRAINT "CHK_directory_taxonomy_mapping_row_target" CHECK (("excluded" = true AND "categoryId" IS NULL AND "placeTypeId" IS NULL AND "exclusionReason" IS NOT NULL) OR ("excluded" = false AND "categoryId" IS NOT NULL AND "exclusionReason" IS NULL)), CONSTRAINT "CHK_directory_taxonomy_mapping_row_kind" CHECK ("kind" IN ('basic_category','taxonomy_node')), CONSTRAINT "PK_b6224f7ec4a449698f4983f336c" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_directory_taxonomy_mapping_row_key" ON "directory_taxonomy_mapping_row" ("versionId", "kind", "overtureKey") `
    );
    await queryRunner.query(
      `CREATE TABLE "directory_listing_classification" ("scanId" character varying(64) NOT NULL, "sourceFileRowNumber" bigint NOT NULL, "mappingVersion" character varying(100) NOT NULL, "categoryId" character varying(200), "placeTypeId" character varying(100), "basis" character varying(16) NOT NULL, "excluded" boolean NOT NULL DEFAULT false, "exclusionReason" character varying(40), "runId" uuid, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_directory_listing_classification_basis" CHECK ("basis" IN ('override','mapping','legacy')), CONSTRAINT "PK_a04a98bbb03b319c8ebbb4c29a5" PRIMARY KEY ("scanId", "sourceFileRowNumber"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_listing_classification_run" ON "directory_listing_classification" ("runId") `
    );
    await queryRunner.query(
      `CREATE TABLE "directory_listing_category_override" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "communityId" uuid NOT NULL, "listingKey" uuid NOT NULL, "categoryId" character varying(100) NOT NULL, "placeTypeId" character varying(100), "active" boolean NOT NULL DEFAULT true, "caseId" uuid, "eventId" uuid, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_907ac9c6a838870b3ada80438fc" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_directory_listing_category_override_key" ON "directory_listing_category_override" ("communityId", "listingKey") `
    );
    await queryRunner.query(
      `CREATE TABLE "directory_taxonomy_case" ("id" uuid NOT NULL, "communityId" uuid NOT NULL, "listingKey" uuid NOT NULL, "scanId" character varying(64) NOT NULL, "sourceFileRowNumber" bigint NOT NULL, "reason" character varying(24) NOT NULL, "name" character varying(2000) NOT NULL, "observedCategory" character varying(200) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'open', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_directory_taxonomy_case_reason" CHECK ("reason" IN ('operator_raised','unmapped_taxonomy','ambiguous_taxonomy')), CONSTRAINT "CHK_directory_taxonomy_case_status" CHECK ("status" IN ('open','assigned','rejected','deferred')), CONSTRAINT "PK_40cfd6225c79468e5357f706119" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_directory_taxonomy_case_open" ON "directory_taxonomy_case" ("communityId", "listingKey") WHERE "status" IN ('open','deferred')`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_taxonomy_case_status" ON "directory_taxonomy_case" ("status", "updatedAt") `
    );
    await queryRunner.query(
      `CREATE TABLE "directory_taxonomy_event" ("id" uuid NOT NULL, "caseId" uuid NOT NULL, "action" character varying(16) NOT NULL, "actorId" uuid, "reason" character varying(1024) NOT NULL, "categoryId" character varying(100), "placeTypeId" character varying(100), "statusBefore" character varying(16) NOT NULL, "statusAfter" character varying(16) NOT NULL, "overrideBefore" jsonb, "undoOf" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_directory_taxonomy_event_action" CHECK ("action" IN ('open','assign','reject','defer','reopen','undo')), CONSTRAINT "PK_f525a48b184b72838a02da3a1e2" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_directory_taxonomy_event_undo" ON "directory_taxonomy_event" ("undoOf") WHERE "undoOf" IS NOT NULL`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_taxonomy_event_case" ON "directory_taxonomy_event" ("caseId", "createdAt") `
    );
    await queryRunner.query(
      `CREATE TABLE "directory_taxonomy_run" ("id" uuid NOT NULL, "mappingVersion" character varying(100) NOT NULL, "scope" character varying(8) NOT NULL, "communityId" uuid, "mode" character varying(8) NOT NULL, "phase" character varying(12) NOT NULL DEFAULT 'plan', "status" character varying(16) NOT NULL DEFAULT 'pending', "actorId" uuid, "reason" character varying(1024) NOT NULL, "expectedPlanHash" character(64), "planHash" character(64), "planAccumulator" character(64), "cursorScanId" character varying(64), "cursorRow" bigint, "scannedRows" integer NOT NULL DEFAULT '0', "changedRows" integer NOT NULL DEFAULT '0', "appliedRows" integer NOT NULL DEFAULT '0', "restoredRows" integer NOT NULL DEFAULT '0', "attempts" integer NOT NULL DEFAULT '0', "summary" jsonb NOT NULL DEFAULT '{}', "lastError" character varying(512), "cancelRequested" boolean NOT NULL DEFAULT false, "canceledById" uuid, "cancelReason" character varying(1024), "rollbackById" uuid, "rollbackReason" character varying(1024), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "completedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_directory_taxonomy_run_town" CHECK (("scope" = 'town') = ("communityId" IS NOT NULL)), CONSTRAINT "CHK_directory_taxonomy_run_status" CHECK ("status" IN ('pending','running','complete','canceled','failed','rolling_back','rolled_back')), CONSTRAINT "CHK_directory_taxonomy_run_phase" CHECK ("phase" IN ('plan','apply','rollback')), CONSTRAINT "CHK_directory_taxonomy_run_mode" CHECK ("mode" IN ('dry_run','apply')), CONSTRAINT "CHK_directory_taxonomy_run_scope" CHECK ("scope" IN ('town','all')), CONSTRAINT "PK_592c654f584d72f725519b2ff75" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_taxonomy_run_status" ON "directory_taxonomy_run" ("status", "updatedAt") `
    );
    await queryRunner.query(
      `CREATE TABLE "directory_taxonomy_run_before" ("runId" uuid NOT NULL, "scanId" character varying(64) NOT NULL, "sourceFileRowNumber" bigint NOT NULL, "hadProjection" boolean NOT NULL, "before" jsonb, CONSTRAINT "PK_377883cb3192647796c25b2c465" PRIMARY KEY ("runId", "scanId", "sourceFileRowNumber"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "directory_taxonomy_run_before"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_taxonomy_run_status"`
    );
    await queryRunner.query(`DROP TABLE "directory_taxonomy_run"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_taxonomy_event_case"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_directory_taxonomy_event_undo"`
    );
    await queryRunner.query(`DROP TABLE "directory_taxonomy_event"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_taxonomy_case_status"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_directory_taxonomy_case_open"`
    );
    await queryRunner.query(`DROP TABLE "directory_taxonomy_case"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_directory_listing_category_override_key"`
    );
    await queryRunner.query(`DROP TABLE "directory_listing_category_override"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_listing_classification_run"`
    );
    await queryRunner.query(`DROP TABLE "directory_listing_classification"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_directory_taxonomy_mapping_row_key"`
    );
    await queryRunner.query(`DROP TABLE "directory_taxonomy_mapping_row"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_directory_taxonomy_mapping_active"`
    );
    await queryRunner.query(`DROP TABLE "directory_taxonomy_mapping_version"`);
  }
}

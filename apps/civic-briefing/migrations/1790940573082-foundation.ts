import { MigrationInterface, QueryRunner } from 'typeorm';

export class Foundation1790940573082 implements MigrationInterface {
  name = 'Foundation1790940573082';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "schema_meta" ("key" character varying NOT NULL, "value" character varying NOT NULL, CONSTRAINT "PK_844e699f1b8c86a40d805e4d032" PRIMARY KEY ("key"))`
    );
    await queryRunner.query(
      `CREATE TABLE "localities" ("slug" character varying NOT NULL, "name" character varying NOT NULL, "state" character varying NOT NULL, "timezone" character varying NOT NULL, "lat" real NOT NULL, "lon" real NOT NULL, "kind" character varying, "parents" text, "edition" boolean, "aliases" text, "ruleVersion" character varying, CONSTRAINT "PK_edfb2fa0139a5f9b1bb730d845f" PRIMARY KEY ("slug"))`
    );
    await queryRunner.query(
      `CREATE TABLE "sources" ("id" character varying NOT NULL, "sourceKey" character varying NOT NULL, "ownerSlug" character varying NOT NULL, "coverage" character varying NOT NULL, "adapter" character varying NOT NULL, "name" character varying NOT NULL, "url" character varying NOT NULL, "kind" character varying NOT NULL, "config" text, "enabled" boolean NOT NULL DEFAULT true, "desk" character varying, "accessMode" character varying, "accessRestrictionReason" text, "restrictionPolicyUrl" character varying, "aggregateDiscovery" boolean, "aggregateUrl" character varying, "coverageCapabilities" text, "observedAt" character varying, CONSTRAINT "UQ_901ae9bf0809d3e897b78367b77" UNIQUE ("sourceKey"), CONSTRAINT "PK_85523beafe5a2a6b90b02096443" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "quarantine" ("id" SERIAL NOT NULL, "targetType" character varying NOT NULL, "targetKey" character varying NOT NULL, "sourceId" character varying, "scopeSlug" character varying, "runId" character varying, "stage" character varying NOT NULL, "errorKind" character varying, "error" text NOT NULL, "retryable" boolean NOT NULL DEFAULT false, "payloadSha256" character varying, "payloadBytes" integer, "payloadRef" character varying, "createdAt" character varying NOT NULL, CONSTRAINT "PK_c1cbd36649a09294e417ae639fa" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_971a2d309f2c676782dc15ae0f" ON "quarantine" ("targetType", "targetKey") `
    );
    await queryRunner.query(
      `CREATE TABLE "fetch_ledger" ("id" SERIAL NOT NULL, "sourceId" character varying NOT NULL, "url" character varying NOT NULL, "lastAttemptAt" character varying, "lastSuccessAt" character varying, "lastChangedAt" character varying, "etag" character varying, "lastModified" character varying, "lastStatus" integer, "lastChecksum" character varying, "consecutiveFailures" integer NOT NULL DEFAULT '0', "lastError" text, "observedStart" character varying, "observedEnd" character varying, "coverageRange" text, CONSTRAINT "PK_81e48ec1d1381c633620fb59233" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_297d51975112d72acf604718bb" ON "fetch_ledger" ("sourceId", "url") `
    );
    await queryRunner.query(
      `CREATE TABLE "fetch_attempts" ("id" SERIAL NOT NULL, "sourceId" character varying NOT NULL, "url" character varying NOT NULL, "requestUrl" character varying NOT NULL, "attemptedAt" character varying NOT NULL, "status" integer, "outcome" character varying NOT NULL, "etag" character varying, "lastModified" character varying, "errorKind" character varying, "error" text, "retryable" boolean, "observedStart" character varying, "observedEnd" character varying, "coverageRange" text, CONSTRAINT "PK_cc1b290ae620dc674a2e7803ef0" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "raw_document_versions" ("id" SERIAL NOT NULL, "sourceId" character varying NOT NULL, "url" character varying NOT NULL, "checksum" character varying NOT NULL, "payloadKind" character varying NOT NULL, "body" text, "blobRef" text, "contentType" character varying NOT NULL, "fetchedAt" character varying NOT NULL, CONSTRAINT "PK_eff7646019dfea2f15e0b343c55" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a31aa13c4109a0e251eda5b81a" ON "raw_document_versions" ("sourceId", "url", "checksum") `
    );
    await queryRunner.query(
      `CREATE TABLE "raw_documents" ("id" SERIAL NOT NULL, "sourceId" character varying NOT NULL, "urlHash" character varying NOT NULL, "url" character varying NOT NULL, "contentType" character varying NOT NULL, "body" text, "checksum" character varying, "fetchedAt" character varying NOT NULL, "activeVersionId" integer, CONSTRAINT "UQ_8911b668e5710360927102c3880" UNIQUE ("urlHash"), CONSTRAINT "PK_6b12adcd023ef189e4f9134ffbd" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_5af0f0ba6a69ccac4f3eadd1cf" ON "raw_documents" ("sourceId", "url") `
    );
    await queryRunner.query(
      `CREATE TABLE "civic_items" ("id" SERIAL NOT NULL, "sourceId" character varying NOT NULL, "localitySlug" character varying NOT NULL, "scopeSlug" character varying, "scopeKind" character varying, "jurisdictionSlug" character varying, "geographyDecision" character varying, "geographyEvidence" text, "ruleVersion" character varying, "kind" character varying NOT NULL, "title" character varying NOT NULL, "body" text NOT NULL, "summary" text, "publishedAt" character varying, "eventDate" character varying, "topics" text, "uris" text, "hash" character varying NOT NULL, "createdAt" character varying NOT NULL, "originalSnippet" text, "publisher" character varying, "canonicalUrl" character varying, "articleProvenance" text, "contentChecksum" character varying, "caseId" character varying, "matterId" character varying, "permitId" character varying, "externalId" character varying, "entity" character varying, "action" character varying, "accessMode" character varying, "accessRestrictionReason" text, "restrictionPolicyUrl" character varying, "aggregateDiscovery" boolean, "aggregateUrl" character varying, "unresolvedAggregateLink" boolean, "observedAt" character varying, CONSTRAINT "UQ_3c353d34512ad4b9b8b04332667" UNIQUE ("hash"), CONSTRAINT "PK_6ceca0bb02da696d3c0f9b01f08" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c79127edf1c4f417aba18d7ab3" ON "civic_items" ("canonicalUrl") `
    );
    await queryRunner.query(
      `CREATE TABLE "edition_items" ("id" SERIAL NOT NULL, "localitySlug" character varying NOT NULL, "civicItemId" integer NOT NULL, "decision" character varying NOT NULL, "reason" character varying NOT NULL, "ruleVersion" character varying NOT NULL, "createdAt" character varying NOT NULL, CONSTRAINT "PK_876a4dc4c1cc5d5a69fe397f533" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_90b650bcd6c576dd9d3fe8b9ed" ON "edition_items" ("localitySlug", "civicItemId", "ruleVersion") `
    );
    await queryRunner.query(
      `CREATE TABLE "agenda_items" ("id" SERIAL NOT NULL, "itemId" integer NOT NULL, "localitySlug" character varying NOT NULL, "meetingDate" character varying, "section" character varying NOT NULL, "ordinal" integer NOT NULL, "heading" character varying NOT NULL, "body" text NOT NULL, "topicKey" character varying NOT NULL, "procedural" boolean NOT NULL DEFAULT false, "createdAt" character varying NOT NULL, CONSTRAINT "PK_7274c40301175b4b4b347820d0c" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "stories" ("id" SERIAL NOT NULL, "localitySlug" character varying NOT NULL, "threadKey" character varying NOT NULL, "title" character varying NOT NULL, "narrative" text NOT NULL, "timeline" text NOT NULL, "status" character varying, "meetings" text NOT NULL, "itemTitles" text NOT NULL, "model" character varying NOT NULL, "updatedAt" character varying NOT NULL, CONSTRAINT "PK_bb6f880b260ed96c452b32a39f0" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c5e2f71642be1daf84fe200a7a" ON "stories" ("localitySlug", "threadKey") `
    );
    await queryRunner.query(
      `CREATE TABLE "briefings" ("id" SERIAL NOT NULL, "localitySlug" character varying NOT NULL, "cadence" character varying NOT NULL, "periodStart" character varying NOT NULL, "periodEnd" character varying NOT NULL, "markdown" text NOT NULL, "itemIds" text NOT NULL, "model" character varying NOT NULL, "createdAt" character varying NOT NULL, "ruleVersion" character varying, "runId" integer, "briefingGenerationId" integer, "contextSince" character varying, "coverageRange" text, CONSTRAINT "PK_388798f424958f8c105d3b3d4b6" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "canonical_stories" ("id" SERIAL NOT NULL, "scopeSlug" character varying NOT NULL, "scopeKind" character varying NOT NULL, "storyKey" character varying NOT NULL, "strategy" character varying NOT NULL, "title" character varying NOT NULL, "status" character varying, "createdAt" character varying NOT NULL, "updatedAt" character varying NOT NULL, "currentRevisionId" integer, "lastEvidenceDate" character varying, CONSTRAINT "PK_688b1a64285e71b105dc6921be5" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_d3c121a33563370afc4b9f7b8a" ON "canonical_stories" ("scopeSlug", "scopeKind", "storyKey") `
    );
    await queryRunner.query(
      `CREATE TABLE "canonical_story_items" ("id" SERIAL NOT NULL, "canonicalStoryId" integer NOT NULL, "civicItemId" integer NOT NULL, "agendaItemId" integer, "evidenceDate" character varying, "matchReason" text, "matchScore" double precision, "createdAt" character varying NOT NULL, CONSTRAINT "PK_6ce58d17c84dac727cc52d5aaff" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_canonical_story_items_parent_identity" ON "canonical_story_items" ("canonicalStoryId", "civicItemId") WHERE "agendaItemId" IS NULL`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_canonical_story_items_agenda_identity" ON "canonical_story_items" ("canonicalStoryId", "civicItemId", "agendaItemId") WHERE "agendaItemId" IS NOT NULL`
    );
    await queryRunner.query(
      `CREATE TABLE "edition_stories" ("id" SERIAL NOT NULL, "localitySlug" character varying NOT NULL, "canonicalStoryId" integer NOT NULL, "ruleVersion" character varying NOT NULL, "createdAt" character varying NOT NULL, CONSTRAINT "PK_fdf4f98f615e62702aff2cd7c64" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_6dcce4b1abec4ad7ffa512a16b" ON "edition_stories" ("localitySlug", "canonicalStoryId", "ruleVersion") `
    );
    await queryRunner.query(
      `CREATE TABLE "pipeline_runs" ("id" SERIAL NOT NULL, "scopeSlug" character varying NOT NULL, "localitySlug" character varying NOT NULL, "cadence" character varying NOT NULL, "startedAt" character varying NOT NULL, "completedAt" character varying, "status" character varying NOT NULL, "currentStage" character varying, "ruleVersion" character varying NOT NULL, "counts" text NOT NULL, "coverageGaps" text NOT NULL, "error" text, "coverageRanges" text NOT NULL DEFAULT '{}', CONSTRAINT "PK_485786394df8fcdcbdbcdaedda3" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d45ffebe838f214d537e28c058" ON "pipeline_runs" ("scopeSlug", "cadence", "startedAt") `
    );
    await queryRunner.query(
      `CREATE TABLE "pipeline_stage_runs" ("id" SERIAL NOT NULL, "runId" integer NOT NULL, "stage" character varying NOT NULL, "startedAt" character varying NOT NULL, "completedAt" character varying, "status" character varying NOT NULL, "counts" text NOT NULL, "coverageGaps" text NOT NULL, "error" text, CONSTRAINT "PK_5aef2879ccfea3031b9b3550fb5" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_5c45b2f0cb5cec862504ac8959" ON "pipeline_stage_runs" ("runId", "stage") `
    );
    await queryRunner.query(
      `CREATE TABLE "pipeline_run_leases" ("id" SERIAL NOT NULL, "scopeSlug" character varying NOT NULL, "cadence" character varying NOT NULL, "ownerId" character varying NOT NULL, "runId" integer NOT NULL, "leaseUntil" character varying NOT NULL, "createdAt" character varying NOT NULL, "updatedAt" character varying NOT NULL, CONSTRAINT "PK_5ed0ac150aa336d802166fb8525" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_3c02683b241a5013b1bc3a7682" ON "pipeline_run_leases" ("scopeSlug", "cadence") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_df4b87a4123f45538f7c8b88a2" ON "pipeline_run_leases" ("leaseUntil") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7f76e83491907539f6763b5806" ON "pipeline_run_leases" ("runId") `
    );
    await queryRunner.query(
      `CREATE TABLE "llm_generations" ("id" SERIAL NOT NULL, "runId" integer NOT NULL, "localitySlug" character varying NOT NULL, "operation" character varying NOT NULL, "model" character varying NOT NULL, "status" character varying NOT NULL, "attempt" integer NOT NULL, "promptSha256" character varying NOT NULL, "inputSha256" character varying NOT NULL, "outputSha256" character varying, "sourceKeys" text NOT NULL, "output" text, "error" text, "generatedAt" character varying NOT NULL, "latencyMs" integer NOT NULL, "generationSettings" text, CONSTRAINT "CHK_72515179e9ff62e9593c426ade" CHECK ("operation" IN ('cluster', 'brief', 'story', 'agenda_fixup')), CONSTRAINT "PK_da2653935442096631e7f7d620a" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_87e88f2568375bfacbe19fa0cc" ON "llm_generations" ("runId", "operation", "inputSha256", "attempt") `
    );
    await queryRunner.query(
      `CREATE TABLE "canonical_story_revisions" ("id" SERIAL NOT NULL, "canonicalStoryId" integer NOT NULL, "revision" integer NOT NULL, "status" character varying NOT NULL, "title" character varying NOT NULL, "titleOrigin" character varying, "narrative" text NOT NULL, "storyStatus" character varying NOT NULL, "generationId" integer, "inputSha256" character varying NOT NULL, "createdAt" character varying NOT NULL, "artifactPath" character varying, "artifactSha256" character varying, "artifactToken" character varying, CONSTRAINT "PK_e0f8c8f7c5983fe07f4746c02d9" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_edd9f255751e34cdd7af0c8d4c" ON "canonical_story_revisions" ("canonicalStoryId", "revision") `
    );
    await queryRunner.query(
      `CREATE TABLE "story_revision_citations" ("id" SERIAL NOT NULL, "revisionId" integer NOT NULL, "civicItemId" integer NOT NULL, "agendaItemId" integer, "sourceKey" character varying NOT NULL, "snippetOnly" boolean NOT NULL DEFAULT false, "createdAt" character varying NOT NULL, CONSTRAINT "PK_5e6f95de978cb154bd2739a8005" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_story_revision_citations_parent_identity" ON "story_revision_citations" ("revisionId", "civicItemId") WHERE "agendaItemId" IS NULL`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_story_revision_citations_agenda_identity" ON "story_revision_citations" ("revisionId", "civicItemId", "agendaItemId") WHERE "agendaItemId" IS NOT NULL`
    );
    // Not entity-derived: provenance tables are append-only (model outputs
    // and published story revisions are never edited in place), and the
    // store checks the recorded foundation schema version on open.
    await queryRunner.query(
      `CREATE OR REPLACE FUNCTION civic_reject_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'append-only table % cannot be changed', TG_TABLE_NAME; END; $$`
    );
    for (const table of [
      'llm_generations',
      'canonical_story_revisions',
      'story_revision_citations',
    ]) {
      await queryRunner.query(
        `CREATE TRIGGER civic_${table}_immutable_update BEFORE UPDATE ON "${table}" FOR EACH ROW EXECUTE FUNCTION civic_reject_immutable()`
      );
      await queryRunner.query(
        `CREATE TRIGGER civic_${table}_immutable_delete BEFORE DELETE ON "${table}" FOR EACH ROW EXECUTE FUNCTION civic_reject_immutable()`
      );
    }
    await queryRunner.query(
      `INSERT INTO "schema_meta" ("key", "value") VALUES ('schemaVersion', '2026-09-17.1')`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "schema_meta" WHERE "key" = 'schemaVersion'`
    );
    for (const table of [
      'llm_generations',
      'canonical_story_revisions',
      'story_revision_citations',
    ]) {
      await queryRunner.query(
        `DROP TRIGGER IF EXISTS civic_${table}_immutable_delete ON "${table}"`
      );
      await queryRunner.query(
        `DROP TRIGGER IF EXISTS civic_${table}_immutable_update ON "${table}"`
      );
    }
    await queryRunner.query(`DROP FUNCTION IF EXISTS civic_reject_immutable()`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_story_revision_citations_agenda_identity"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_story_revision_citations_parent_identity"`
    );
    await queryRunner.query(`DROP TABLE "story_revision_citations"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_edd9f255751e34cdd7af0c8d4c"`
    );
    await queryRunner.query(`DROP TABLE "canonical_story_revisions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_87e88f2568375bfacbe19fa0cc"`
    );
    await queryRunner.query(`DROP TABLE "llm_generations"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7f76e83491907539f6763b5806"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_df4b87a4123f45538f7c8b88a2"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3c02683b241a5013b1bc3a7682"`
    );
    await queryRunner.query(`DROP TABLE "pipeline_run_leases"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5c45b2f0cb5cec862504ac8959"`
    );
    await queryRunner.query(`DROP TABLE "pipeline_stage_runs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d45ffebe838f214d537e28c058"`
    );
    await queryRunner.query(`DROP TABLE "pipeline_runs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6dcce4b1abec4ad7ffa512a16b"`
    );
    await queryRunner.query(`DROP TABLE "edition_stories"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_canonical_story_items_agenda_identity"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_canonical_story_items_parent_identity"`
    );
    await queryRunner.query(`DROP TABLE "canonical_story_items"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d3c121a33563370afc4b9f7b8a"`
    );
    await queryRunner.query(`DROP TABLE "canonical_stories"`);
    await queryRunner.query(`DROP TABLE "briefings"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c5e2f71642be1daf84fe200a7a"`
    );
    await queryRunner.query(`DROP TABLE "stories"`);
    await queryRunner.query(`DROP TABLE "agenda_items"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_90b650bcd6c576dd9d3fe8b9ed"`
    );
    await queryRunner.query(`DROP TABLE "edition_items"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c79127edf1c4f417aba18d7ab3"`
    );
    await queryRunner.query(`DROP TABLE "civic_items"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5af0f0ba6a69ccac4f3eadd1cf"`
    );
    await queryRunner.query(`DROP TABLE "raw_documents"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a31aa13c4109a0e251eda5b81a"`
    );
    await queryRunner.query(`DROP TABLE "raw_document_versions"`);
    await queryRunner.query(`DROP TABLE "fetch_attempts"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_297d51975112d72acf604718bb"`
    );
    await queryRunner.query(`DROP TABLE "fetch_ledger"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_971a2d309f2c676782dc15ae0f"`
    );
    await queryRunner.query(`DROP TABLE "quarantine"`);
    await queryRunner.query(`DROP TABLE "sources"`);
    await queryRunner.query(`DROP TABLE "localities"`);
    await queryRunner.query(`DROP TABLE "schema_meta"`);
  }
}

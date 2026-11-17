import { MigrationInterface, QueryRunner } from "typeorm";

export class DirectoryFoundation1794794657383 implements MigrationInterface {
    name = 'DirectoryFoundation1794794657383'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "directory_reviewed_binding" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "candidateId" uuid NOT NULL, "decisionId" uuid, "communityId" uuid NOT NULL, "scanId" character varying(64) NOT NULL, "sourceFileRowNumber" bigint NOT NULL, "livePolicyId" character varying(64), "provenance" character varying(24) NOT NULL, "stageInstallationId" character varying(64), "stageScanId" character varying(64), "stageSourceFileRowNumber" bigint, "stagePolicyId" character varying(64), "displayPolicyReleaseId" character varying(64), "displayPolicyHash" character varying(64), "stageContentHash" character varying(64), "reviewedHash" character varying(64), "fieldHashes" jsonb, "assignmentChangeToken" uuid, "state" character varying(16) NOT NULL, "stateCause" character varying(40), "verifiedAt" TIMESTAMP WITH TIME ZONE, "verifiedUntil" TIMESTAMP WITH TIME ZONE, "suspendedAt" TIMESTAMP WITH TIME ZONE, "retiredAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_directory_reviewed_binding_active_lease" CHECK ("state" <> 'active' OR "verifiedUntil" IS NOT NULL), CONSTRAINT "CHK_directory_reviewed_binding_legacy_hidden" CHECK ("provenance" <> 'unknown_legacy' OR "state" IN ('suspended','retired')), CONSTRAINT "CHK_directory_reviewed_binding_source_file" CHECK ("provenance" <> 'source_file' OR ("stageContentHash" IS NOT NULL AND "reviewedHash" IS NOT NULL AND "decisionId" IS NOT NULL)), CONSTRAINT "CHK_directory_reviewed_binding_contact_stage" CHECK ("provenance" <> 'contact_stage' OR ("stageScanId" IS NOT NULL AND "stagePolicyId" IS NOT NULL AND "stageContentHash" IS NOT NULL AND "reviewedHash" IS NOT NULL AND "decisionId" IS NOT NULL)), CONSTRAINT "CHK_directory_reviewed_binding_state" CHECK ("state" IN ('pending','active','suspended','retired')), CONSTRAINT "CHK_directory_reviewed_binding_provenance" CHECK ("provenance" IN ('contact_stage','source_file','unknown_legacy')), CONSTRAINT "PK_85f4ba7001f58fd40b6c8a68e05" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_directory_reviewed_binding_sweep" ON "directory_reviewed_binding" ("state", "verifiedUntil") `);
        await queryRunner.query(`CREATE INDEX "IDX_directory_reviewed_binding_stage_policy" ON "directory_reviewed_binding" ("stagePolicyId") `);
        await queryRunner.query(`CREATE INDEX "IDX_directory_reviewed_binding_stage_row" ON "directory_reviewed_binding" ("stageScanId", "stageSourceFileRowNumber") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_directory_reviewed_binding_live_row" ON "directory_reviewed_binding" ("scanId", "sourceFileRowNumber") WHERE "state" <> 'retired'`);
        await queryRunner.query(`CREATE TABLE "directory_reviewed_binding_event" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "bindingId" uuid NOT NULL, "kind" character varying(16) NOT NULL, "cause" character varying(40) NOT NULL, "observedStageHash" character varying(64), "runId" character varying(64), "decisionId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_directory_reviewed_binding_event_kind" CHECK ("kind" IN ('published','confirmed','suspended','reconfirmed','retired')), CONSTRAINT "PK_0e2e3742b6eeea3aff4070e479e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_directory_reviewed_binding_event_transition" ON "directory_reviewed_binding_event" ("bindingId", "kind", "cause") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_directory_reviewed_binding_event_transition"`);
        await queryRunner.query(`DROP TABLE "directory_reviewed_binding_event"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_directory_reviewed_binding_live_row"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_directory_reviewed_binding_stage_row"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_directory_reviewed_binding_stage_policy"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_directory_reviewed_binding_sweep"`);
        await queryRunner.query(`DROP TABLE "directory_reviewed_binding"`);
    }

}

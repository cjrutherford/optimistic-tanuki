import { MigrationInterface, QueryRunner } from "typeorm";

export class DirectoryFoundation1794815074193 implements MigrationInterface {
    name = 'DirectoryFoundation1794815074193'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "directory_overture_source_key" ("scanId" character varying(64) NOT NULL, "sourceFileRowNumber" bigint NOT NULL, "upstreamKeyHash" character varying(64) NOT NULL, "keyVersion" integer NOT NULL, CONSTRAINT "PK_dd094adf49fc759abb46d706711" PRIMARY KEY ("scanId", "sourceFileRowNumber"))`);
        await queryRunner.query(`CREATE INDEX "IDX_directory_overture_source_key_hash" ON "directory_overture_source_key" ("upstreamKeyHash") `);
        await queryRunner.query(`CREATE TABLE "directory_business" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "communityId" uuid NOT NULL, "state" character varying(16) NOT NULL DEFAULT 'active', "successorId" uuid, "stateCause" character varying(40), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "retiredAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_directory_business_successor" CHECK ("successorId" IS NULL OR "state" IN ('merged','split')), CONSTRAINT "CHK_directory_business_state" CHECK ("state" IN ('active','retired','merged','split')), CONSTRAINT "PK_5b78a25643c45112771b02cc2f2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_directory_business_town" ON "directory_business" ("communityId") `);
        await queryRunner.query(`CREATE TABLE "directory_business_assertion" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "businessId" uuid NOT NULL, "communityId" uuid NOT NULL, "scanId" character varying(64) NOT NULL, "sourceFileRowNumber" bigint NOT NULL, "policyId" character varying(64) NOT NULL, "evidence" character varying(24) NOT NULL, "confidence" character varying(16) NOT NULL, "upstreamKeyHash" character varying(64), "nameHash" character varying(64), "state" character varying(16) NOT NULL DEFAULT 'current', "predecessorAssertionId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_directory_business_assertion_state" CHECK ("state" IN ('current','superseded','withdrawn')), CONSTRAINT "CHK_directory_business_assertion_confidence" CHECK ("confidence" IN ('origin','carried','corroborated','confirmed')), CONSTRAINT "CHK_directory_business_assertion_evidence" CHECK ("evidence" IN ('origin','upstream_id','owner_confirmed','reviewer_confirmed','artifact_reread')), CONSTRAINT "PK_9a69d7a5a953f1c47dc8e590139" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_directory_business_assertion_hash" ON "directory_business_assertion" ("communityId", "upstreamKeyHash") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_directory_business_assertion_current" ON "directory_business_assertion" ("businessId", "policyId") WHERE "state" = 'current'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_directory_business_assertion_row" ON "directory_business_assertion" ("scanId", "sourceFileRowNumber") `);
        await queryRunner.query(`CREATE TABLE "directory_business_event" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "businessId" uuid NOT NULL, "kind" character varying(16) NOT NULL, "cause" character varying(40) NOT NULL, "scanId" character varying(64), "sourceFileRowNumber" bigint, "otherBusinessId" uuid, "decisionId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_directory_business_event_kind" CHECK ("kind" IN ('created','carried','corroborated','confirmed','unresolved','retired','merged','split')), CONSTRAINT "PK_9fe4a3804429d0b44de93b2e47a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_directory_business_event_transition" ON "directory_business_event" ("businessId", "kind", "scanId", "sourceFileRowNumber") `);
        await queryRunner.query(`CREATE TABLE "directory_business_carry_state" ("communityId" uuid NOT NULL, "fromPolicyId" character varying(64) NOT NULL, "toPolicyId" character varying(64) NOT NULL, "planDigest" character varying(64) NOT NULL, "state" character varying(16) NOT NULL, "cursorScanId" character varying(64), "cursorRow" bigint, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_directory_business_carry_state" CHECK ("state" IN ('planned','running','complete')), CONSTRAINT "PK_b69c748dc2a0978b49818d8d4c2" PRIMARY KEY ("communityId", "fromPolicyId", "toPolicyId"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "directory_business_carry_state"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_directory_business_event_transition"`);
        await queryRunner.query(`DROP TABLE "directory_business_event"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_directory_business_assertion_row"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_directory_business_assertion_current"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_directory_business_assertion_hash"`);
        await queryRunner.query(`DROP TABLE "directory_business_assertion"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_directory_business_town"`);
        await queryRunner.query(`DROP TABLE "directory_business"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_directory_overture_source_key_hash"`);
        await queryRunner.query(`DROP TABLE "directory_overture_source_key"`);
    }

}

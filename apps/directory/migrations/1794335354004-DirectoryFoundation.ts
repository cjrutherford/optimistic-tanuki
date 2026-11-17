import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryFoundation1794335354004 implements MigrationInterface {
  name = 'DirectoryFoundation1794335354004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_address_review_candidate" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "communityId" uuid NOT NULL, "scanId" character varying(64) NOT NULL, "sourceFileRowNumber" bigint NOT NULL, "name" character varying(2000) NOT NULL, "category" character varying(2000) NOT NULL, "point" jsonb NOT NULL, "addresses" jsonb NOT NULL, "websites" jsonb NOT NULL, "phones" jsonb NOT NULL, "rights" character varying(16) NOT NULL, "risk" jsonb NOT NULL, "geocode" jsonb, "officialEvidence" jsonb, "verdict" character varying(16) NOT NULL, "reasons" jsonb NOT NULL, "checks" jsonb NOT NULL, "policyVersion" character varying(64) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'needs_human', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_de78c712f4b9df549fe012824c0" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_address_review_candidate_status" ON "directory_address_review_candidate" ("status") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_directory_address_review_candidate_source" ON "directory_address_review_candidate" ("scanId", "sourceFileRowNumber") `
    );
    await queryRunner.query(
      `CREATE TABLE "directory_address_review_decision" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "candidateId" uuid NOT NULL, "actorKind" character varying(16) NOT NULL, "actorId" uuid, "decision" character varying(16) NOT NULL, "evidenceUrl" text, "evidenceHash" character varying(64), "reason" character varying(2048), "checks" jsonb NOT NULL, "policyVersion" character varying(64) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "appliedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_7911762832b45bf0704f4e7ef47" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_address_review_decision_candidate" ON "directory_address_review_decision" ("candidateId") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_address_review_decision_candidate"`
    );
    await queryRunner.query(`DROP TABLE "directory_address_review_decision"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_directory_address_review_candidate_source"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_address_review_candidate_status"`
    );
    await queryRunner.query(`DROP TABLE "directory_address_review_candidate"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryOvertureReleaseCandidates1795055238530
  implements MigrationInterface
{
  name = 'DirectoryOvertureReleaseCandidates1795055238530';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_overture_release_candidate" ("release" character varying(64) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'detected', "rightsStatus" character varying(16) NOT NULL, "rightsDetail" jsonb NOT NULL, "rightsPolicy" jsonb, "inventory" jsonb, "canaryTownIds" jsonb NOT NULL DEFAULT '[]', "canaryStartedAt" TIMESTAMP WITH TIME ZONE, "canaryResults" jsonb NOT NULL DEFAULT '[]', "holdReason" character varying(64), "lastError" character varying(1024), "detectedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "decidedAt" TIMESTAMP WITH TIME ZONE, "decidedBy" uuid, "decisionId" uuid, "decisionReason" character varying(1024), CONSTRAINT "CHK_directory_overture_release_rights" CHECK ("rightsStatus" IN ('approved','mismatch')), CONSTRAINT "CHK_directory_overture_release_status" CHECK ("status" IN ('detected','canary_running','held','rejected','promoted')), CONSTRAINT "PK_1e8d50eaebf2910e7a8f1230464" PRIMARY KEY ("release"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_overture_release_status" ON "directory_overture_release_candidate" ("status", "detectedAt") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_overture_release_status"`
    );
    await queryRunner.query(
      `DROP TABLE "directory_overture_release_candidate"`
    );
  }
}

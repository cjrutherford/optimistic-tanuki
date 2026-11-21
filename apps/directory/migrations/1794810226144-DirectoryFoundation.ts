import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryFoundation1794810226144 implements MigrationInterface {
  name = 'DirectoryFoundation1794810226144';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_overture_source_evidence" ("scanId" character varying(64) NOT NULL, "evidenceVersion" integer NOT NULL, "kind" character varying(24) NOT NULL, "releaseId" character varying(32) NOT NULL, "artifactUrl" text NOT NULL, "artifactEtag" character varying(100) NOT NULL, "artifactBytes" bigint, "upstreamLastModified" TIMESTAMP WITH TIME ZONE, "observedAt" TIMESTAMP WITH TIME ZONE, "recordedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "recorder" character varying(160) NOT NULL, "inventorySha256" character varying(64) NOT NULL, "evidenceSha256" character varying(64) NOT NULL, CONSTRAINT "CHK_directory_source_evidence_attached" CHECK ("kind" = 'captured' OR "observedAt" IS NULL), CONSTRAINT "CHK_directory_source_evidence_observed" CHECK ("observedAt" IS NULL OR "observedAt" <= "recordedAt" + interval '5 minutes'), CONSTRAINT "CHK_directory_source_evidence_modified" CHECK ("upstreamLastModified" IS NULL OR "upstreamLastModified" <= "recordedAt"), CONSTRAINT "CHK_directory_source_evidence_release" CHECK ("releaseId" ~ '^\\d{4}-\\d{2}-\\d{2}\\.\\d+$'), CONSTRAINT "CHK_directory_source_evidence_kind" CHECK ("kind" IN ('captured','attached_verified')), CONSTRAINT "PK_46d5cbc4eede2f385b05aadf9a1" PRIMARY KEY ("scanId"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "directory_overture_source_evidence"`);
  }
}

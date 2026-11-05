import { MigrationInterface, QueryRunner } from 'typeorm';

export class OfficialCandidates1793843620449 implements MigrationInterface {
  name = 'OfficialCandidates1793843620449';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "official_candidates" ("id" uuid NOT NULL, "slug" character varying NOT NULL, "name" character varying NOT NULL, "normalizedName" character varying NOT NULL, "role" character varying NOT NULL, "civicTenantId" character varying NOT NULL, "sourceAgendaId" character varying, "firstSeen" TIMESTAMP WITH TIME ZONE NOT NULL, "lastSeen" TIMESTAMP WITH TIME ZONE NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "decidedBy" character varying, "decidedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_7364f9a7e0f473ec4abc493aaa8" UNIQUE ("slug", "normalizedName"), CONSTRAINT "PK_0501f126702a56b89dabbb01c53" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1892b084d908efde8fb2f3cbd1" ON "official_candidates" ("slug", "status") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1892b084d908efde8fb2f3cbd1"`
    );
    await queryRunner.query(`DROP TABLE "official_candidates"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CivicOfficials1793838059951 implements MigrationInterface {
  name = 'CivicOfficials1793838059951';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "civic_officials" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying(128) NOT NULL, "name" character varying(255) NOT NULL, "normalizedName" character varying(255) NOT NULL, "role" character varying(128) NOT NULL, "sourceAgendaId" uuid, "firstSeen" TIMESTAMP NOT NULL, "lastSeen" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c36121e8b7eb729623be9f57ea3" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_civic_officials_tenant_name" ON "civic_officials" ("tenantId", "normalizedName") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_civic_officials_tenant_name"`
    );
    await queryRunner.query(`DROP TABLE "civic_officials"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryFoundation1794151884898 implements MigrationInterface {
  name = 'DirectoryFoundation1794151884898';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_provider_budget_attempt" ("attemptId" uuid NOT NULL, "period" character varying(7) NOT NULL, "provider" character varying(64) NOT NULL, "operation" character varying(64) NOT NULL, "reservedCents" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_directory_provider_budget_period" CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'), CONSTRAINT "CHK_directory_provider_budget_cost" CHECK ("reservedCents" BETWEEN 1 AND 2500), CONSTRAINT "PK_51117bf439609ccfc9efb578312" PRIMARY KEY ("attemptId"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_provider_budget_period" ON "directory_provider_budget_attempt" ("period") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_provider_budget_period"`
    );
    await queryRunner.query(`DROP TABLE "directory_provider_budget_attempt"`);
  }
}

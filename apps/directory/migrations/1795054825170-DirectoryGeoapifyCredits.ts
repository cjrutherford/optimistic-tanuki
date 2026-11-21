import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryGeoapifyCredits1795054825170
  implements MigrationInterface
{
  name = 'DirectoryGeoapifyCredits1795054825170';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_provider_credit_attempt" ("attemptId" uuid NOT NULL, "day" date NOT NULL, "provider" character varying(64) NOT NULL, "operation" character varying(64) NOT NULL, "credits" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_directory_provider_credit_credits" CHECK ("credits" BETWEEN 1 AND 3000), CONSTRAINT "PK_fcaeef2b88e8baa334c75b39ae9" PRIMARY KEY ("attemptId"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_provider_credit_day" ON "directory_provider_credit_attempt" ("provider", "day") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_provider_credit_day"`
    );
    await queryRunner.query(`DROP TABLE "directory_provider_credit_attempt"`);
  }
}

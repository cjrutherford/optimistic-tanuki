import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialCreate1700000000000 implements MigrationInterface {
  name = 'InitialCreate1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "lead_source_enum" AS ENUM ('upwork', 'linkedin', 'referral', 'cold', 'local', 'other')
    `);
    await queryRunner.query(`
      CREATE TYPE "lead_status_enum" AS ENUM ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost')
    `);
    await queryRunner.query(`
      CREATE TABLE "leads" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "company" varchar,
        "email" varchar,
        "phone" varchar,
        "source" "lead_source_enum" NOT NULL,
        "status" "lead_status_enum" NOT NULL DEFAULT 'new',
        "value" decimal(10,2) NOT NULL DEFAULT 0,
        "notes" text NOT NULL DEFAULT '',
        "nextFollowUp" date,
        "isAutoDiscovered" boolean NOT NULL DEFAULT false,
        "searchKeywords" varchar[],
        "assignedTo" varchar,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_leads_status" ON "leads" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_leads_source" ON "leads" ("source")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_leads_company" ON "leads" ("company")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_leads_company"`);
    await queryRunner.query(`DROP INDEX "IDX_leads_source"`);
    await queryRunner.query(`DROP INDEX "IDX_leads_status"`);
    await queryRunner.query(`DROP TABLE "leads"`);
    await queryRunner.query(`DROP TYPE "lead_status_enum"`);
    await queryRunner.query(`DROP TYPE "lead_source_enum"`);
  }
}

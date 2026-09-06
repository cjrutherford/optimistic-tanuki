import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLeadOutreachDrafts1788725267064 implements MigrationInterface {
  name = 'AddLeadOutreachDrafts1788725267064';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "lead_outreach_drafts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "leadId" uuid NOT NULL, "profileId" character varying NOT NULL, "userId" character varying, "version" integer NOT NULL DEFAULT '1', "draft" jsonb NOT NULL, "evidence" jsonb NOT NULL, "modelGenerated" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b9c41104bff80ed4f045b830b11" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_61a2e59c61c8c5766c52b444e6" ON "lead_outreach_drafts" ("profileId", "leadId", "version") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_61a2e59c61c8c5766c52b444e6"`
    );
    await queryRunner.query(`DROP TABLE "lead_outreach_drafts"`);
  }
}

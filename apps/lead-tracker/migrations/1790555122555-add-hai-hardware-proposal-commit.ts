import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHaiHardwareProposalCommit1790555122555
  implements MigrationInterface
{
  name = 'AddHaiHardwareProposalCommit1790555122555';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "leads" ADD "commercialQuoteId" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ADD "proposalIdempotencyKey" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ADD "commercialProposalHash" character(64)`
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ADD "hardwareTier" character varying(16)`
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ADD "commercialCurrency" character(3)`
    );
    await queryRunner.query(`ALTER TABLE "leads" ADD "acceptedTerms" jsonb`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_leads_proposal_idempotency_key" ON "leads" ("proposalIdempotencyKey") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_leads_commercial_quote_id" ON "leads" ("commercialQuoteId") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_leads_commercial_quote_id"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_leads_proposal_idempotency_key"`
    );
    await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN "acceptedTerms"`);
    await queryRunner.query(
      `ALTER TABLE "leads" DROP COLUMN "commercialCurrency"`
    );
    await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN "hardwareTier"`);
    await queryRunner.query(
      `ALTER TABLE "leads" DROP COLUMN "commercialProposalHash"`
    );
    await queryRunner.query(
      `ALTER TABLE "leads" DROP COLUMN "proposalIdempotencyKey"`
    );
    await queryRunner.query(
      `ALTER TABLE "leads" DROP COLUMN "commercialQuoteId"`
    );
  }
}

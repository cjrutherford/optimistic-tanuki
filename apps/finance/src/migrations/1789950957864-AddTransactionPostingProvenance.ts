import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E3: posting-provenance columns on the finance ledger.
 *
 * Trimmed from the generated diff, which also dropped a dozen unrelated
 * foreign keys (constraint-name drift between the entities and the live
 * schema — touching them here would be destructive and out of scope).
 * Only the three additive, nullable columns ship in this slice.
 */
export class AddTransactionPostingProvenance1789950957864
  implements MigrationInterface
{
  name = 'AddTransactionPostingProvenance1789950957864';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transaction" ADD "source" character varying`
    );
    await queryRunner.query(`ALTER TABLE "transaction" ADD "sourceId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "transaction" ADD "providerMeta" jsonb`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transaction" DROP COLUMN "providerMeta"`
    );
    await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "sourceId"`);
    await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "source"`);
  }
}

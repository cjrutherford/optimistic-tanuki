import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Records who wrote a score.
 *
 * The gateway started sending the acting user with every evaluation when the
 * route was closed to anonymous callers. Without somewhere to put it the value
 * was accepted and dropped, which is worse than not claiming an audit trail at
 * all.
 */
export class EvaluationRecordedBy1770000000002 implements MigrationInterface {
  name = 'EvaluationRecordedBy1770000000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lp_evaluation" ADD COLUMN IF NOT EXISTS "recordedByUserId" uuid`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_lp_evaluation_recorded_by" ON "lp_evaluation" ("recordedByUserId")`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_lp_evaluation_recorded_by"`
    );
    await queryRunner.query(
      `ALTER TABLE "lp_evaluation" DROP COLUMN IF EXISTS "recordedByUserId"`
    );
  }
}

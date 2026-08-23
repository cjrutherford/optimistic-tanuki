import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ties lesson progress to a profile and the enrolment that authorized it.
 *
 * Existing rows were written against a bare userId by a route that had no
 * concept of a learning profile or an enrolment, and some of them came from
 * the old forgeable endpoint before the gateway required a verified token.
 * There is no reliable way to map those userIds to a learning profile from
 * inside this migration: profiles live in a different service's database, so
 * no join is possible, and creating profiles from a data migration would
 * silently mint accounts nobody asked for.
 *
 * Decision: orphan, don't delete or guess. "profileId" and "enrolmentId" are
 * added as nullable columns. Pre-existing rows are left with both null and
 * keep their original "userId" untouched, so the historical record survives
 * and remains available for a deliberate backfill later if someone maps old
 * userIds to profiles out of band. Every row written from this point forward
 * is required by the application layer (AppService.saveProgress) to carry a
 * profileId and a real enrolmentId, so the gap does not grow.
 */
export class LessonProgressProfile1770000000004 implements MigrationInterface {
  name = 'LessonProgressProfile1770000000004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lp_lesson_progress" ADD COLUMN IF NOT EXISTS "profileId" uuid`
    );
    await queryRunner.query(
      `ALTER TABLE "lp_lesson_progress" ADD COLUMN IF NOT EXISTS "enrolmentId" uuid`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_lp_lesson_progress_profile" ON "lp_lesson_progress" ("profileId")`
    );
    // Enforced only for rows that carry it; pre-existing orphaned rows have
    // profileId/enrolmentId null and are unaffected by the FK.
    await queryRunner.query(`
      ALTER TABLE "lp_lesson_progress"
      ADD CONSTRAINT "FK_lp_lesson_progress_enrolment"
      FOREIGN KEY ("enrolmentId") REFERENCES "lp_enrolment"("id")
      ON DELETE RESTRICT
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // This only removes what "up" added. It cannot and does not attempt to
    // restore any profileId/enrolmentId values that had been backfilled onto
    // rows after this migration ran; those would be lost if this is reverted
    // after a backfill. Reverting immediately after "up" (before any backfill
    // or new writes) is fully safe and loses nothing.
    await queryRunner.query(
      `ALTER TABLE "lp_lesson_progress" DROP CONSTRAINT IF EXISTS "FK_lp_lesson_progress_enrolment"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_lp_lesson_progress_profile"`
    );
    await queryRunner.query(
      `ALTER TABLE "lp_lesson_progress" DROP COLUMN IF EXISTS "enrolmentId"`
    );
    await queryRunner.query(
      `ALTER TABLE "lp_lesson_progress" DROP COLUMN IF EXISTS "profileId"`
    );
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes "no progress without an enrolment" a rule the database keeps.
 *
 * The service already refuses to write progress for a learner who has not
 * enrolled, but a service check only holds while every write goes through
 * that method. This puts the same rule where it cannot be bypassed.
 *
 * Rows from before enrolment existed are deleted rather than backfilled.
 * They carry a userId and no profile, the profiles live in another service's
 * database, and inventing enrolments for them would fabricate a record of
 * people taking courses they never took. Nobody is relying on this data.
 */
export class ProgressRequiresEnrolment1770000000005
  implements MigrationInterface
{
  name = 'ProgressRequiresEnrolment1770000000005';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "lp_lesson_progress" WHERE "profileId" IS NULL OR "enrolmentId" IS NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "lp_lesson_progress" ALTER COLUMN "profileId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "lp_lesson_progress" ALTER COLUMN "enrolmentId" SET NOT NULL`
    );
    // One progress row per learner per lesson. The old constraint was keyed on
    // the bare userId, which is the identity enrolment replaced.
    await queryRunner.query(
      `ALTER TABLE "lp_lesson_progress" DROP CONSTRAINT IF EXISTS "UQ_lp_lesson_progress_user_lesson"`
    );
    await queryRunner.query(
      `ALTER TABLE "lp_lesson_progress" ADD CONSTRAINT "UQ_lp_lesson_progress_profile_lesson" UNIQUE ("profileId", "lessonId")`
    );
  }

  /**
   * Reverting relaxes the columns again. It cannot bring back the rows that
   * `up` deleted, and it does not pretend to.
   */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lp_lesson_progress" DROP CONSTRAINT IF EXISTS "UQ_lp_lesson_progress_profile_lesson"`
    );
    await queryRunner.query(
      `ALTER TABLE "lp_lesson_progress" ALTER COLUMN "enrolmentId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "lp_lesson_progress" ALTER COLUMN "profileId" DROP NOT NULL`
    );
  }
}

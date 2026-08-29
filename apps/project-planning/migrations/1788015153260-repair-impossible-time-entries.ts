import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Data migration, not a schema one, hence migration:create rather than
 * migration:generate. There is nothing about the tables to diff.
 *
 * elapsedSeconds used to be whatever a caller sent. It was never derived from
 * the two ends of an entry and never checked, so the column could hold a
 * negative duration, or a figure with no relation to the times beside it. A
 * single row at minus five hundred seconds was enough to cancel out every real
 * total on its task and make the panel read "none yet" over an hour of work.
 *
 * Two repairs, both narrow.
 *
 * A finished entry whose duration is impossible is recomputed from its own
 * start and end, which are the two facts about it that were never in doubt.
 * A negative that cannot be recomputed is clamped to zero: nothing is a better
 * answer than something that subtracts.
 *
 * Nothing that is merely surprising is touched. A long entry somebody genuinely
 * left running is theirs to correct, not this migration's.
 *
 * down is deliberately empty. The values being replaced were impossible, and
 * putting them back would restore the defect rather than the data. The
 * migration is safe to run twice, which is the property that actually matters
 * here.
 */
export class RepairImpossibleTimeEntries1788015153260
  implements MigrationInterface
{
  name = 'RepairImpossibleTimeEntries1788015153260';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // A finished entry can be recomputed from its own two ends.
    await queryRunner.query(`
      UPDATE "task_time_entry"
      SET "elapsedSeconds" = GREATEST(
        0,
        FLOOR(EXTRACT(EPOCH FROM ("endTime" - "startTime")))::int
      )
      WHERE "endTime" IS NOT NULL
        AND (
          "elapsedSeconds" < 0
          OR "elapsedSeconds" <> GREATEST(
            0,
            FLOOR(EXTRACT(EPOCH FROM ("endTime" - "startTime")))::int
          )
        )
    `);

    // A running entry has no end to recompute from, so a negative on one can
    // only be cleared.
    await queryRunner.query(`
      UPDATE "task_time_entry"
      SET "elapsedSeconds" = 0
      WHERE "elapsedSeconds" < 0
    `);
  }

  public async down(): Promise<void> {
    // Nothing to undo. See the note above.
  }
}

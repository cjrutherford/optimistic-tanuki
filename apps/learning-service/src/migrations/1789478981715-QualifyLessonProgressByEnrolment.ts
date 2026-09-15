import { MigrationInterface, QueryRunner } from 'typeorm';

export class QualifyLessonProgressByEnrolment1789478981715
  implements MigrationInterface
{
  name = 'QualifyLessonProgressByEnrolment1789478981715';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e4d662ff65da77a7cf579536d5"`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_9a2d7508dd82ec528ac9fadbdd" ON "lp_lesson_progress" ("profileId", "enrolmentId", "lessonId") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9a2d7508dd82ec528ac9fadbdd"`
    );
    /**
     * This is a deliberate, reversible data-backfill exception to the
     * generated index change. Reverting to the old key can collapse rows
     * from different enrolments. Keep the most complete row
     * deterministically, preserve every completion flag and exercise id,
     * and retain the highest points total rather than double-counting
     * awards from separate enrolments.
     */
    await queryRunner.query(`
          DO $migration$
          DECLARE
            duplicate RECORD;
            canonical_id uuid;
            merged_exercises jsonb;
          BEGIN
            FOR duplicate IN
              SELECT
                "lessonId",
                "profileId",
                array_agg(
                  "id"
                  ORDER BY "completed" DESC, "points" DESC, "updatedAt" DESC, "id"
                ) AS ids
              FROM "lp_lesson_progress"
              GROUP BY "lessonId", "profileId"
              HAVING count(*) > 1
            LOOP
              canonical_id := duplicate.ids[1];

              SELECT COALESCE(
                jsonb_agg(exercise_id ORDER BY exercise_id),
                '[]'::jsonb
              )
              INTO merged_exercises
              FROM (
                SELECT DISTINCT exercise_id
                FROM "lp_lesson_progress" progress
                CROSS JOIN LATERAL jsonb_array_elements_text(
                  progress."completedExerciseIds"
                ) AS exercise(exercise_id)
                WHERE progress."id" = ANY(duplicate.ids)
              ) AS unique_exercises;

              UPDATE "lp_lesson_progress" AS canonical
              SET
                "completed" = merged.completed,
                "completedExerciseIds" = merged.exercises,
                "points" = merged.points,
                "updatedAt" = merged.updated_at
              FROM (
                SELECT
                  bool_or("completed") AS completed,
                  merged_exercises AS exercises,
                  max("points") AS points,
                  max("updatedAt") AS updated_at
                FROM "lp_lesson_progress"
                WHERE "id" = ANY(duplicate.ids)
              ) AS merged
              WHERE canonical."id" = canonical_id;

              DELETE FROM "lp_lesson_progress"
              WHERE "id" = ANY(duplicate.ids)
                AND "id" <> canonical_id;
            END LOOP;
          END
          $migration$;
        `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_e4d662ff65da77a7cf579536d5" ON "lp_lesson_progress" ("lessonId", "profileId") `
    );
  }
}

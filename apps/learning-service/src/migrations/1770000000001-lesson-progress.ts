import { MigrationInterface, QueryRunner } from 'typeorm';

export class LessonProgress1770000000001 implements MigrationInterface {
  name = 'LessonProgress1770000000001';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "lp_lesson_progress" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL,
      "lessonId" character varying(192) NOT NULL, "completed" boolean NOT NULL DEFAULT false,
      "completedExerciseIds" jsonb NOT NULL DEFAULT '[]', "points" integer NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_lp_lesson_progress" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_lp_lesson_progress_user_lesson" UNIQUE ("userId", "lessonId"))`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_lp_lesson_progress_user" ON "lp_lesson_progress" ("userId")`
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_lesson_progress"`);
  }
}

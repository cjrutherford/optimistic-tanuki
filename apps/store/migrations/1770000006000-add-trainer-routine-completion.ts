import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTrainerRoutineCompletion1770000006000
  implements MigrationInterface
{
  name = 'AddTrainerRoutineCompletion1770000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trainer_routine_assignments" ADD COLUMN IF NOT EXISTS "status" character varying(32) NOT NULL DEFAULT 'assigned'`
    );
    await queryRunner.query(
      `ALTER TABLE "trainer_routine_assignments" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trainer_routine_assignments" DROP COLUMN IF EXISTS "completedAt"`
    );
    await queryRunner.query(
      `ALTER TABLE "trainer_routine_assignments" DROP COLUMN IF EXISTS "status"`
    );
  }
}

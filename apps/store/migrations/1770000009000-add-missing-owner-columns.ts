import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingOwnerColumns1770000009000 implements MigrationInterface {
  name = 'AddMissingOwnerColumns1770000009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "ownerId" uuid NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "trainer_routine_assignments" ADD COLUMN IF NOT EXISTS "ownerId" uuid NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "trainer_progress_check_ins" ADD COLUMN IF NOT EXISTS "ownerId" uuid NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP COLUMN IF EXISTS "ownerId"`
    );
    await queryRunner.query(
      `ALTER TABLE "trainer_routine_assignments" DROP COLUMN IF EXISTS "ownerId"`
    );
    await queryRunner.query(
      `ALTER TABLE "trainer_progress_check_ins" DROP COLUMN IF EXISTS "ownerId"`
    );
  }
}

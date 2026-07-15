import { MigrationInterface, QueryRunner } from 'typeorm';

export class FailedLoginLockout1789000000000 implements MigrationInterface {
  name = 'FailedLoginLockout1789000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_entity" ADD COLUMN IF NOT EXISTS "failedLoginCount" integer NOT NULL DEFAULT 0`
    );
    await queryRunner.query(
      `ALTER TABLE "user_entity" ADD COLUMN IF NOT EXISTS "lockedUntil" timestamptz`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_entity" DROP COLUMN IF EXISTS "lockedUntil"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_entity" DROP COLUMN IF EXISTS "failedLoginCount"`
    );
  }
}

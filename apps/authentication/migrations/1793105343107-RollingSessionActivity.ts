import { MigrationInterface, QueryRunner } from 'typeorm';

export class RollingSessionActivity1793105343107 implements MigrationInterface {
  name = 'RollingSessionActivity1793105343107';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "token" ADD "lastActivityAt" TIMESTAMP WITH TIME ZONE`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "token" DROP COLUMN "lastActivityAt"`);
  }
}

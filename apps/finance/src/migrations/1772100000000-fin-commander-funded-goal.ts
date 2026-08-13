import { MigrationInterface, QueryRunner } from 'typeorm';

export class FinCommanderFundedGoal1772100000000 implements MigrationInterface {
  name = 'FinCommanderFundedGoal1772100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "fin_commander_goal" ADD COLUMN IF NOT EXISTS "fundingAccountId" uuid'
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_fin_commander_goal_funding_account" ON "fin_commander_goal" ("fundingAccountId")'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_fin_commander_goal_funding_account"'
    );
    await queryRunner.query(
      'ALTER TABLE "fin_commander_goal" DROP COLUMN IF EXISTS "fundingAccountId"'
    );
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AiChangeReason1787943076720 implements MigrationInterface {
  name = 'AiChangeReason1787943076720';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ai_change" ADD "reason" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ai_change" DROP COLUMN "reason"`);
  }
}

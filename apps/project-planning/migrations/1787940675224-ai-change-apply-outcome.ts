import { MigrationInterface, QueryRunner } from 'typeorm';

export class AiChangeApplyOutcome1787940675224 implements MigrationInterface {
  name = 'AiChangeApplyOutcome1787940675224';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_change" ADD "applied" boolean NOT NULL DEFAULT false`
    );
    await queryRunner.query(
      `ALTER TABLE "ai_change" ADD "appliedEntityId" character varying`
    );
    await queryRunner.query(`ALTER TABLE "ai_change" ADD "applyError" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ai_change" DROP COLUMN "applyError"`);
    await queryRunner.query(
      `ALTER TABLE "ai_change" DROP COLUMN "appliedEntityId"`
    );
    await queryRunner.query(`ALTER TABLE "ai_change" DROP COLUMN "applied"`);
  }
}

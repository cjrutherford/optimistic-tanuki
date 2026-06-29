import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostCrossAppCard1782800000000 implements MigrationInterface {
  name = 'PostCrossAppCard1782800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" ADD "crossAppCard" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "crossAppCard"`);
  }
}

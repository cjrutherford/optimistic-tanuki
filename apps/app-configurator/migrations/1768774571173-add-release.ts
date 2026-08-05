import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRelease1768774571173 implements MigrationInterface {
  name = 'AddRelease1768774571173';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" ADD "release" jsonb NOT NULL DEFAULT '{}'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" DROP COLUMN "release"`
    );
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryFoundation1793887610644 implements MigrationInterface {
  name = 'DirectoryFoundation1793887610644';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "directory_census_progress" ADD "activationId" uuid`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_census_progress" ADD "socialGeneration" bigint`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_census_progress" ADD "directoryGeneration" bigint`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "directory_census_progress" DROP COLUMN "directoryGeneration"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_census_progress" DROP COLUMN "socialGeneration"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_census_progress" DROP COLUMN "activationId"`
    );
  }
}

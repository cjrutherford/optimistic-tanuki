import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryFoundation1793889542202 implements MigrationInterface {
  name = 'DirectoryFoundation1793889542202';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "directory_census_progress" ADD "enabledPayload" jsonb`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "directory_census_progress" DROP COLUMN "enabledPayload"`
    );
  }
}

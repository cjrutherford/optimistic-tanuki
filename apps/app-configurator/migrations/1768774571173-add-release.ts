import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRelease1768774571173 implements MigrationInterface {
  name = 'AddRelease1768774571173';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // IF NOT EXISTS because this column reached some databases without the
    // migration being recorded, which left setup-and-migrate unable to
    // finish: the column was already there, the ALTER failed with 42701, and
    // every app after this one in the loop never ran. The column it creates
    // is identical either way.
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" ADD COLUMN IF NOT EXISTS "release" jsonb NOT NULL DEFAULT '{}'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" DROP COLUMN "release"`
    );
  }
}

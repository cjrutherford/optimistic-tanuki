import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTrainerSiteMetadata1770000007000 implements MigrationInterface {
  name = 'AddTrainerSiteMetadata1770000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trainer_site_configs" ADD "site" jsonb`
    );
    await queryRunner.query(
      `ALTER TABLE "trainer_site_configs" ADD "serviceCatalog" jsonb`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trainer_site_configs" DROP COLUMN "serviceCatalog"`
    );
    await queryRunner.query(
      `ALTER TABLE "trainer_site_configs" DROP COLUMN "site"`
    );
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTrainerSiteConfigSections1770000005000
  implements MigrationInterface
{
  name = 'AddTrainerSiteConfigSections1770000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trainer_site_configs" ADD "features" jsonb`
    );
    await queryRunner.query(
      `ALTER TABLE "trainer_site_configs" ADD "services" jsonb`
    );
    await queryRunner.query(
      `ALTER TABLE "trainer_site_configs" ADD "landingPage" jsonb`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trainer_site_configs" DROP COLUMN "landingPage"`
    );
    await queryRunner.query(
      `ALTER TABLE "trainer_site_configs" DROP COLUMN "services"`
    );
    await queryRunner.query(
      `ALTER TABLE "trainer_site_configs" DROP COLUMN "features"`
    );
  }
}

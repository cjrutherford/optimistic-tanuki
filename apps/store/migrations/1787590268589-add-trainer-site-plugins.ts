import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTrainerSitePlugins1787590268589 implements MigrationInterface {
  name = 'AddTrainerSitePlugins1787590268589';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trainer_site_configs" ADD "plugins" jsonb`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trainer_site_configs" DROP COLUMN "plugins"`
    );
  }
}

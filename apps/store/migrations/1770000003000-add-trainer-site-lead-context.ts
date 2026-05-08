import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTrainerSiteLeadContext1770000003000
  implements MigrationInterface
{
  name = 'AddTrainerSiteLeadContext1770000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trainer_site_configs" ADD "leadContext" jsonb`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trainer_site_configs" DROP COLUMN "leadContext"`
    );
  }
}

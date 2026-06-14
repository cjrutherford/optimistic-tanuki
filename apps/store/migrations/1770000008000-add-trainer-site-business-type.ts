import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTrainerSiteBusinessType1770000008000
  implements MigrationInterface
{
  name = 'AddTrainerSiteBusinessType1770000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trainer_site_configs" ADD "businessType" character varying(64) NOT NULL DEFAULT 'general'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trainer_site_configs" DROP COLUMN "businessType"`
    );
  }
}

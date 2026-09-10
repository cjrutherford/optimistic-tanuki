import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppConfigurationRevision1787423433659
  implements MigrationInterface
{
  name = 'AddAppConfigurationRevision1787423433659';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" ADD "revision" integer NOT NULL DEFAULT '1'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" DROP COLUMN "revision"`
    );
  }
}

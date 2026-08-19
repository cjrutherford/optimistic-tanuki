import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConfigurablePluginManifest1786887274873
  implements MigrationInterface
{
  name = 'AddConfigurablePluginManifest1786887274873';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" ADD "manifest" jsonb`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" DROP COLUMN "manifest"`
    );
  }
}

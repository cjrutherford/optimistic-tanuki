import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppConfigurationOwnerContext1786894724770
  implements MigrationInterface
{
  name = 'AddAppConfigurationOwnerContext1786894724770';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" ADD "ownerUserId" character varying NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" ADD "ownerProfileId" character varying NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" ADD "appScope" character varying NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" DROP CONSTRAINT "UQ_640e0f2777c07298bcea44ed866"`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_f6771ab0886aff763b7e173ccb" ON "app_configuration_entity" ("ownerProfileId", "appScope", "name") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f6771ab0886aff763b7e173ccb"`
    );
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" ADD CONSTRAINT "UQ_640e0f2777c07298bcea44ed866" UNIQUE ("name")`
    );
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" DROP COLUMN "appScope"`
    );
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" DROP COLUMN "ownerProfileId"`
    );
    await queryRunner.query(
      `ALTER TABLE "app_configuration_entity" DROP COLUMN "ownerUserId"`
    );
  }
}

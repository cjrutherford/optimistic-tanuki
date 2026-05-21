import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTrainerSiteConfigs1770000001000 implements MigrationInterface {
  name = 'AddTrainerSiteConfigs1770000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "trainer_site_configs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "configKey" character varying(255) NOT NULL DEFAULT 'default', "brand" jsonb, "contact" jsonb, "clientPortal" jsonb, "testimonials" jsonb, "theme" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_trainer_site_configs_config_key" UNIQUE ("configKey"), CONSTRAINT "PK_trainer_site_configs_id" PRIMARY KEY ("id"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "trainer_site_configs"`);
  }
}

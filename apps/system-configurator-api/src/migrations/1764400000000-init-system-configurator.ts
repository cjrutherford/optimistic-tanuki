import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSystemConfigurator1764400000000
  implements MigrationInterface
{
  name = 'InitSystemConfigurator1764400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sc_chassis (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug varchar(64) NOT NULL UNIQUE,
        type varchar(8) NOT NULL,
        "useCase" varchar(32) NOT NULL,
        name varchar(255) NOT NULL,
        description text NOT NULL,
        "basePrice" numeric(10,2) NOT NULL DEFAULT 0,
        specifications jsonb NOT NULL DEFAULT '{}'::jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "sourceType" varchar(32) NOT NULL DEFAULT 'research',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sc_case_options (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "chassisSlug" varchar(64) NOT NULL,
        title varchar(255) NOT NULL,
        "optionType" varchar(32) NOT NULL,
        vendor varchar(64),
        "sourceName" varchar(64),
        "sourceUrl" text,
        "priceMin" numeric(10,2),
        "priceMax" numeric(10,2),
        "priceLabel" text,
        features jsonb NOT NULL DEFAULT '[]'::jsonb,
        "isRecommended" boolean NOT NULL DEFAULT false,
        "sourceType" varchar(32) NOT NULL DEFAULT 'curated',
        "externalSource" varchar(64),
        "externalId" varchar(255),
        "lastSyncedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sc_case_option_slug_title
      ON sc_case_options ("chassisSlug", title)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sc_hardware_parts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug varchar(64) NOT NULL UNIQUE,
        category varchar(16) NOT NULL,
        vendor varchar(64),
        name varchar(255) NOT NULL,
        description text,
        "basePrice" numeric(10,2) NOT NULL DEFAULT 0,
        "sellingPrice" numeric(10,2) NOT NULL DEFAULT 0,
        specs jsonb NOT NULL DEFAULT '{}'::jsonb,
        "compatibleChassisSlugs" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "inStock" boolean NOT NULL DEFAULT true,
        "isActive" boolean NOT NULL DEFAULT true,
        "sourceType" varchar(32) NOT NULL DEFAULT 'curated',
        "externalSource" varchar(64),
        "externalId" varchar(255),
        "sourceUrl" text,
        "lastSyncedAt" timestamptz,
        "syncStatus" varchar(16) NOT NULL DEFAULT 'seeded',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sc_hardware_orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        configuration jsonb NOT NULL,
        "priceBreakdown" jsonb NOT NULL,
        "shippingAddress" jsonb NOT NULL,
        "customerEmail" varchar(255) NOT NULL,
        "paymentMethod" varchar(32) NOT NULL,
        status varchar(32) NOT NULL,
        "estimatedDelivery" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sc_saved_configurations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        label varchar(255) NOT NULL,
        "customerEmail" varchar(255) NOT NULL,
        configuration jsonb NOT NULL,
        "priceBreakdown" jsonb NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS sc_saved_configurations');
    await queryRunner.query('DROP TABLE IF EXISTS sc_hardware_orders');
    await queryRunner.query('DROP TABLE IF EXISTS sc_hardware_parts');
    await queryRunner.query('DROP INDEX IF EXISTS idx_sc_case_option_slug_title');
    await queryRunner.query('DROP TABLE IF EXISTS sc_case_options');
    await queryRunner.query('DROP TABLE IF EXISTS sc_chassis');
  }
}

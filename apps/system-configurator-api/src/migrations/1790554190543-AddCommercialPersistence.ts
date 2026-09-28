import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommercialPersistence1790554190543
  implements MigrationInterface
{
  name = 'AddCommercialPersistence1790554190543';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "sc_supplier_offers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "vendor" character varying(32) NOT NULL, "sourceId" character varying(255) NOT NULL, "sourceSku" character varying(255) NOT NULL, "productName" character varying(512) NOT NULL, "sourceUrl" text, "hardwarePartId" uuid, "amount" numeric(12,2) NOT NULL, "currency" character(3) NOT NULL, "availability" character varying(24) NOT NULL DEFAULT 'unknown', "observedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_sc_supplier_offers_availability" CHECK ("availability" IN ('in_stock', 'backorder', 'out_of_stock', 'unknown')), CONSTRAINT "CHK_sc_supplier_offers_vendor" CHECK ("vendor" IN ('CDW', 'Newegg Business', 'Amazon Business', 'Dell OEM')), CONSTRAINT "PK_07f3182b88a6115aa5cddf2de61" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sc_supplier_offers_vendor_sku_observed" ON "sc_supplier_offers" ("vendor", "sourceSku", "observedAt") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_sc_supplier_offers_vendor_source_id" ON "sc_supplier_offers" ("vendor", "sourceId") `
    );
    await queryRunner.query(
      `CREATE TABLE "sc_commercial_quotes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sourceCost" numeric(12,2) NOT NULL, "currency" character(3) NOT NULL, "inputs" jsonb NOT NULL, "terms" jsonb NOT NULL, "pricingSnapshot" jsonb NOT NULL, "issuedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "validUntil" TIMESTAMP WITH TIME ZONE NOT NULL, "version" character varying(64) NOT NULL, "state" character varying(16) NOT NULL DEFAULT 'issued', "idempotencyKey" character varying(128) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_sc_commercial_quotes_state" CHECK ("state" IN ('issued', 'accepted', 'expired', 'withdrawn')), CONSTRAINT "PK_e2efedde23fa5e552ac8606dec5" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sc_commercial_quotes_valid_until" ON "sc_commercial_quotes" ("validUntil") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_sc_commercial_quotes_idempotency_key" ON "sc_commercial_quotes" ("idempotencyKey") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_sc_commercial_quotes_idempotency_key"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_sc_commercial_quotes_valid_until"`
    );
    await queryRunner.query(`DROP TABLE "sc_commercial_quotes"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_sc_supplier_offers_vendor_source_id"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_sc_supplier_offers_vendor_sku_observed"`
    );
    await queryRunner.query(`DROP TABLE "sc_supplier_offers"`);
  }
}

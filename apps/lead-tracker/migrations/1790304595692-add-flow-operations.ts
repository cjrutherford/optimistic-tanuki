import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFlowOperations1790304595692 implements MigrationInterface {
  name = 'AddFlowOperations1790304595692';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."flow_bookings_status_enum" AS ENUM('scheduled', 'en_route', 'in_progress', 'completed', 'cancelled')`
    );
    await queryRunner.query(
      `CREATE TABLE "flow_bookings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying(128) NOT NULL, "bookingId" character varying(64) NOT NULL, "trackingCode" character varying(32) NOT NULL, "estimateId" character varying(64) NOT NULL, "customerName" character varying(160) NOT NULL, "customerPhone" character varying(40) NOT NULL, "customerEmail" character varying(254) NOT NULL, "serviceAddress" character varying(240) NOT NULL, "gateCode" character varying(80), "serviceId" character varying(120) NOT NULL, "servicePackage" character varying(120) NOT NULL, "serviceName" character varying(160) NOT NULL, "scheduledDate" date NOT NULL, "arrivalWindow" character varying(120) NOT NULL, "photoUrls" jsonb NOT NULL DEFAULT '[]', "totalAmount" numeric(10,2) NOT NULL, "depositAmount" numeric(10,2) NOT NULL, "depositPaid" boolean NOT NULL DEFAULT false, "status" "public"."flow_bookings_status_enum" NOT NULL DEFAULT 'scheduled', "idempotencyKey" character varying(200) NOT NULL, "notes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_6aa904037d3ebe4295a77fc762e" UNIQUE ("bookingId"), CONSTRAINT "UQ_2578fbc98e0c3c810bd0f04bf21" UNIQUE ("trackingCode"), CONSTRAINT "UQ_363234ebbf91511a23aa1aca979" UNIQUE ("tenantId", "idempotencyKey"), CONSTRAINT "PK_e3b313a51984e743bf1ccb692fe" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_933336a122b6f0d2a9904d8dc5" ON "flow_bookings" ("tenantId", "serviceId", "scheduledDate", "arrivalWindow") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d426222a94709e6ffef348c9d6" ON "flow_bookings" ("tenantId", "status", "scheduledDate") `
    );
    await queryRunner.query(
      `CREATE TYPE "public"."flow_booking_updates_previousstatus_enum" AS ENUM('scheduled', 'en_route', 'in_progress', 'completed', 'cancelled')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."flow_booking_updates_status_enum" AS ENUM('scheduled', 'en_route', 'in_progress', 'completed', 'cancelled')`
    );
    await queryRunner.query(
      `CREATE TABLE "flow_booking_updates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying(128) NOT NULL, "bookingId" character varying(64) NOT NULL, "previousStatus" "public"."flow_booking_updates_previousstatus_enum", "status" "public"."flow_booking_updates_status_enum" NOT NULL, "actor" character varying(32) NOT NULL DEFAULT 'system', "note" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f0d681f99a36a3a17139ed36280" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_031063690b4d2cf093e47da7b3" ON "flow_booking_updates" ("tenantId", "bookingId", "createdAt") `
    );
    await queryRunner.query(
      `CREATE TABLE "flow_estimates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying(128) NOT NULL, "estimateId" character varying(64) NOT NULL, "idempotencyKey" character varying(200), "serviceId" character varying(120) NOT NULL, "servicePackage" character varying(120) NOT NULL, "serviceName" character varying(160) NOT NULL, "size" character varying(32) NOT NULL, "condition" character varying(32) NOT NULL, "squareFootage" integer, "tradeType" character varying(120), "basePrice" numeric(10,2) NOT NULL, "conditionMultiplier" numeric(6,4) NOT NULL, "subtotal" numeric(10,2) NOT NULL, "taxAmount" numeric(10,2) NOT NULL, "depositRequired" numeric(10,2) NOT NULL, "total" numeric(10,2) NOT NULL, "currency" character varying(8) NOT NULL DEFAULT 'USD', "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "pricingSnapshot" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_1ff6a7c05109562e6073a96a24f" UNIQUE ("tenantId", "idempotencyKey"), CONSTRAINT "UQ_dbe2a3f71a0055418b117a43fda" UNIQUE ("tenantId", "estimateId"), CONSTRAINT "PK_42ddf37d68ef497003ad944004a" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_221d1d681ce59afa24fb57d5c5" ON "flow_estimates" ("tenantId", "expiresAt") `
    );
    await queryRunner.query(
      `ALTER TABLE "flow_estimates" ENABLE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `ALTER TABLE "flow_estimates" FORCE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `CREATE POLICY "flow_estimates_tenant_isolation" ON "flow_estimates" USING ("tenantId" = current_setting('app.current_tenant_id', true)) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true))`
    );
    await queryRunner.query(
      `ALTER TABLE "flow_bookings" ENABLE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `ALTER TABLE "flow_bookings" FORCE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `CREATE POLICY "flow_bookings_tenant_isolation" ON "flow_bookings" USING ("tenantId" = current_setting('app.current_tenant_id', true)) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true))`
    );
    await queryRunner.query(
      `ALTER TABLE "flow_booking_updates" ENABLE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `ALTER TABLE "flow_booking_updates" FORCE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `CREATE POLICY "flow_booking_updates_tenant_isolation" ON "flow_booking_updates" USING ("tenantId" = current_setting('app.current_tenant_id', true)) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_221d1d681ce59afa24fb57d5c5"`
    );
    await queryRunner.query(`DROP TABLE "flow_estimates"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_031063690b4d2cf093e47da7b3"`
    );
    await queryRunner.query(`DROP TABLE "flow_booking_updates"`);
    await queryRunner.query(
      `DROP TYPE "public"."flow_booking_updates_status_enum"`
    );
    await queryRunner.query(
      `DROP TYPE "public"."flow_booking_updates_previousstatus_enum"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d426222a94709e6ffef348c9d6"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_933336a122b6f0d2a9904d8dc5"`
    );
    await queryRunner.query(`DROP TABLE "flow_bookings"`);
    await queryRunner.query(`DROP TYPE "public"."flow_bookings_status_enum"`);
  }
}

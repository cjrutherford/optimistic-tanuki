import { MigrationInterface, QueryRunner } from 'typeorm';

export class NexusCommercialOperations1790438130184
  implements MigrationInterface
{
  name = 'NexusCommercialOperations1790438130184';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "nexus_milestones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying(128) NOT NULL, "projectId" uuid NOT NULL, "phase" character varying(200) NOT NULL, "status" character varying(32) NOT NULL DEFAULT 'planned', "plannedStart" TIMESTAMP NOT NULL, "plannedEnd" TIMESTAMP NOT NULL, "actualStart" TIMESTAMP, "actualEnd" TIMESTAMP, "progressPercent" integer NOT NULL DEFAULT '0', "predecessorIds" uuid array NOT NULL DEFAULT '{}', "notes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e56c92c10f7ce1eb64471900c18" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_nexus_milestones_tenant_project" ON "nexus_milestones" ("tenantId", "projectId") `
    );
    await queryRunner.query(
      `CREATE TABLE "nexus_drawings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying(128) NOT NULL, "projectId" uuid NOT NULL, "title" character varying(255) NOT NULL, "version" character varying(64) NOT NULL, "storageKey" character varying(512) NOT NULL, "sha256" character varying(64) NOT NULL, "coiStatus" character varying(32) NOT NULL DEFAULT 'unverified', "coiExpiresAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_99f5253a8d3c702e8ff8aa3f2c4" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_nexus_drawings_tenant_project" ON "nexus_drawings" ("tenantId", "projectId") `
    );
    await queryRunner.query(
      `CREATE TABLE "nexus_inspection_photos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying(128) NOT NULL, "projectId" uuid NOT NULL, "fileName" character varying(255) NOT NULL, "storageKey" character varying(512) NOT NULL, "sha256" character varying(64) NOT NULL, "gpsLatitude" double precision, "gpsLongitude" double precision, "antivirusStatus" character varying(64) NOT NULL DEFAULT 'not_scanned', "capturedAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_83c48b3fe58e3a18366a5485c83" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_nexus_inspection_photos_tenant_project" ON "nexus_inspection_photos" ("tenantId", "projectId") `
    );
    await queryRunner.query(
      `CREATE TABLE "nexus_change_orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying(128) NOT NULL, "projectId" uuid NOT NULL, "title" character varying(255) NOT NULL, "description" text NOT NULL, "amountCents" bigint NOT NULL, "status" character varying(32) NOT NULL DEFAULT 'draft', "signatures" jsonb NOT NULL DEFAULT '[]', "documentKey" character varying(512), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2b94e4efef51b9879bc02cf7dce" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_nexus_change_orders_tenant_project" ON "nexus_change_orders" ("tenantId", "projectId") `
    );
    await queryRunner.query(
      `ALTER TABLE "nexus_milestones" ENABLE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `ALTER TABLE "nexus_milestones" FORCE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `CREATE POLICY "nexus_milestones_tenant_isolation" ON "nexus_milestones" USING ("tenantId" = current_setting('app.current_tenant_id', true)) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true))`
    );
    await queryRunner.query(
      `ALTER TABLE "nexus_drawings" ENABLE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `ALTER TABLE "nexus_drawings" FORCE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `CREATE POLICY "nexus_drawings_tenant_isolation" ON "nexus_drawings" USING ("tenantId" = current_setting('app.current_tenant_id', true)) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true))`
    );
    await queryRunner.query(
      `ALTER TABLE "nexus_inspection_photos" ENABLE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `ALTER TABLE "nexus_inspection_photos" FORCE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `CREATE POLICY "nexus_inspection_photos_tenant_isolation" ON "nexus_inspection_photos" USING ("tenantId" = current_setting('app.current_tenant_id', true)) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true))`
    );
    await queryRunner.query(
      `ALTER TABLE "nexus_change_orders" ENABLE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `ALTER TABLE "nexus_change_orders" FORCE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `CREATE POLICY "nexus_change_orders_tenant_isolation" ON "nexus_change_orders" USING ("tenantId" = current_setting('app.current_tenant_id', true)) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS "nexus_change_orders_tenant_isolation" ON "nexus_change_orders"`
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS "nexus_inspection_photos_tenant_isolation" ON "nexus_inspection_photos"`
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS "nexus_drawings_tenant_isolation" ON "nexus_drawings"`
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS "nexus_milestones_tenant_isolation" ON "nexus_milestones"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_nexus_change_orders_tenant_project"`
    );
    await queryRunner.query(`DROP TABLE "nexus_change_orders"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_nexus_inspection_photos_tenant_project"`
    );
    await queryRunner.query(`DROP TABLE "nexus_inspection_photos"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_nexus_drawings_tenant_project"`
    );
    await queryRunner.query(`DROP TABLE "nexus_drawings"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_nexus_milestones_tenant_project"`
    );
    await queryRunner.query(`DROP TABLE "nexus_milestones"`);
  }
}

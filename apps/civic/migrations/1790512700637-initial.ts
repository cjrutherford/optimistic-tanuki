import { MigrationInterface, QueryRunner } from 'typeorm';

export class Initial1790512700637 implements MigrationInterface {
  name = 'Initial1790512700637';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "civic_agendas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying(128) NOT NULL, "meetingBody" character varying(64) NOT NULL, "meetingDate" TIMESTAMP NOT NULL, "title" character varying(255) NOT NULL, "sourceFileName" character varying(255), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ddfab5947a7adc60a15a9f91b84" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_civic_agendas_tenant_body" ON "civic_agendas" ("tenantId", "meetingBody") `
    );
    await queryRunner.query(
      `CREATE TABLE "civic_agenda_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying(128) NOT NULL, "agendaId" uuid NOT NULL, "itemNumber" character varying(64), "title" character varying(500) NOT NULL, "summary" text NOT NULL, "pageRef" integer, CONSTRAINT "PK_f3a001ef5eebbeebc5820440d98" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_civic_agenda_items_agenda" ON "civic_agenda_items" ("agendaId") `
    );
    await queryRunner.query(
      `CREATE TABLE "tip_projects" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying(128) NOT NULL, "name" character varying(255) NOT NULL, "description" text NOT NULL, "geometry" jsonb NOT NULL, "fundingAllocatedCents" bigint NOT NULL, "fundingSpentCents" bigint NOT NULL DEFAULT '0', "status" character varying(64) NOT NULL, "milestone" character varying(255), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8950a1a349a4a9611b9d217ef12" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tip_projects_tenant" ON "tip_projects" ("tenantId") `
    );
    await queryRunner.query(
      `CREATE TABLE "emergency_broadcasts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying(128) NOT NULL, "severity" character varying(32) NOT NULL, "headline" character varying(255) NOT NULL, "body" text NOT NULL, "issuedAt" TIMESTAMP NOT NULL, "expiresAt" TIMESTAMP, "audience" character varying(255), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_116be3c890bc887d072b7419263" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_emergency_broadcasts_tenant_issued" ON "emergency_broadcasts" ("tenantId", "issuedAt") `
    );
    await queryRunner.query(
      `ALTER TABLE "civic_agendas" ENABLE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `ALTER TABLE "civic_agendas" FORCE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `CREATE POLICY "civic_agendas_tenant_isolation" ON "civic_agendas" USING ("tenantId" = current_setting('app.current_tenant_id', true)) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true))`
    );
    await queryRunner.query(
      `ALTER TABLE "civic_agenda_items" ENABLE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `ALTER TABLE "civic_agenda_items" FORCE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `CREATE POLICY "civic_agenda_items_tenant_isolation" ON "civic_agenda_items" USING ("tenantId" = current_setting('app.current_tenant_id', true)) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true))`
    );
    await queryRunner.query(
      `ALTER TABLE "tip_projects" ENABLE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `ALTER TABLE "tip_projects" FORCE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `CREATE POLICY "tip_projects_tenant_isolation" ON "tip_projects" USING ("tenantId" = current_setting('app.current_tenant_id', true)) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true))`
    );
    await queryRunner.query(
      `ALTER TABLE "emergency_broadcasts" ENABLE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `ALTER TABLE "emergency_broadcasts" FORCE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `CREATE POLICY "emergency_broadcasts_tenant_isolation" ON "emergency_broadcasts" USING ("tenantId" = current_setting('app.current_tenant_id', true)) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS "emergency_broadcasts_tenant_isolation" ON "emergency_broadcasts"`
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS "tip_projects_tenant_isolation" ON "tip_projects"`
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS "civic_agenda_items_tenant_isolation" ON "civic_agenda_items"`
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS "civic_agendas_tenant_isolation" ON "civic_agendas"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_emergency_broadcasts_tenant_issued"`
    );
    await queryRunner.query(`DROP TABLE "emergency_broadcasts"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_tip_projects_tenant"`);
    await queryRunner.query(`DROP TABLE "tip_projects"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_civic_agenda_items_agenda"`
    );
    await queryRunner.query(`DROP TABLE "civic_agenda_items"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_civic_agendas_tenant_body"`
    );
    await queryRunner.query(`DROP TABLE "civic_agendas"`);
  }
}

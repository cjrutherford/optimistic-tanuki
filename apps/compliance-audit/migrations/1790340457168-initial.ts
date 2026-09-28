import { MigrationInterface, QueryRunner } from 'typeorm';

export class Initial1790340457168 implements MigrationInterface {
  name = 'Initial1790340457168';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "compliance_audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying(128) NOT NULL, "action" character varying(128) NOT NULL, "documentId" character varying(128), "fileName" character varying(255), "documentHash" character varying(64) NOT NULL, "previousHash" character varying(64) NOT NULL, "chainedHash" character varying(64) NOT NULL, "antivirusStatus" character varying(64) NOT NULL DEFAULT 'not_scanned', "complianceStandard" character varying(255) NOT NULL DEFAULT 'FTC Safeguards Rule 16 CFR Part 314, IRS Pub 4557', "metadata" jsonb, "timestamp" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d8fc162802a31ed9f4f3f8cb854" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_compliance_audit_logs_tenant_chain" ON "compliance_audit_logs" ("tenantId", "timestamp") `
    );
    await queryRunner.query(
      `ALTER TABLE "compliance_audit_logs" ENABLE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `ALTER TABLE "compliance_audit_logs" FORCE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `CREATE POLICY "compliance_audit_logs_tenant_isolation" ON "compliance_audit_logs" USING ("tenantId" = current_setting('app.current_tenant_id', true)) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY "compliance_audit_logs_tenant_isolation" ON "compliance_audit_logs"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_compliance_audit_logs_tenant_chain"`
    );
    await queryRunner.query(`DROP TABLE "compliance_audit_logs"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class VaultTokens1790432383878 implements MigrationInterface {
  name = 'VaultTokens1790432383878';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "vault_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "jti" character varying(128) NOT NULL, "tenantId" character varying(128) NOT NULL, "documentId" character varying(255) NOT NULL, "purpose" character varying(64) NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "consumedAt" TIMESTAMP, "revokedAt" TIMESTAMP, "issuedBy" character varying(255), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5a8d03d460588a0a48e9cd3ffce" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vault_tokens_tenant" ON "vault_tokens" ("tenantId") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_vault_tokens_jti" ON "vault_tokens" ("jti") `
    );
    await queryRunner.query(
      `ALTER TABLE "vault_tokens" ENABLE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `ALTER TABLE "vault_tokens" FORCE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `CREATE POLICY "vault_tokens_tenant_isolation" ON "vault_tokens" USING ("tenantId" = current_setting('app.current_tenant_id', true)) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS "vault_tokens_tenant_isolation" ON "vault_tokens"`
    );
    await queryRunner.query(`DROP INDEX "public"."UQ_vault_tokens_jti"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_vault_tokens_tenant"`);
    await queryRunner.query(`DROP TABLE "vault_tokens"`);
  }
}

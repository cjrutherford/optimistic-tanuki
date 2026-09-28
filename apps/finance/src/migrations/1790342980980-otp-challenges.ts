import { MigrationInterface, QueryRunner } from 'typeorm';

export class OtpChallenges1790342980980 implements MigrationInterface {
  name = 'OtpChallenges1790342980980';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "otp_challenges" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying(128) NOT NULL, "tokenId" character varying(512) NOT NULL, "purpose" character varying(128) NOT NULL, "stateType" character varying(32) NOT NULL DEFAULT 'session', "codeHash" character varying(128), "codeSalt" character varying(64), "expiresAt" TIMESTAMP NOT NULL, "attemptCount" integer NOT NULL DEFAULT '0', "consumedAt" TIMESTAMP, "lastAcceptedCounter" bigint, "windowSeconds" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c34f21df6c8aa51229715452068" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_otp_challenges_tenant_expires" ON "otp_challenges" ("tenantId", "expiresAt") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_otp_challenges_tenant_token_purpose_state" ON "otp_challenges" ("tenantId", "tokenId", "purpose", "stateType") `
    );
    await queryRunner.query(
      `ALTER TABLE "otp_challenges" ENABLE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `ALTER TABLE "otp_challenges" FORCE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `CREATE POLICY "otp_challenges_tenant_isolation" ON "otp_challenges" USING ("tenantId" = current_setting('app.current_tenant_id', true)) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_otp_challenges_tenant_token_purpose_state"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_otp_challenges_tenant_expires"`
    );
    await queryRunner.query(`DROP TABLE "otp_challenges"`);
  }
}

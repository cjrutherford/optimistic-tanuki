import { MigrationInterface, QueryRunner } from 'typeorm';

export class ScopeLeadsByProfile2026040200000 implements MigrationInterface {
  name = 'ScopeLeadsByProfile2026040200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "leads" ADD COLUMN "appScope" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ADD COLUMN "profileId" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ADD COLUMN "userId" character varying`
    );

    await queryRunner.query(
      `ALTER TABLE "lead_topics" ADD COLUMN "appScope" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "lead_topics" ADD COLUMN "profileId" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "lead_topics" ADD COLUMN "userId" character varying`
    );

    await queryRunner.query(
      `ALTER TABLE "lead_flags" ADD COLUMN "profileId" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "lead_flags" ADD COLUMN "userId" character varying`
    );

    await queryRunner.query(
      `ALTER TABLE "lead_onboarding_profiles" ADD COLUMN "profileId" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "lead_onboarding_profiles" ADD COLUMN "appScope" character varying`
    );

    await queryRunner.query(
      `UPDATE "leads" SET "appScope" = 'leads-app', "profileId" = 'legacy-shared-workspace', "userId" = COALESCE("userId", 'legacy-shared-user') WHERE "appScope" IS NULL OR "profileId" IS NULL OR "userId" IS NULL`
    );
    await queryRunner.query(
      `UPDATE "lead_topics" SET "appScope" = 'leads-app', "profileId" = 'legacy-shared-workspace', "userId" = COALESCE("userId", 'legacy-shared-user') WHERE "appScope" IS NULL OR "profileId" IS NULL OR "userId" IS NULL`
    );
    await queryRunner.query(
      `UPDATE "lead_flags" f SET "profileId" = COALESCE(f."profileId", l."profileId", 'legacy-shared-workspace'), "userId" = COALESCE(f."userId", l."userId", 'legacy-shared-user') FROM "leads" l WHERE l."id" = f."leadId"`
    );
    await queryRunner.query(
      `UPDATE "lead_flags" SET "profileId" = COALESCE("profileId", 'legacy-shared-workspace'), "userId" = COALESCE("userId", 'legacy-shared-user') WHERE "profileId" IS NULL OR "userId" IS NULL`
    );
    await queryRunner.query(
      `UPDATE "lead_onboarding_profiles" SET "profileId" = COALESCE("profileId", 'legacy-shared-workspace'), "appScope" = COALESCE("appScope", 'leads-app') WHERE "profileId" IS NULL OR "appScope" IS NULL`
    );

    await queryRunner.query(
      `ALTER TABLE "leads" ALTER COLUMN "appScope" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ALTER COLUMN "profileId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ALTER COLUMN "userId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ALTER COLUMN "appScope" SET DEFAULT 'leads-app'`
    );

    await queryRunner.query(
      `ALTER TABLE "lead_topics" ALTER COLUMN "appScope" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "lead_topics" ALTER COLUMN "profileId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "lead_topics" ALTER COLUMN "userId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "lead_topics" ALTER COLUMN "appScope" SET DEFAULT 'leads-app'`
    );

    await queryRunner.query(
      `ALTER TABLE "lead_flags" ALTER COLUMN "profileId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "lead_flags" ALTER COLUMN "userId" SET NOT NULL`
    );

    await queryRunner.query(
      `ALTER TABLE "lead_onboarding_profiles" ALTER COLUMN "appScope" SET DEFAULT 'leads-app'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lead_onboarding_profiles" DROP COLUMN "appScope"`
    );
    await queryRunner.query(
      `ALTER TABLE "lead_onboarding_profiles" DROP COLUMN "profileId"`
    );
    await queryRunner.query(
      `ALTER TABLE "lead_flags" DROP COLUMN "userId"`
    );
    await queryRunner.query(
      `ALTER TABLE "lead_flags" DROP COLUMN "profileId"`
    );
    await queryRunner.query(
      `ALTER TABLE "lead_topics" DROP COLUMN "userId"`
    );
    await queryRunner.query(
      `ALTER TABLE "lead_topics" DROP COLUMN "profileId"`
    );
    await queryRunner.query(
      `ALTER TABLE "lead_topics" DROP COLUMN "appScope"`
    );
    await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN "userId"`);
    await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN "profileId"`);
    await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN "appScope"`);
  }
}

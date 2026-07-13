import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmailAuthentication1783915200000 implements MigrationInterface {
  name = 'EmailAuthentication1783915200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_entity" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" timestamptz`
    );
    await queryRunner.query(
      `ALTER TABLE "token" ADD COLUMN IF NOT EXISTS "profileId" uuid`
    );
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "auth_action_token_purpose_enum" AS ENUM ('verification', 'password-reset', 'magic-link'); EXCEPTION WHEN duplicate_object THEN null; END $$;`
    );
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "auth_action_token" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "tokenHash" character varying(64) NOT NULL,
      "purpose" "auth_action_token_purpose_enum" NOT NULL,
      "appId" character varying NOT NULL,
      "returnPath" character varying NOT NULL DEFAULT '/',
      "expiresAt" timestamptz NOT NULL,
      "consumedAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "userId" uuid NOT NULL,
      CONSTRAINT "PK_auth_action_token" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_auth_action_token_hash" UNIQUE ("tokenHash"),
      CONSTRAINT "FK_auth_action_token_user" FOREIGN KEY ("userId") REFERENCES "user_entity"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_auth_action_token_lookup" ON "auth_action_token" ("userId", "purpose", "appId", "consumedAt")`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "auth_action_token"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "auth_action_token_purpose_enum"`
    );
    await queryRunner.query(
      `ALTER TABLE "token" DROP COLUMN IF EXISTS "profileId"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_entity" DROP COLUMN IF EXISTS "emailVerifiedAt"`
    );
  }
}

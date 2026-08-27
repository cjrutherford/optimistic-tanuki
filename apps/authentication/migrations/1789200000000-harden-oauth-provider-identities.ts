import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenOAuthProviderIdentities1789200000000
  implements MigrationInterface
{
  name = 'HardenOAuthProviderIdentities1789200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Preserve the oldest link, then its UUID as a stable tie-breaker, before
    // applying the uniqueness guarantees.
    await queryRunner.query(`
      DELETE FROM "oauth_provider" AS duplicate
      USING (
        SELECT "id", ROW_NUMBER() OVER (
          PARTITION BY "provider", "providerUserId"
          ORDER BY "createdAt" ASC, "id" ASC
        ) AS row_number
        FROM "oauth_provider"
      ) AS ranked
      WHERE duplicate."id" = ranked."id" AND ranked.row_number > 1
    `);

    await queryRunner.query(`
      DELETE FROM "oauth_provider" AS duplicate
      USING (
        SELECT "id", ROW_NUMBER() OVER (
          PARTITION BY "userId", "provider"
          ORDER BY "createdAt" ASC, "id" ASC
        ) AS row_number
        FROM "oauth_provider"
      ) AS ranked
      WHERE duplicate."id" = ranked."id" AND ranked.row_number > 1
    `);

    await queryRunner.query(
      'ALTER TABLE "oauth_provider" DROP COLUMN IF EXISTS "accessToken"'
    );
    await queryRunner.query(
      'ALTER TABLE "oauth_provider" DROP COLUMN IF EXISTS "refreshToken"'
    );

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_oauth_provider_identity"
      ON "oauth_provider" ("provider", "providerUserId")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_oauth_provider_user_provider"
      ON "oauth_provider" ("userId", "provider")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "UQ_oauth_provider_user_provider"'
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "UQ_oauth_provider_identity"'
    );
    await queryRunner.query(
      'ALTER TABLE "oauth_provider" ADD COLUMN IF NOT EXISTS "accessToken" text'
    );
    await queryRunner.query(
      'ALTER TABLE "oauth_provider" ADD COLUMN IF NOT EXISTS "refreshToken" text'
    );
  }
}

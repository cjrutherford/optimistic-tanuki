import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOAuthProviderTable1740000000000
  implements MigrationInterface
{
  name = 'CreateOAuthProviderTable1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "oauth_provider" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "provider" character varying NOT NULL,
        "providerUserId" character varying NOT NULL,
        "providerEmail" character varying,
        "providerDisplayName" character varying,
        "accessToken" text,
        "refreshToken" text,
        "userId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_oauth_provider_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_oauth_provider_userId" ON "oauth_provider" ("userId")
    `);

    await queryRunner.query(`
      ALTER TABLE "oauth_provider" 
      ADD CONSTRAINT "FK_oauth_provider_userId" 
      FOREIGN KEY ("userId") REFERENCES "user_entity"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "oauth_provider" 
      DROP CONSTRAINT "FK_oauth_provider_userId"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_oauth_provider_userId"
    `);

    await queryRunner.query(`DROP TABLE "oauth_provider"`);
  }
}

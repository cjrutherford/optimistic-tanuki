import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * O13/E14: business content tables owned by social.
 *
 * Trimmed from the generated diff, which also rewrote unrelated
 * community_member/community_invite status columns (enum drift between the
 * entities and the live schema — destructive and out of scope). Only the
 * three additive CREATEs ship here.
 */
export class AddBusinessContentTables1789955609720
  implements MigrationInterface
{
  name = 'AddBusinessContentTables1789955609720';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "business_page_contents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "communityId" uuid NOT NULL, "ownerId" uuid NOT NULL, "name" character varying, "description" text, "logoUrl" character varying, "website" character varying, "phone" character varying, "email" character varying, "address" text, "tier" character varying NOT NULL DEFAULT 'basic', "subscriptionStatus" character varying NOT NULL DEFAULT 'inactive', "pinnedPostId" uuid, "isCommunity" boolean NOT NULL DEFAULT false, "isFeatured" boolean NOT NULL DEFAULT false, "paymentsBusinessPageId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fc25b3c3039e91a501b78f35ebf" UNIQUE ("communityId"), CONSTRAINT "PK_a169e059d63c8d7240fe18a52d9" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_99986203aba49f35f9b7744955" ON "business_page_contents" ("ownerId") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_fc25b3c3039e91a501b78f35eb" ON "business_page_contents" ("communityId") `
    );
    await queryRunner.query(
      `CREATE TABLE "business_theme_contents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessPageId" uuid NOT NULL, "personalityId" character varying, "primaryColor" character varying, "accentColor" character varying, "backgroundColor" character varying, "customCss" text, "customFontFamily" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9c464d0490f5e24f962b3388daa" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_896a953d1f3c7364dd032d2acf" ON "business_theme_contents" ("businessPageId") `
    );
    await queryRunner.query(
      `CREATE TABLE "community_sponsorship_contents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "communityId" uuid NOT NULL, "businessPageId" uuid, "userId" uuid NOT NULL, "type" character varying NOT NULL, "adContent" text, "status" character varying NOT NULL DEFAULT 'pending', "startsAt" TIMESTAMP, "expiresAt" TIMESTAMP, "months" integer NOT NULL DEFAULT '1', "paymentsSponsorshipId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d381c56b260284a053a8f736413" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_77a6f5a286eace0746806fdf4a" ON "community_sponsorship_contents" ("userId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_74d604371cac60a62e747d6602" ON "community_sponsorship_contents" ("communityId") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_74d604371cac60a62e747d6602"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_77a6f5a286eace0746806fdf4a"`
    );
    await queryRunner.query(`DROP TABLE "community_sponsorship_contents"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_896a953d1f3c7364dd032d2acf"`
    );
    await queryRunner.query(`DROP TABLE "business_theme_contents"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fc25b3c3039e91a501b78f35eb"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_99986203aba49f35f9b7744955"`
    );
    await queryRunner.query(`DROP TABLE "business_page_contents"`);
  }
}

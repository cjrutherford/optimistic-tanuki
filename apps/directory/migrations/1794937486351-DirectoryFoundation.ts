import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryFoundation1794937486351 implements MigrationInterface {
  name = 'DirectoryFoundation1794937486351';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_listing_suppression" ("id" uuid NOT NULL, "communityId" uuid NOT NULL, "listingId" uuid NOT NULL, "scanId" character varying(64) NOT NULL, "sourceFileRowNumber" bigint NOT NULL, "businessId" uuid, "reasonCode" character varying(24) NOT NULL, "note" character varying(1024), "actorId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "liftedAt" TIMESTAMP WITH TIME ZONE, "liftReasonCode" character varying(24), "liftedById" uuid, CONSTRAINT "CHK_directory_listing_suppression_lift_pair" CHECK (("liftedAt" IS NULL) = ("liftReasonCode" IS NULL)), CONSTRAINT "CHK_directory_listing_suppression_lift_reason" CHECK ("liftReasonCode" IS NULL OR "liftReasonCode" IN ('resolved','mistaken-suppression','other')), CONSTRAINT "CHK_directory_listing_suppression_reason" CHECK ("reasonCode" IN ('rights-request','incorrect-details','closed-business','safety','duplicate','other')), CONSTRAINT "PK_347595bfb0feb7df3186b4119c6" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_directory_listing_suppression_open_row" ON "directory_listing_suppression" ("scanId", "sourceFileRowNumber") WHERE "liftedAt" IS NULL`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_listing_suppression_business" ON "directory_listing_suppression" ("businessId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_listing_suppression_town" ON "directory_listing_suppression" ("communityId", "createdAt") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_listing_suppression_town"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_listing_suppression_business"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_directory_listing_suppression_open_row"`
    );
    await queryRunner.query(`DROP TABLE "directory_listing_suppression"`);
  }
}

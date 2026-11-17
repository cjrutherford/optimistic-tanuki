import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryFoundation1794940218376 implements MigrationInterface {
  name = 'DirectoryFoundation1794940218376';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_listing_report" ("id" uuid NOT NULL, "communityId" uuid NOT NULL, "listingId" uuid NOT NULL, "listingName" character varying(300), "reasonCode" character varying(24) NOT NULL, "note" character varying(1000), "status" character varying(16) NOT NULL DEFAULT 'received', "priority" boolean NOT NULL DEFAULT false, "receiptTokenHash" character(64) NOT NULL, "contactEmailHash" character(64), "suppressionId" uuid, "decidedById" uuid, "decidedAt" TIMESTAMP WITH TIME ZONE, "decisionNote" character varying(1000), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_directory_listing_report_note" CHECK ("note" IS NULL OR char_length("note") <= 1000), CONSTRAINT "CHK_directory_listing_report_status" CHECK ("status" IN ('received','under_review','resolved','declined')), CONSTRAINT "CHK_directory_listing_report_reason" CHECK ("reasonCode" IN ('rights-request','incorrect-details','closed-business','safety','duplicate','other')), CONSTRAINT "PK_84483e901c4c64ef70d7acb866b" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_listing_report_listing" ON "directory_listing_report" ("communityId", "listingId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_listing_report_queue" ON "directory_listing_report" ("communityId", "priority", "createdAt") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_listing_report_town_status" ON "directory_listing_report" ("communityId", "status") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_directory_listing_report_receipt" ON "directory_listing_report" ("receiptTokenHash") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_directory_listing_report_receipt"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_listing_report_town_status"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_listing_report_queue"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_listing_report_listing"`
    );
    await queryRunner.query(`DROP TABLE "directory_listing_report"`);
  }
}

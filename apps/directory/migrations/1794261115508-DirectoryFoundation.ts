import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryFoundation1794261115508 implements MigrationInterface {
  name = 'DirectoryFoundation1794261115508';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_business_link_request" ("requestId" uuid NOT NULL, "townId" uuid NOT NULL, "listingId" uuid NOT NULL, "businessCommunityId" uuid NOT NULL, "ownerId" uuid NOT NULL, "status" character varying(16) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_eae438b18f8f7702e7bcdb0b92a" PRIMARY KEY ("requestId"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_business_link_listing" ON "directory_business_link_request" ("listingId") `
    );
    await queryRunner.query(
      `CREATE TABLE "directory_business_link_active" ("listingId" uuid NOT NULL, "requestId" uuid NOT NULL, CONSTRAINT "PK_454a0b1ebc40b3bf059136a55b1" PRIMARY KEY ("listingId"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_directory_business_link_active_request" ON "directory_business_link_active" ("requestId") `
    );
    await queryRunner.query(
      `CREATE TABLE "directory_business_link_event" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "requestId" uuid NOT NULL, "actorId" uuid NOT NULL, "action" character varying(16) NOT NULL, "evidenceUrl" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_143549c8e0cfb845b1425a44f43" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_business_link_event_request" ON "directory_business_link_event" ("requestId") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_business_link_event_request"`
    );
    await queryRunner.query(`DROP TABLE "directory_business_link_event"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_directory_business_link_active_request"`
    );
    await queryRunner.query(`DROP TABLE "directory_business_link_active"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_business_link_listing"`
    );
    await queryRunner.query(`DROP TABLE "directory_business_link_request"`);
  }
}

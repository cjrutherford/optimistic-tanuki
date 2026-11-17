import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryFoundation1794823970564 implements MigrationInterface {
  name = 'DirectoryFoundation1794823970564';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_business_link_carry" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "requestId" uuid NOT NULL, "businessId" uuid NOT NULL, "fromListingId" uuid NOT NULL, "toListingId" uuid NOT NULL, "state" character varying(24) NOT NULL DEFAULT 'awaiting_confirmation', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_directory_business_link_carry_state" CHECK ("state" IN ('awaiting_confirmation','restored','closed')), CONSTRAINT "PK_304dfe95e35bf099000b1292e67" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_business_link_carry_state" ON "directory_business_link_carry" ("state") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_directory_business_link_carry_target" ON "directory_business_link_carry" ("requestId", "toListingId") `
    );
    await queryRunner.query(
      `CREATE TABLE "directory_business_identity_decision" ("id" uuid NOT NULL, "communityId" uuid NOT NULL, "action" character varying(16) NOT NULL, "businessId" uuid NOT NULL, "otherBusinessId" uuid, "actorId" uuid, "actorDomain" character varying(16), "reason" character varying(1024) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_directory_business_identity_decision_action" CHECK ("action" IN ('confirm','merge','split','retire')), CONSTRAINT "PK_25ace72be560e5a3d88bfe7cdeb" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_business_identity_decision_business" ON "directory_business_identity_decision" ("businessId") `
    );
    await queryRunner.query(
      `ALTER TABLE "directory_business_link_request" ADD "businessId" uuid`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_business_link_request_business" ON "directory_business_link_request" ("businessId") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_business_link_request_business"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_business_link_request" DROP COLUMN "businessId"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_business_identity_decision_business"`
    );
    await queryRunner.query(
      `DROP TABLE "directory_business_identity_decision"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_directory_business_link_carry_target"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_business_link_carry_state"`
    );
    await queryRunner.query(`DROP TABLE "directory_business_link_carry"`);
  }
}

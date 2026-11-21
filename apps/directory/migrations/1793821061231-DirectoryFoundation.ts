import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryFoundation1793821061231 implements MigrationInterface {
  name = 'DirectoryFoundation1793821061231';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_reconciliation_receipt" ("eventId" bigint NOT NULL, "communityId" uuid NOT NULL, "appliedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_332789b4b2a30f3dda8c216e8fa" PRIMARY KEY ("eventId"))`
    );
    await queryRunner.query(
      `CREATE TABLE "directory_provider_work" ("communityId" uuid NOT NULL, "status" character varying NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4a2df9ac93e8949e7411541b5fe" PRIMARY KEY ("communityId"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "directory_provider_work"`);
    await queryRunner.query(`DROP TABLE "directory_reconciliation_receipt"`);
  }
}

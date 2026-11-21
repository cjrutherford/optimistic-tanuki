import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryBoundaryAuto1794988660111 implements MigrationInterface {
  name = 'DirectoryBoundaryAuto1794988660111';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_boundary_auto_attempt" ("communityId" uuid NOT NULL, "status" character varying(16) NOT NULL, "reason" character varying(120) NOT NULL, "changeToken" uuid, "requestId" uuid, "candidates" jsonb NOT NULL DEFAULT '[]', "attempts" integer NOT NULL DEFAULT '1', "attemptedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_directory_boundary_auto_status" CHECK (status IN ('installed','ambiguous','unmatched','unsupported','undone','error')), CONSTRAINT "PK_2c14e3e8a3006276e471fe64814" PRIMARY KEY ("communityId"))`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_boundary_decision" ADD "automatic" boolean NOT NULL DEFAULT false`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_boundary_decision" ADD "reason" character varying(120)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "directory_boundary_decision" DROP COLUMN "reason"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_boundary_decision" DROP COLUMN "automatic"`
    );
    await queryRunner.query(`DROP TABLE "directory_boundary_auto_attempt"`);
  }
}

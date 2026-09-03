import { MigrationInterface, QueryRunner } from 'typeorm';

export class AiChangeAndTaskFields1787875395070 implements MigrationInterface {
  name = 'AiChangeAndTaskFields1787875395070';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ai_change" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" character varying NOT NULL, "proposedBy" character varying NOT NULL, "operation" character varying NOT NULL, "payload" jsonb NOT NULL, "status" character varying NOT NULL DEFAULT 'PENDING', "reviewedBy" character varying, "reviewNote" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ca95648fae41285afdcf8a272ff" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "task" ADD "assignee" character varying`
    );
    await queryRunner.query(`ALTER TABLE "task" ADD "dueDate" TIMESTAMP`);
    await queryRunner.query(
      `ALTER TABLE "project" ADD "isPublic" boolean NOT NULL DEFAULT false`
    );
    await queryRunner.query(
      `ALTER TABLE "project" ADD "requireHumanApproval" boolean NOT NULL DEFAULT true`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project" DROP COLUMN "requireHumanApproval"`
    );
    await queryRunner.query(`ALTER TABLE "project" DROP COLUMN "isPublic"`);
    await queryRunner.query(`ALTER TABLE "task" DROP COLUMN "dueDate"`);
    await queryRunner.query(`ALTER TABLE "task" DROP COLUMN "assignee"`);
    await queryRunner.query(`DROP TABLE "ai_change"`);
  }
}

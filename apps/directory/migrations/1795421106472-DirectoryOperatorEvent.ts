import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryOperatorEvent1795421106472 implements MigrationInterface {
  name = 'DirectoryOperatorEvent1795421106472';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_operator_event" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "kind" character varying(32) NOT NULL, "subjectId" character varying(100) NOT NULL, "action" character varying(32) NOT NULL, "actorId" uuid, "reason" text, "detail" jsonb, "at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1d6a055f0f61c1bbcb67e2dd76d" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_operator_event_subject" ON "directory_operator_event" ("kind", "subjectId", "at") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_operator_event_subject"`
    );
    await queryRunner.query(`DROP TABLE "directory_operator_event"`);
  }
}

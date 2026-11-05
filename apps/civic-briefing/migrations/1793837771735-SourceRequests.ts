import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceRequests1793837771735 implements MigrationInterface {
  name = 'SourceRequests1793837771735';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "source_requests" ("id" uuid NOT NULL, "slug" character varying NOT NULL, "userId" character varying NOT NULL, "note" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_eb52e91d83803448da1d759d16a" UNIQUE ("slug", "userId"), CONSTRAINT "PK_1eeb5cc85795084d4d77ddfd81a" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b51fa24b53b02ea847349160a0" ON "source_requests" ("slug") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b51fa24b53b02ea847349160a0"`
    );
    await queryRunner.query(`DROP TABLE "source_requests"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourcesAdmin1795421681325 implements MigrationInterface {
  name = 'SourcesAdmin1795421681325';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "source_overrides" ("id" uuid NOT NULL, "slug" character varying NOT NULL, "sourceKey" character varying NOT NULL, "kind" character varying NOT NULL, "reason" text NOT NULL, "actor" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "clearedAt" TIMESTAMP WITH TIME ZONE, "clearedBy" character varying, "clearReason" text, CONSTRAINT "PK_6ba5b97ba8650fc5ec77b2ed361" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5d1f2dc0754e129b07ea3175b2" ON "source_overrides" ("sourceKey") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_80812976c1803533bc691068a5" ON "source_overrides" ("slug") `
    );
    await queryRunner.query(
      `ALTER TABLE "source_requests" ADD "status" character varying NOT NULL DEFAULT 'pending'`
    );
    await queryRunner.query(
      `ALTER TABLE "source_requests" ADD "decidedBy" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "source_requests" ADD "decidedAt" TIMESTAMP WITH TIME ZONE`
    );
    await queryRunner.query(
      `ALTER TABLE "source_requests" ADD "decisionReason" text`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source_requests" DROP COLUMN "decisionReason"`
    );
    await queryRunner.query(
      `ALTER TABLE "source_requests" DROP COLUMN "decidedAt"`
    );
    await queryRunner.query(
      `ALTER TABLE "source_requests" DROP COLUMN "decidedBy"`
    );
    await queryRunner.query(
      `ALTER TABLE "source_requests" DROP COLUMN "status"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_80812976c1803533bc691068a5"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5d1f2dc0754e129b07ea3175b2"`
    );
    await queryRunner.query(`DROP TABLE "source_overrides"`);
  }
}

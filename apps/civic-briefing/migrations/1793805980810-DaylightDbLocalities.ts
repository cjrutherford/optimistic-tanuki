import { MigrationInterface, QueryRunner } from 'typeorm';

export class DaylightDbLocalities1793805980810 implements MigrationInterface {
  name = 'DaylightDbLocalities1793805980810';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "sourcing_decisions" ("id" SERIAL NOT NULL, "slug" character varying NOT NULL, "ownerSlug" character varying, "sourceKey" character varying, "adapter" character varying, "url" character varying, "decision" character varying NOT NULL, "via" character varying, "reason" text, "evidence" text, "localDate" character varying, "detail" text, "decidedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_b30a49293edc6b312534c68f361" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d88b308c89361b099e1101c047" ON "sourcing_decisions" ("slug", "decidedAt") `
    );
    await queryRunner.query(`ALTER TABLE "localities" ADD "communityId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "localities" ADD CONSTRAINT "UQ_71304cf582921c0783978273063" UNIQUE ("communityId")`
    );
    await queryRunner.query(
      `ALTER TABLE "localities" ADD "active" boolean NOT NULL DEFAULT true`
    );
    await queryRunner.query(
      `ALTER TABLE "localities" ADD "syncedAt" TIMESTAMP WITH TIME ZONE`
    );
    await queryRunner.query(`ALTER TABLE "localities" ADD "topics" text`);
    await queryRunner.query(`ALTER TABLE "localities" ADD "cadence" text`);
    await queryRunner.query(`ALTER TABLE "localities" ADD "websites" text`);
    await queryRunner.query(
      `ALTER TABLE "sources" ADD "origin" character varying`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sources" DROP COLUMN "origin"`);
    await queryRunner.query(`ALTER TABLE "localities" DROP COLUMN "websites"`);
    await queryRunner.query(`ALTER TABLE "localities" DROP COLUMN "cadence"`);
    await queryRunner.query(`ALTER TABLE "localities" DROP COLUMN "topics"`);
    await queryRunner.query(`ALTER TABLE "localities" DROP COLUMN "syncedAt"`);
    await queryRunner.query(`ALTER TABLE "localities" DROP COLUMN "active"`);
    await queryRunner.query(
      `ALTER TABLE "localities" DROP CONSTRAINT "UQ_71304cf582921c0783978273063"`
    );
    await queryRunner.query(
      `ALTER TABLE "localities" DROP COLUMN "communityId"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d88b308c89361b099e1101c047"`
    );
    await queryRunner.query(`DROP TABLE "sourcing_decisions"`);
  }
}

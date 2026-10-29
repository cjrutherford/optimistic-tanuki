import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostLinkAssociation1792605693700 implements MigrationInterface {
  name = 'PostLinkAssociation1792605693700';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "post_link" ("postId" uuid NOT NULL, "linkId" integer NOT NULL, CONSTRAINT "PK_b014e2ca96dcc634c4d4735e7a5" PRIMARY KEY ("postId", "linkId"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_07ece436838f80564c9cb0d7ca" ON "post_link" ("postId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_870f4cc07c0dbfe216a49fe8e2" ON "post_link" ("linkId") `
    );
    await queryRunner.query(
      `ALTER TABLE "post_link" ADD CONSTRAINT "FK_07ece436838f80564c9cb0d7ca4" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "post_link" ADD CONSTRAINT "FK_870f4cc07c0dbfe216a49fe8e24" FOREIGN KEY ("linkId") REFERENCES "link"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post_link" DROP CONSTRAINT "FK_870f4cc07c0dbfe216a49fe8e24"`
    );
    await queryRunner.query(
      `ALTER TABLE "post_link" DROP CONSTRAINT "FK_07ece436838f80564c9cb0d7ca4"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_870f4cc07c0dbfe216a49fe8e2"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_07ece436838f80564c9cb0d7ca"`
    );
    await queryRunner.query(`DROP TABLE "post_link"`);
  }
}

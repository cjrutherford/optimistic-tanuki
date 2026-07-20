import { MigrationInterface, QueryRunner } from 'typeorm';

export class VoteDedup1775100000000 implements MigrationInterface {
  name = 'VoteDedup1775100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "vote"
      WHERE "postId" IS NULL AND "commentId" IS NULL
    `);
    await queryRunner.query(`
      DELETE FROM "vote" v
      USING "vote" v2
      WHERE v."postId" IS NOT NULL
        AND v2."postId" IS NOT NULL
        AND v."postId" = v2."postId"
        AND v."profileId" = v2."profileId"
        AND v.id < v2.id
    `);
    await queryRunner.query(`
      DELETE FROM "vote" v
      USING "vote" v2
      WHERE v."commentId" IS NOT NULL
        AND v2."commentId" IS NOT NULL
        AND v."commentId" = v2."commentId"
        AND v."profileId" = v2."profileId"
        AND v.id < v2.id
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_vote_post_profile"
      ON "vote" ("postId", "profileId")
      WHERE "postId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_vote_comment_profile"
      ON "vote" ("commentId", "profileId")
      WHERE "commentId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_vote_comment_profile"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_vote_post_profile"`);
  }
}

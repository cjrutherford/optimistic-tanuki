import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the `appScope` column to the three tables whose entities declare it but
 * whose schema never got it.
 *
 * `1764861381331-add-post-draft-fields` added `appScope` to `post` only, while
 * the Blog, Event and Contact entities all carry the same column. The drift
 * surfaced as `column "appScope" of relation "event" does not exist` from
 * every blogging-e2e Event operation.
 *
 * Generated with `nx run blogging:typeorm:migration:generate`. The generator
 * additionally wanted to drop and recreate `IDX_blog_components_post_instance`
 * and `FK_blog_components_blogPostId` purely to rename them to its own hashed
 * identifiers; those statements were removed, since renaming an index and a
 * foreign key has no effect on the schema this migration exists to fix.
 */
export class AddAppScopeColumns1788917436240 implements MigrationInterface {
  name = 'AddAppScopeColumns1788917436240';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contact" ADD "appScope" character varying NOT NULL DEFAULT 'blogging'`
    );
    await queryRunner.query(
      `ALTER TABLE "event" ADD "appScope" character varying NOT NULL DEFAULT 'blogging'`
    );
    await queryRunner.query(
      `ALTER TABLE "blog" ADD "appScope" character varying NOT NULL DEFAULT 'blogging'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "blog" DROP COLUMN "appScope"`);
    await queryRunner.query(`ALTER TABLE "event" DROP COLUMN "appScope"`);
    await queryRunner.query(`ALTER TABLE "contact" DROP COLUMN "appScope"`);
  }
}

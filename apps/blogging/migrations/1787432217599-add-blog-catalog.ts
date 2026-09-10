import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBlogCatalog1787432217599 implements MigrationInterface {
  name = 'AddBlogCatalog1787432217599';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blog_components" DROP CONSTRAINT "FK_blog_components_blogPostId"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_blog_components_post_instance"`
    );
    await queryRunner.query(
      `CREATE TABLE "blog_catalogs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(200) NOT NULL, "description" text, "ownerId" uuid NOT NULL, "workspaceId" uuid NOT NULL, "appScope" character varying(128) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_50fe803b0ec87e405690aee1c39" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_1ff9d77313070d8b4a673baacd" ON "blog_catalogs" ("ownerId", "workspaceId", "appScope", "name") `
    );
    await queryRunner.query(
      `ALTER TABLE "contact" ADD "appScope" character varying NOT NULL DEFAULT 'blogging'`
    );
    await queryRunner.query(
      `ALTER TABLE "event" ADD "appScope" character varying NOT NULL DEFAULT 'blogging'`
    );
    await queryRunner.query(
      `ALTER TABLE "blog" ADD "appScope" character varying NOT NULL DEFAULT 'blogging'`
    );
    await queryRunner.query(`ALTER TABLE "blog" ADD "catalogId" uuid`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_55a22bf9ae20acb9c318d6dc56" ON "blog_components" ("blogPostId", "instanceId") `
    );
    await queryRunner.query(
      `ALTER TABLE "blog_components" ADD CONSTRAINT "FK_b2df310b2f125e099ecbb0e3c7c" FOREIGN KEY ("blogPostId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blog_components" DROP CONSTRAINT "FK_b2df310b2f125e099ecbb0e3c7c"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_55a22bf9ae20acb9c318d6dc56"`
    );
    await queryRunner.query(`ALTER TABLE "blog" DROP COLUMN "catalogId"`);
    await queryRunner.query(`ALTER TABLE "blog" DROP COLUMN "appScope"`);
    await queryRunner.query(`ALTER TABLE "event" DROP COLUMN "appScope"`);
    await queryRunner.query(`ALTER TABLE "contact" DROP COLUMN "appScope"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1ff9d77313070d8b4a673baacd"`
    );
    await queryRunner.query(`DROP TABLE "blog_catalogs"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_blog_components_post_instance" ON "blog_components" ("blogPostId", "instanceId") `
    );
    await queryRunner.query(
      `ALTER TABLE "blog_components" ADD CONSTRAINT "FK_blog_components_blogPostId" FOREIGN KEY ("blogPostId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }
}

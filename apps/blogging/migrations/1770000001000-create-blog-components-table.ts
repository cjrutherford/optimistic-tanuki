import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBlogComponentsTable1770000001000
  implements MigrationInterface
{
  name = 'CreateBlogComponentsTable1770000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "blog_components" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "blogPostId" uuid NOT NULL,
        "instanceId" character varying(255) NOT NULL,
        "componentType" character varying(100) NOT NULL,
        "componentData" jsonb NOT NULL,
        "position" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_blog_components_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_blog_components_post_instance" 
      ON "blog_components" ("blogPostId", "instanceId")
    `);

    await queryRunner.query(`
      ALTER TABLE "blog_components" 
      ADD CONSTRAINT "FK_blog_components_blogPostId" 
      FOREIGN KEY ("blogPostId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "blog_components" 
      DROP CONSTRAINT "FK_blog_components_blogPostId"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_blog_components_post_instance"
    `);

    await queryRunner.query(`DROP TABLE "blog_components"`);
  }
}

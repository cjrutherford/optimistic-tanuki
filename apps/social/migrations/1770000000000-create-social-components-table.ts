import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSocialComponentsTable1770000000000 implements MigrationInterface {
  name = 'CreateSocialComponentsTable1770000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "social_components" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "postId" uuid NOT NULL,
        "instanceId" character varying(255) NOT NULL,
        "componentType" character varying(100) NOT NULL,
        "componentData" jsonb NOT NULL,
        "position" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_social_components_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_social_components_post_instance" 
      ON "social_components" ("postId", "instanceId")
    `);

    await queryRunner.query(`
      ALTER TABLE "social_components" 
      ADD CONSTRAINT "FK_social_components_postId" 
      FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "social_components" 
      DROP CONSTRAINT "FK_social_components_postId"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_social_components_post_instance"
    `);

    await queryRunner.query(`DROP TABLE "social_components"`);
  }
}

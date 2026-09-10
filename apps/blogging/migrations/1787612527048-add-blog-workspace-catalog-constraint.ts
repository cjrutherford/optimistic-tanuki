import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBlogWorkspaceCatalogConstraint1787612527048
  implements MigrationInterface
{
  name = 'AddBlogWorkspaceCatalogConstraint1787612527048';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "blog" ADD "workspaceId" uuid`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_7300b8a8b6fd5c37c7d594b38c" ON "blog" ("catalogId") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7300b8a8b6fd5c37c7d594b38c"`
    );
    await queryRunner.query(`ALTER TABLE "blog" DROP COLUMN "workspaceId"`);
  }
}

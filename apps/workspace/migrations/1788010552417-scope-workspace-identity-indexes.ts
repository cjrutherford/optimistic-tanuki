import { MigrationInterface, QueryRunner } from 'typeorm';

export class ScopeWorkspaceIdentityIndexes1788010552417
  implements MigrationInterface
{
  name = 'ScopeWorkspaceIdentityIndexes1788010552417';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_17e3308126424d1b637070be22"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3744f12362802083441b5c70c8"`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_de872e0d0dc7fa92529dc44af9" ON "workspaces" ("sourceService", "sourceId", "appScope") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_e43a8060d753d01d48e779d5a6" ON "workspaces" ("kind", "slug", "appScope") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e43a8060d753d01d48e779d5a6"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_de872e0d0dc7fa92529dc44af9"`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_3744f12362802083441b5c70c8" ON "workspaces" ("kind", "slug") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_17e3308126424d1b637070be22" ON "workspaces" ("sourceService", "sourceId") `
    );
  }
}
